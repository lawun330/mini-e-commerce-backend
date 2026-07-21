import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';

// STORE endpoints for managing orders
@ApiTags('Store - Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('store/orders')
export class StoreOrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  placeOrder(@CurrentUser() user: RequestUser, @Body() dto: CreateOrderDto) {
    void dto; // note validated but not persisted yet; order comes from cart only
    return this.ordersService.placeOrder(user.id);
  }

  @Get()
  myOrders(@CurrentUser() user: RequestUser) {
    return this.ordersService.findAllForUser(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.ordersService.findOneForUser(id, user.id);
  }

  /* ADDITION: Customers can cancel their own order until it is shipped or delivered.
   * OrdersService enforces that this only succeeds for status = CANCELLED and only from PENDING/CONFIRMED.
   */
  @Patch(':id/status')
  cancel(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.ordersService.updateStatus(id, dto.status, user);
  }
}
