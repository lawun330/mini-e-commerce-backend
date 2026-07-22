import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ProductsService } from './products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma.mock';

function makeVariant(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'v1',
    sku: 'SKU-1',
    name: 'Std',
    price: new Decimal(50),
    discountPrice: null,
    discountStartsAt: null,
    discountEndsAt: null,
    stock: 10,
    deletedAt: null,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    name: 'Gadget',
    slug: 'gadget',
    status: ProductStatus.PUBLISHED,
    deletedAt: null,
    category: { id: 'c1', name: 'Cat', slug: 'cat' },
    variants: [makeVariant()],
    ...overrides,
  };
}

describe('ProductsService (store + admin endpoints)', () => {
  let service: ProductsService;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  describe('GET /store/products', () => {
    it('returns paginated published products with effective prices', async () => {
      prisma.product.count.mockResolvedValue(1);
      prisma.product.findMany.mockResolvedValue([makeProduct()]);

      const result = await service.findPublished(1, 20);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data[0].variants[0]).toHaveProperty('effectivePrice');
      expect(result.data[0].variants[0]).toHaveProperty('discountActive');
    });
  });

  describe('GET /store/products/:slug', () => {
    it('returns published product by slug', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      await expect(service.findBySlug('gadget')).resolves.toMatchObject({
        slug: 'gadget',
      });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findBySlug('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /admin/products', () => {
    it('lists non-deleted products', async () => {
      prisma.product.count.mockResolvedValue(1);
      prisma.product.findMany.mockResolvedValue([makeProduct()]);
      const result = await service.findAll(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('GET /admin/products/:id', () => {
    it('returns product by id', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      await expect(service.findOne('p1')).resolves.toMatchObject({ id: 'p1' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('POST /admin/products', () => {
    const dto = {
      name: 'Gadget',
      slug: 'gadget',
      categoryId: 'c1',
      variants: [
        { sku: 'SKU-1', name: 'Std', price: 50, stock: 10 },
        { sku: 'SKU-2', name: 'Pro', price: 80, stock: 5 },
      ],
    };

    it('creates a product', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue(null);
      prisma.product.create.mockResolvedValue(
        makeProduct({
          variants: [makeVariant(), makeVariant({ id: 'v2', sku: 'SKU-2' })],
        }),
      );

      await expect(service.create(dto)).resolves.toMatchObject({
        slug: 'gadget',
      });
    });

    it('throws BadRequestException when category missing', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws ConflictException when slug taken', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue({ id: 'other' });
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws BadRequestException on duplicate SKUs in payload', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          ...dto,
          variants: [
            { sku: 'DUP', name: 'A', price: 1, stock: 1 },
            { sku: 'DUP', name: 'B', price: 2, stock: 1 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('PATCH /admin/products/:id', () => {
    it('updates a product', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      prisma.product.update.mockResolvedValue(makeProduct({ name: 'Renamed' }));
      await expect(
        service.update('p1', { name: 'Renamed' }),
      ).resolves.toMatchObject({ name: 'Renamed' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.update('x', { name: 'N' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('DELETE /admin/products/:id', () => {
    it('soft-deletes product and variants', async () => {
      prisma.product.findFirst.mockResolvedValue(makeProduct());
      prisma.product.update.mockResolvedValue({
        id: 'p1',
        status: ProductStatus.ARCHIVED,
        deletedAt: new Date(),
      });
      prisma.productVariant.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.remove('p1');
      expect(result.status).toBe(ProductStatus.ARCHIVED);
      expect(prisma.productVariant.updateMany).toHaveBeenCalled();
    });

    it('throws NotFoundException when missing', async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
