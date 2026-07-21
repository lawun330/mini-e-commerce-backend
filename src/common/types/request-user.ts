import { Role } from '@prisma/client';

// shape returned by JwtStrategy.validate() and attached to request.user
export interface RequestUser {
  id: string;
  email: string;
  role: Role;
}
