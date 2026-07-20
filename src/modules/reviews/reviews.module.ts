import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { StoreReviewsController } from './store-reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';

@Module({
  controllers: [StoreReviewsController, AdminReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
