import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
};

export type { CategoryNode };

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // STORE: find all categories and build a tree structure
  async findTree(): Promise<CategoryNode[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return buildTree(categories);
  }

  // ADMIN: find all categories with their parent and product counts
  async findAll() {
    return this.prisma.category.findMany({
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { children: true, products: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // STORE: find a category by slug with its children and products
  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { name: 'asc' } },
        products: {
          where: { status: ProductStatus.PUBLISHED, deletedAt: null }, // only published products that are not soft-deleted
          include: {
            variants: { where: { deletedAt: null } }, // only variants that are not soft-deleted
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // ADMIN: create a new category
  async create(dto: CreateCategoryDto) {
    await this.assertSlugAvailable(dto.slug);
    if (dto.parentId) await this.assertParentExists(dto.parentId);

    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          parentId: dto.parentId,
        },
      });
    } catch (err: unknown) {
      throwUniqueOrRethrow(err, 'A category with this slug already exists');
    }
  }

  // ADMIN: update an existing category
  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    if (dto.slug && dto.slug !== category.slug) {
      await this.assertSlugAvailable(dto.slug);
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      if (dto.parentId) {
        await this.assertParentExists(dto.parentId);
        await this.assertNotDescendant(id, dto.parentId);
      }
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        },
      });
    } catch (err: unknown) {
      throwUniqueOrRethrow(err, 'A category with this slug already exists');
    }
  }

  // ADMIN: delete an existing category
  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, products: true } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category._count.children > 0) {
      throw new BadRequestException(
        'Cannot delete a category that has subcategories',
      );
    }
    if (category._count.products > 0) {
      throw new BadRequestException(
        'Cannot delete a category that still has products',
      );
    }

    return this.prisma.category.delete({ where: { id } });
  }

  // helper: check if a slug is available
  private async assertSlugAvailable(slug: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing)
      throw new ConflictException('A category with this slug already exists');
  }

  // helper: check if a parent category exists
  private async assertParentExists(parentId: string) {
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw new BadRequestException('Parent category not found');
  }

  // helper: prevent cycles by checking if the new parent is not already a descendant of the current category
  private async assertNotDescendant(id: string, newParentId: string) {
    const all = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const c of all) {
      if (!c.parentId) continue;
      const list = childrenByParent.get(c.parentId) ?? [];
      list.push(c.id);
      childrenByParent.set(c.parentId, list);
    }

    const stack = [...(childrenByParent.get(id) ?? [])];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === newParentId) {
        throw new BadRequestException(
          'Cannot move a category under one of its descendants',
        );
      }
      stack.push(...(childrenByParent.get(current) ?? []));
    }
  }
}

// helper: build a tree structure from a list of categories
function buildTree(
  categories: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
  }[],
): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of categories) {
    nodes.set(c.id, {
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      children: [],
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// helper: throw a conflict exception if the error is a unique constraint violation, otherwise rethrow the error
function throwUniqueOrRethrow(err: unknown, message: string): never {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  ) {
    throw new ConflictException(message);
  }
  throw err;
}
