import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { StoreCartController } from './store-cart.controller';

@Module({
  controllers: [StoreCartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
