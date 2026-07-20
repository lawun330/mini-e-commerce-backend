import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Store - Reviews')
@Controller('store/products/:slug/reviews')
export class StoreReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get()
  findForProduct(@Param('slug') slug: string) {
    return this.reviewsService.findForProductSlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Param('slug') slug: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.reviewsService.createForProductSlug(slug, user.id, dto);
  }
}
