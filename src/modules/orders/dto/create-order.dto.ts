import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// DTO for creating a new order
/*
 * "NEVER TRUST THE CLIENT!"
 * Finalize the order from the user's current server-side Cart,
 * with prices recomputed from ProductVariant at the moment of placement.
 */
export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'Optional note for the order, e.g. delivery instructions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
