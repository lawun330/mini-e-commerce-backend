import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Role, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getEffectivePrice } from '../products/pricing.util';
import { assertRoleCanTransition, assertValidTransition } from './order-status.util';

interface ActingUser {
  id: string;
  role: Role;
}

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Places an order from the user's current cart.
   *
   * Everything below happens inside ONE transaction so that a stock failure
   * on item 3 of 5 rolls back items 1 and 2 as well - the order either fully
   * succeeds or doesn't exist at all.
   */
  async placeOrder(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Your cart is empty');
      }

      // 1. Re-check stock and compute prices fresh from the DB - never trust
      //    anything cached on the cart item or sent by the client.
      let total = 0;
      const orderItemsData: {
        productId: string;
        productVariantId: string;
        quantity: number;
        priceAtPurchase: number;
      }[] = [];

      for (const item of cart.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.productVariantId },
          include: { product: true },
        });

        if (!variant || variant.deletedAt || variant.product.deletedAt) {
          throw new BadRequestException(`A product in your cart is no longer available`);
        }
        if (variant.product.status !== ProductStatus.PUBLISHED) {
          throw new BadRequestException(`A product in your cart is not available for purchase`);
        }
        if (variant.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${variant.name}" (requested ${item.quantity}, available ${variant.stock})`,
          );
        }

        const effectivePrice = getEffectivePrice(variant); // discount-aware, server-computed
        const priceNumber = Number(effectivePrice);
        total += priceNumber * item.quantity;

        orderItemsData.push({
          productId: variant.productId,
          productVariantId: variant.id,
          quantity: item.quantity,
          priceAtPurchase: priceNumber,
        });

        // 2. Deduct stock atomically as part of the same transaction.
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // 3. Create the order + snapshot line items.
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          status: OrderStatus.PENDING,
          total,
          items: { create: orderItemsData },
        },
        include: { items: true },
      });

      // 4. Clear the cart now that it has been converted into an order.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async findOne(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true, productVariant: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: { items: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Shared by both /store/orders/:id/status (customer cancel) and
   * /admin/orders/:id/status. Role-specific permission is checked here,
   * not duplicated per-controller.
   */
  async updateStatus(orderId: string, newStatus: OrderStatus, actingUser: ActingUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (actingUser.role === Role.CUSTOMER && order.userId !== actingUser.id) {
      throw new ForbiddenException('You do not have access to this order');
    }

    assertValidTransition(order.status, newStatus);
    assertRoleCanTransition(actingUser.role, order.status, newStatus);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: { items: true },
      });

      // Restore stock when an order is cancelled.
      if (newStatus === OrderStatus.CANCELLED) {
        for (const item of updated.items) {
          await tx.productVariant.update({
            where: { id: item.productVariantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return updated;
    });
  }
}

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${date}-${random}`;
}
