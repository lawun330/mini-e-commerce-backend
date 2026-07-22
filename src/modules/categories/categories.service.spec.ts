import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma.mock';

describe('CategoriesService (store + admin endpoints)', () => {
  let service: CategoriesService;
  const prisma = createPrismaMock();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(CategoriesService);
  });

  describe('GET /store/categories', () => {
    it('builds a category tree', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'p', name: 'Parent', slug: 'parent', parentId: null },
        { id: 'c', name: 'Child', slug: 'child', parentId: 'p' },
      ]);

      const tree = await service.findTree();
      expect(tree).toHaveLength(1);
      expect(tree[0].slug).toBe('parent');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].slug).toBe('child');
    });
  });

  describe('GET /store/categories/:slug', () => {
    it('returns category by slug', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'p',
        slug: 'parent',
        children: [],
        products: [],
      });
      await expect(service.findBySlug('parent')).resolves.toMatchObject({
        slug: 'parent',
      });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('GET /admin/categories', () => {
    it('lists categories with counts', async () => {
      const rows = [{ id: 'p', name: 'Parent' }];
      prisma.category.findMany.mockResolvedValue(rows);
      await expect(service.findAll()).resolves.toEqual(rows);
    });
  });

  describe('POST /admin/categories', () => {
    it('creates a category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'n',
        name: 'New',
        slug: 'new',
      });

      await expect(
        service.create({ name: 'New', slug: 'new' }),
      ).resolves.toMatchObject({ slug: 'new' });
    });

    it('throws ConflictException when slug taken', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'x' });
      await expect(
        service.create({ name: 'New', slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException when parent missing', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(null) // slug available
        .mockResolvedValueOnce(null); // parent missing
      await expect(
        service.create({ name: 'New', slug: 'new', parentId: 'missing' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('PATCH /admin/categories/:id', () => {
    it('updates a category', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'p',
        slug: 'parent',
      });
      prisma.category.update.mockResolvedValue({
        id: 'p',
        name: 'Renamed',
        slug: 'parent',
      });

      await expect(
        service.update('p', { name: 'Renamed' }),
      ).resolves.toMatchObject({ name: 'Renamed' });
    });

    it('rejects self-parent', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'p',
        slug: 'parent',
      });
      await expect(
        service.update('p', { parentId: 'p' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.update('x', { name: 'N' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('DELETE /admin/categories/:id', () => {
    it('deletes empty category', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'p',
        _count: { children: 0, products: 0 },
      });
      prisma.category.delete.mockResolvedValue({ id: 'p' });
      await expect(service.remove('p')).resolves.toEqual({ id: 'p' });
    });

    it('rejects category with children', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'p',
        _count: { children: 1, products: 0 },
      });
      await expect(service.remove('p')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects category with products', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'p',
        _count: { children: 0, products: 2 },
      });
      await expect(service.remove('p')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
