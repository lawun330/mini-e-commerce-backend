import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Validates the JWT in the Authorization header via JwtStrategy below.
// Apply with @UseGuards(JwtAuthGuard) on any protected controller/route.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
