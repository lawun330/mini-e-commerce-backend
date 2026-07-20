import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Usage: findOrders(@CurrentUser() user: RequestUser)
// Populated by JwtStrategy.validate() -> request.user
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
