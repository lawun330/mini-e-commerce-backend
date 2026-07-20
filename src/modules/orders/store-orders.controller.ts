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

@ApiTags('Store - Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('store/orders')
export class StoreOrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  placeOrder(
    @CurrentUser() user: { id: string },
    @Body() _dto: CreateOrderDto,
  ) {
    return this.ordersService.placeOrder(user.id);
  }

  @Get()
  myOrders(@CurrentUser() user: { id: string }) {
    return this.ordersService.findForUser(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  // Customers can cancel their own order; OrdersService enforces that this
  // only succeeds for status = CANCELLED and only from PENDING/CONFIRMED.
  @Patch(':id/status')
  cancel(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { id: string; role: 'CUSTOMER' | 'ADMIN' },
  ) {
    return this.ordersService.updateStatus(id, dto.status, user);
  }
}
