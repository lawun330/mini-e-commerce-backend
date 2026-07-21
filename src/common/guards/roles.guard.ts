import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../types/request-user';

// Must run AFTER JwtAuthGuard (order matters in @UseGuards(JwtAuthGuard, RolesGuard))
// so that request.user is already populated when this checks the role.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator present -> route doesn't require a specific role -> allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // get the current authenticated user from the request
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const user = request.user;

    // user is not authenticated or user role is not in the required roles -> forbid access
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    // user is authenticated and user role is in the required roles -> allow access
    return true;
  }
}
