import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma.mock';

describe('ReviewsService (store + admin endpoints)', () => {
  let service: ReviewsService;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ReviewsService);
  });

  describe('GET /store/products/:slug/reviews', () => {
    it('lists reviews for product slug', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', slug: 'tee' });
      prisma.review.findMany.mockResolvedValue([
        { id: 'r1', rating: 5, comment: 'Great' },
      ]);
      await expect(service.findForProductSlug('tee')).resolves.toHaveLength(1);
    });

    it('throws NotFoundException when product missing', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findForProductSlug('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('POST /store/products/:slug/reviews', () => {
    it('creates review when delivered order exists', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        slug: 'tee',
        deletedAt: null,
      });
      prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({
        id: 'r1',
        rating: 5,
        comment: 'Nice',
      });

      await expect(
        service.createForProductSlug('tee', 'u1', {
          rating: 5,
          comment: 'Nice',
        }),
      ).resolves.toMatchObject({ id: 'r1' });
    });

    it('throws NotFoundException for deleted product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        deletedAt: new Date(),
      });
      await expect(
        service.createForProductSlug('tee', 'u1', { rating: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException without delivered order', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        deletedAt: null,
      });
      prisma.orderItem.findFirst.mockResolvedValue(null);
      await expect(
        service.createForProductSlug('tee', 'u1', { rating: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ConflictException on duplicate review', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        deletedAt: null,
      });
      prisma.orderItem.findFirst.mockResolvedValue({ id: 'oi1' });
      prisma.review.findUnique.mockResolvedValue({ id: 'r1' });
      await expect(
        service.createForProductSlug('tee', 'u1', { rating: 4 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('GET /admin/reviews', () => {
    it('lists all reviews', async () => {
      prisma.review.findMany.mockResolvedValue([{ id: 'r1' }]);
      await expect(service.findAll()).resolves.toEqual([{ id: 'r1' }]);
    });
  });

  describe('DELETE /admin/reviews/:id', () => {
    it('deletes review', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.review.delete.mockResolvedValue({ id: 'r1' });
      await expect(service.remove('r1')).resolves.toEqual({ id: 'r1' });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(service.remove('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
