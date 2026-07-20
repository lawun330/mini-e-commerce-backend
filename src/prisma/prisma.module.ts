import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() means any module can inject PrismaService without importing PrismaModule directly,
// as long as PrismaModule itself is imported once in AppModule.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
