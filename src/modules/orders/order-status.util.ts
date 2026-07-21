/* -- UTILITY --
 * Validates order status transitions and who is allowed to make them.
 *
 * Structural rules (any role):
 * - PENDING   -> CONFIRMED | CANCELLED
 * - CONFIRMED -> SHIPPED   | CANCELLED
 * - SHIPPED   -> DELIVERED (no cancel after shipping)
 * - DELIVERED -> (terminal)
 * - CANCELLED -> (terminal)
 *
 * Role-based rules:
 * - ADMIN: any structurally valid transition above.
 * - CUSTOMER: may only move to CANCELLED, and only from PENDING or CONFIRMED.
 *
 * Called from:
 *   1. OrdersService.updateStatus(), before writing the new status (and
 *      before restoring stock on cancel).
 */

import { OrderStatus, Role } from '@prisma/client';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

// all valid state transitions
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

// helper: throw if a state transition is not valid (regardless of role)
export function assertValidTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  const allowed = VALID_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`Cannot move an order from ${from} to ${to}`);
  }
}

// helper: throw if a role is not allowed to perform a state transition
export function assertRoleCanTransition(
  role: Role,
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (role === Role.ADMIN) {
    return; // ADMIN: perform any valid state transitions
  }

  // STORE: cancel order while pending or confirmed only
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
