import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';

// STORE endpoints for viewing products
@ApiTags('Store - Products')
@Controller('store/products')
export class StoreProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findPublished(@Query() query: PaginationQueryDto) {
    return this.productsService.findPublished(
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
