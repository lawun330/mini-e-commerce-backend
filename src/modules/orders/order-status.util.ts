import { OrderStatus, Role } from '@prisma/client';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

// Map of current status -> statuses it's structurally allowed to move to.
// This says nothing about WHO is allowed to trigger it - that's checked separately below.
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED], // no cancelling once it has physically shipped
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Throws if `from -> to` is not a legal transition at all (regardless of role).
 */
export function assertValidTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`Cannot move an order from ${from} to ${to}`);
  }
}

/**
 * Throws if this specific role is not allowed to perform this specific transition.
 * - CUSTOMER: may only cancel, and only from PENDING or CONFIRMED.
 * - ADMIN: may perform any transition that assertValidTransition() already allows.
 */
export function assertRoleCanTransition(
  role: Role,
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (role === Role.ADMIN) {
    return; // admins may perform any structurally valid transition
  }

  // CUSTOMER path
  const customerCanCancelFrom: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
  ];
  if (to !== OrderStatus.CANCELLED || !customerCanCancelFrom.includes(from)) {
    throw new ForbiddenException(
      'Customers may only cancel an order while it is pending or confirmed',
    );
  }
}
