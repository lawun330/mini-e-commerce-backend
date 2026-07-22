import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma.mock';

function makeVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'var1',
    name: 'Black / M',
    stock: 10,
    deletedAt: null,
    price: new Decimal(29.99),
    discountPrice: null,
    discountStartsAt: null,
    discountEndsAt: null,
    product: {
      id: 'prod1',
      name: 'Tee',
      slug: 'tee',
      status: ProductStatus.PUBLISHED,
      deletedAt: null,
    },
    ...overrides,
  };
}

describe('CartService (store cart endpoints)', () => {
  let service: CartService;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CartService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CartService);

    prisma.cart.findUniqueOrThrow.mockResolvedValue({
      id: 'cart1',
      items: [],
    });
  });

  describe('GET /store/cart', () => {
    it('returns existing cart with subtotal', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'cart1', userId: 'u1' });
      prisma.cart.findUniqueOrThrow.mockResolvedValue({
        id: 'cart1',
        items: [
          {
            id: 'item1',
            quantity: 2,
            productVariant: makeVariant(),
          },
        ],
      });

      const cart = await service.getCart('u1');
      expect(cart.items).toHaveLength(1);
      expect(cart.subtotal).toBeCloseTo(59.98);
    });

    it('creates cart when missing', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      prisma.cart.create.mockResolvedValue({ id: 'cart1', userId: 'u1' });
      prisma.cart.findUniqueOrThrow.mockResolvedValue({
        id: 'cart1',
        items: [],
      });

      const cart = await service.getCart('u1');
      expect(prisma.cart.create).toHaveBeenCalledWith({
        data: { userId: 'u1' },
      });
      expect(cart.subtotal).toBe(0);
    });
  });

  describe('POST /store/cart/items', () => {
    beforeEach(() => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'cart1', userId: 'u1' });
      prisma.cart.findUniqueOrThrow.mockResolvedValue({
        id: 'cart1',
        items: [],
      });
    });

    it('adds a new cart item', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(makeVariant());
      prisma.cartItem.findUnique.mockResolvedValue(null);
      prisma.cartItem.create.mockResolvedValue({ id: 'item1' });

      await service.addItem('u1', {
        productVariantId: 'var1',
        quantity: 1,
      });
      expect(prisma.cartItem.create).toHaveBeenCalled();
    });

    it('increments quantity when item already exists', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(makeVariant());
      prisma.cartItem.findUnique.mockResolvedValue({
        id: 'item1',
        quantity: 2,
      });
      prisma.cartItem.update.mockResolvedValue({});

      await service.addItem('u1', {
        productVariantId: 'var1',
        quantity: 1,
      });
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: { quantity: 3 },
      });
    });

    it('throws when variant not found', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(null);
      await expect(
        service.addItem('u1', { productVariantId: 'x', quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when unpublished', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(
        makeVariant({
          product: {
            id: 'prod1',
            status: ProductStatus.DRAFT,
            deletedAt: null,
          },
        }),
      );
      await expect(
        service.addItem('u1', { productVariantId: 'var1', quantity: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when stock insufficient', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(
        makeVariant({ stock: 1 }),
      );
      prisma.cartItem.findUnique.mockResolvedValue({
        id: 'item1',
        quantity: 1,
      });
      await expect(
        service.addItem('u1', { productVariantId: 'var1', quantity: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('PATCH /store/cart/items/:id', () => {
    it('updates quantity for owned cart item', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'cart1', userId: 'u1' });
      prisma.cartItem.findFirst.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        productVariantId: 'var1',
        quantity: 1,
      });
      prisma.productVariant.findUnique.mockResolvedValue(makeVariant());
      prisma.cartItem.update.mockResolvedValue({});
      prisma.cart.findUniqueOrThrow.mockResolvedValue({
        id: 'cart1',
        items: [],
      });

      await service.updateItem('u1', 'item1', { quantity: 3 });
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: { quantity: 3 },
      });
    });

    it('throws NotFoundException for unknown item', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'cart1', userId: 'u1' });
      prisma.cartItem.findFirst.mockResolvedValue(null);
      await expect(
        service.updateItem('u1', 'missing', { quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('DELETE /store/cart/items/:id', () => {
    it('removes owned cart item', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'cart1', userId: 'u1' });
      prisma.cartItem.findFirst.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
      });
      prisma.cartItem.delete.mockResolvedValue({});
      prisma.cart.findUniqueOrThrow.mockResolvedValue({
        id: 'cart1',
        items: [],
      });

      await service.removeItem('u1', 'item1');
      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'item1' },
      });
    });
  });
});
