import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createForProductSlug(
    slug: string,
    userId: string,
    dto: CreateReviewDto,
  ) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product || product.deletedAt) {
      throw new NotFoundException('Product not found');
    }

    // Eligibility: user must have at least one DELIVERED order containing this product.
    const eligibleOrderItem = await this.prisma.orderItem.findFirst({
      where: {
        productId: product.id,
        order: { userId, status: OrderStatus.DELIVERED },
      },
    });

    if (!eligibleOrderItem) {
      throw new BadRequestException(
        'You can only review products from orders that have been delivered to you',
      );
    }

    // @@unique([userId, productId]) on Review enforces this at the DB level too;
    // we check here first to return a friendlier error than a raw constraint violation.
    const existing = await this.prisma.review.findUnique({
      where: { userId_productId: { userId, productId: product.id } },
    });
    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    return this.prisma.review.create({
      data: {
        userId,
        productId: product.id,
        rating: dto.rating,
        comment: dto.comment,
      },
    });
  }

  async findForProductSlug(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.review.findMany({
      where: { productId: product.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.review.findMany({
      include: {
        user: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.review.delete({ where: { id } });
  }
}
