import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getEffectivePrice, isDiscountActive } from '../products/pricing.util';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return this.loadCart(cart.id);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const variant = await this.assertPurchasableVariant(dto.productVariantId);

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: variant.id,
        },
      },
    });

    const nextQty = (existing?.quantity ?? 0) + dto.quantity;
    if (nextQty > variant.stock) {
      throw new BadRequestException(
        `Insufficient stock for "${variant.name}" (requested ${nextQty}, available ${variant.stock})`,
      );
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: dto.quantity,
        },
      });
    }

    return this.loadCart(cart.id);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    const variant = await this.assertPurchasableVariant(item.productVariantId);
    if (dto.quantity > variant.stock) {
      throw new BadRequestException(
        `Insufficient stock for "${variant.name}" (requested ${dto.quantity}, available ${variant.stock})`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: dto.quantity },
    });

    return this.loadCart(cart.id);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.loadCart(cart.id);
  }

  private async getOrCreateCart(userId: string) {
    const existing = await this.prisma.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.prisma.cart.create({ data: { userId } });
  }

  private async assertPurchasableVariant(productVariantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: productVariantId },
      include: { product: true },
    });

    if (!variant || variant.deletedAt || variant.product.deletedAt) {
      throw new NotFoundException('Product variant not found');
    }
    if (variant.product.status !== ProductStatus.PUBLISHED) {
      throw new BadRequestException(
        'This product is not available for purchase',
      );
    }
    if (variant.stock <= 0) {
      throw new BadRequestException(`"${variant.name}" is out of stock`);
    }

    return variant;
  }

  private async loadCart(cartId: string) {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: {
                  select: { id: true, name: true, slug: true, status: true },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    let subtotal = 0;
    const items = cart.items.map((item) => {
      const effectivePrice = getEffectivePrice(item.productVariant);
      const lineTotal = Number(effectivePrice) * item.quantity;
      subtotal += lineTotal;
      return {
        ...item,
        productVariant: {
          ...item.productVariant,
          effectivePrice,
          discountActive: isDiscountActive(item.productVariant),
        },
        lineTotal,
      };
    });

    return { ...cart, items, subtotal };
  }
}
