import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

// lightweight probe for Docker / Render health checks
@ApiExcludeController()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
