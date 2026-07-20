import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { StoreProductsController } from './store-products.controller';
import { AdminProductsController } from './admin-products.controller';

@Module({
  controllers: [StoreProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
