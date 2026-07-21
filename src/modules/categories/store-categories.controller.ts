import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

// STORE endpoints for viewing categories
@ApiTags('Store - Categories')
@Controller('store/categories')
export class StoreCategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  findTree() {
    return this.categoriesService.findTree();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }
}
