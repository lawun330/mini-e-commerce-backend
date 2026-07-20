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

  async findTree(): Promise<CategoryNode[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    return buildTree(categories);
  }

  async findAll() {
    return this.prisma.category.findMany({
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { children: true, products: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: { orderBy: { name: 'asc' } },
        products: {
          where: { status: ProductStatus.PUBLISHED, deletedAt: null },
          include: {
            variants: { where: { deletedAt: null } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

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

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { children: true, products: true } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category._count.children > 0) {
      throw new BadRequestException('Cannot delete a category that has subcategories');
    }
    if (category._count.products > 0) {
      throw new BadRequestException('Cannot delete a category that still has products');
    }

    return this.prisma.category.delete({ where: { id } });
  }

  private async assertSlugAvailable(slug: string) {
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('A category with this slug already exists');
  }

  private async assertParentExists(parentId: string) {
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw new BadRequestException('Parent category not found');
  }

  // prevent cycles: newParent must not already be under `id` in the tree
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
        throw new BadRequestException('Cannot move a category under one of its descendants');
      }
      stack.push(...(childrenByParent.get(current) ?? []));
    }
  }
}

function buildTree(
  categories: { id: string; name: string; slug: string; parentId: string | null }[],
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
