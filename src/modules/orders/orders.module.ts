import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { StoreOrdersController } from './store-orders.controller';
import { AdminOrdersController } from './admin-orders.controller';

@Module({
  controllers: [StoreOrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
