import { Decimal } from '@prisma/client/runtime/library';
import { getEffectivePrice, isDiscountActive } from './pricing.util';

describe('pricing.util', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('returns base price when discountPrice is null', () => {
    const variant = {
      price: new Decimal(100),
      discountPrice: null,
      discountStartsAt: null,
      discountEndsAt: null,
    };
    expect(getEffectivePrice(variant, now).toString()).toBe('100');
    expect(isDiscountActive(variant, now)).toBe(false);
  });

  it('uses discount when no window dates', () => {
    const variant = {
      price: new Decimal(100),
      discountPrice: new Decimal(80),
      discountStartsAt: null,
      discountEndsAt: null,
    };
    expect(getEffectivePrice(variant, now).toString()).toBe('80');
    expect(isDiscountActive(variant, now)).toBe(true);
  });

  it('uses discount only inside date window', () => {
    const variant = {
      price: new Decimal(100),
      discountPrice: new Decimal(80),
      discountStartsAt: new Date('2026-06-01T00:00:00.000Z'),
      discountEndsAt: new Date('2026-06-30T23:59:59.000Z'),
    };
    expect(getEffectivePrice(variant, now).toString()).toBe('80');
    expect(isDiscountActive(variant, now)).toBe(true);

    const outside = new Date('2026-07-01T00:00:00.000Z');
    expect(getEffectivePrice(variant, outside).toString()).toBe('100');
    expect(isDiscountActive(variant, outside)).toBe(false);
  });
});
