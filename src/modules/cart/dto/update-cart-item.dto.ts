import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

// DTO for updating an existing item in the cart
export class UpdateCartItemDto {
  @ApiProperty({ minimum: 1, example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
