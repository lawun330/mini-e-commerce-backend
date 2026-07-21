import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

// DTO for adding a new item to the cart
export class AddCartItemDto {
  @ApiProperty({ description: 'product variant id to add' })
  @IsString()
  productVariantId!: string;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
