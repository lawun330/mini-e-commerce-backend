import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, ProductStatus, Role } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma.mock';

describe('OrdersService (store + admin endpoints)', () => {
  let service: OrdersService;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(OrdersService);
  });

  describe('POST /store/orders', () => {
    it('places order from cart, deducts stock, clears cart', async () => {
      const variant = {
        id: 'var1',
        productId: 'prod1',
        name: 'Std',
        stock: 5,
        deletedAt: null,
        price: new Decimal(20),
        discountPrice: null,
        discountStartsAt: null,
        discountEndsAt: null,
        product: {
          id: 'prod1',
          status: ProductStatus.PUBLISHED,
          deletedAt: null,
        },
      };

      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        userId: 'u1',
        items: [{ id: 'i1', productVariantId: 'var1', quantity: 2 }],
      });
      prisma.productVariant.findUnique.mockResolvedValue(variant);
      prisma.productVariant.update.mockResolvedValue({});
      prisma.order.create.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.PENDING,
        total: 40,
        items: [],
      });
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      const order = await service.placeOrder('u1');
      expect(order.id).toBe('o1');
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var1' },
        data: { stock: { decrement: 2 } },
      });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart1' },
      });
    });

    it('throws when cart empty', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        items: [],
      });
      await expect(service.placeOrder('u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when stock insufficient', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        items: [{ productVariantId: 'var1', quantity: 5 }],
      });
      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'var1',
        name: 'Std',
        stock: 2,
        deletedAt: null,
        price: new Decimal(10),
        discountPrice: null,
        discountStartsAt: null,
        discountEndsAt: null,
        product: {
          status: ProductStatus.PUBLISHED,
          deletedAt: null,
        },
      });

      await expect(service.placeOrder('u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('GET /store/orders', () => {
    it('lists orders for user', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);
      await expect(service.findAllForUser('u1')).resolves.toEqual([
        { id: 'o1' },
      ]);
    });
  });

  describe('GET /store/orders/:id', () => {
    it('returns owned order', async () => {
      prisma.order.findFirst.mockResolvedValue({ id: 'o1', userId: 'u1' });
      await expect(service.findOneForUser('o1', 'u1')).resolves.toMatchObject({
        id: 'o1',
      });
    });

    it('throws NotFoundException for other users order', async () => {
      prisma.order.findFirst.mockResolvedValue(null);
      await expect(service.findOneForUser('o1', 'u2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /admin/orders', () => {
    it('lists all orders', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]);
      await expect(service.findAll()).resolves.toHaveLength(2);
    });
  });

  describe('GET /admin/orders/:id', () => {
    it('returns order by id', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1' });
      await expect(service.findOne('o1')).resolves.toEqual({ id: 'o1' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('PATCH /store|/admin/orders/:id/status', () => {
    it('admin confirms pending order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.PENDING,
      });
      prisma.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CONFIRMED,
        items: [],
      });

      const updated = await service.updateStatus('o1', OrderStatus.CONFIRMED, {
        id: 'admin',
        role: Role.ADMIN,
      });
      expect(updated.status).toBe(OrderStatus.CONFIRMED);
    });

    it('customer cancels own pending order and restores stock', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.PENDING,
      });
      prisma.order.update.mockResolvedValue({
        id: 'o1',
        status: OrderStatus.CANCELLED,
        items: [{ productVariantId: 'var1', quantity: 2 }],
      });
      prisma.productVariant.update.mockResolvedValue({});

      await service.updateStatus('o1', OrderStatus.CANCELLED, {
        id: 'u1',
        role: Role.CUSTOMER,
      });

      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'var1' },
        data: { stock: { increment: 2 } },
      });
    });

    it('forbids customer cancelling someone else order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'owner',
        status: OrderStatus.PENDING,
      });
      await expect(
        service.updateStatus('o1', OrderStatus.CANCELLED, {
          id: 'other',
          role: Role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('forbids customer confirming', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: OrderStatus.PENDING,
      });
      await expect(
        service.updateStatus('o1', OrderStatus.CONFIRMED, {
          id: 'u1',
          role: Role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
