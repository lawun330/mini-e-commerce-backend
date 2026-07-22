import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import {
  assertRoleCanTransition,
  assertValidTransition,
} from './order-status.util';

describe('order-status.util', () => {
  describe('assertValidTransition', () => {
    it('allows PENDING -> CONFIRMED', () => {
      expect(() =>
        assertValidTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED),
      ).not.toThrow();
    });

    it('rejects DELIVERED -> anything', () => {
      expect(() =>
        assertValidTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED),
      ).toThrow(BadRequestException);
    });

    it('rejects SHIPPED -> CANCELLED', () => {
      expect(() =>
        assertValidTransition(OrderStatus.SHIPPED, OrderStatus.CANCELLED),
      ).toThrow(BadRequestException);
    });
  });

  describe('assertRoleCanTransition', () => {
    it('allows ADMIN any structurally valid move', () => {
      expect(() =>
        assertRoleCanTransition(
          Role.ADMIN,
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
        ),
      ).not.toThrow();
    });

    it('allows CUSTOMER cancel from PENDING', () => {
      expect(() =>
        assertRoleCanTransition(
          Role.CUSTOMER,
          OrderStatus.PENDING,
          OrderStatus.CANCELLED,
        ),
      ).not.toThrow();
    });

    it('forbids CUSTOMER confirming', () => {
      expect(() =>
        assertRoleCanTransition(
          Role.CUSTOMER,
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
