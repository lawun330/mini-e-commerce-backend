import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductStatus, ProductVariant } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { getEffectivePrice, isDiscountActive } from './pricing.util';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findPublished(page = 1, limit = 20) {
    const where = { status: ProductStatus.PUBLISHED, deletedAt: null };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variants: { where: { deletedAt: null } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: products.map((p) => this.withEffectivePrices(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.PUBLISHED, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { deletedAt: null } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.withEffectivePrices(product);
  }

  async findAllAdmin(page = 1, limit = 20) {
    const where = { deletedAt: null };
    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          variants: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: products.map((p) => this.withEffectivePrices(p)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findOneAdmin(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        variants: true,
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.withEffectivePrices(product);
  }

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new BadRequestException('Category not found');

    const existingSlug = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug)
      throw new ConflictException('A product with this slug already exists');

    const skus = dto.variants.map((v) => v.sku);
    if (new Set(skus).size !== skus.length) {
      throw new BadRequestException(
        'Variant SKUs must be unique within the product',
      );
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          status: dto.status ?? ProductStatus.DRAFT,
          categoryId: dto.categoryId,
          variants: {
            create: dto.variants.map((v) => ({
              sku: v.sku,
              name: v.name,
              price: v.price,
              discountPrice: v.discountPrice,
              discountStartsAt: v.discountStartsAt
                ? new Date(v.discountStartsAt)
                : undefined,
              discountEndsAt: v.discountEndsAt
                ? new Date(v.discountEndsAt)
                : undefined,
              stock: v.stock,
            })),
          },
        },
        include: {
          variants: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      });
      return this.withEffectivePrices(product);
    } catch (err: unknown) {
      throwUniqueOrRethrow(err, 'A product or variant SKU already exists');
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (dto.slug && dto.slug !== product.slug) {
      const taken = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
      });
      if (taken)
        throw new ConflictException('A product with this slug already exists');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new BadRequestException('Category not found');
    }

    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        },
        include: {
          variants: { where: { deletedAt: null } },
          category: { select: { id: true, name: true, slug: true } },
        },
      });
      return this.withEffectivePrices(updated);
    } catch (err: unknown) {
      throwUniqueOrRethrow(err, 'A product with this slug already exists');
    }
  }

  // soft-delete product + its variants so historical OrderItems stay intact
  async remove(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Product not found');

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: { deletedAt: now, status: ProductStatus.ARCHIVED },
      }),
      this.prisma.productVariant.updateMany({
        where: { productId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    return updated;
  }

  private withEffectivePrices<T extends { variants: ProductVariant[] }>(
    product: T,
  ) {
    return {
      ...product,
      variants: product.variants.map((v) => ({
        ...v,
        effectivePrice: getEffectivePrice(v),
        discountActive: isDiscountActive(v),
      })),
    };
  }
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
