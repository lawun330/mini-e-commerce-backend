/* -- UTILITY --
 * Returns the price that should actually be charged for a variant right now.
 *
 * Rules:
 * - discountPrice null -> no discount, use base price.
 * - discountPrice set but discountStartsAt/discountEndsAt provided -> only
 *   active if `now` falls inside that window.
 * - discountPrice set with no dates -> treated as a manually toggled on/off discount.
 *
 * Called from:
 *   1. ProductsService (product read paths) and CartService.loadCart(),
 *      so customers see the real price before ordering.
 *   2. OrdersService.placeOrder(), inside the transaction, so priceAtPurchase
 *      reflects whatever was active at the exact moment of purchase.
 */

import { ProductVariant } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// helper: get the effective price for a variant
export function getEffectivePrice(
  variant: Pick<
    ProductVariant,
    'price' | 'discountPrice' | 'discountStartsAt' | 'discountEndsAt'
  >,
  now: Date = new Date(),
): Decimal {
  const hasDiscount = variant.discountPrice != null;
  if (!hasDiscount) {
    return variant.price;
  }

  const afterStart =
    !variant.discountStartsAt || variant.discountStartsAt <= now;
  const beforeEnd = !variant.discountEndsAt || variant.discountEndsAt >= now;

  return afterStart && beforeEnd ? variant.discountPrice! : variant.price;
}

// helper: check if a discount is active for a variant
export function isDiscountActive(
  variant: Pick<
    ProductVariant,
    'discountPrice' | 'discountStartsAt' | 'discountEndsAt'
  >,
  now: Date = new Date(),
): boolean {
  if (variant.discountPrice == null) return false;
  const afterStart =
    !variant.discountStartsAt || variant.discountStartsAt <= now;
  const beforeEnd = !variant.discountEndsAt || variant.discountEndsAt >= now;
  return afterStart && beforeEnd;
}
