import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { StoreCategoriesController } from './store-categories.controller';
import { AdminCategoriesController } from './admin-categories.controller';

@Module({
  controllers: [StoreCategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
