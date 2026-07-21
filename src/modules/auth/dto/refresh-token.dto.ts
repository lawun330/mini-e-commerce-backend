import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// DTO for refreshing or revoking a refresh token
export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token issued by login/register/refresh',
  })
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
