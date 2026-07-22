# Mini E-Commerce Backend API

NestJS + PostgreSQL + Prisma API for auth, categories, products, cart, orders, and reviews.

## API

### Overview

| Prefix     | Audience                             |
| ---------- | ------------------------------------ |
| `/auth/*`  | Public register/login/refresh/logout |
| `/store/*` | Customer                             |
| `/admin/*` | Admin                                |

### URLs

#### Render:

- **Health**: https://mini-e-commerce-backend-iq1z.onrender.com/health
- **Swagger**: https://mini-e-commerce-backend-iq1z.onrender.com/api/docs
- **API**: https://mini-e-commerce-backend-iq1z.onrender.com/api/v1

#### Local:
- **Health**: http://localhost:3000/health
- **Swagger**: http://localhost:3000/api/docs
- **API**: http://localhost:3000/api/v1

---

## Tech Stack

`NestJS`, `TypeScript`, `PostgreSQL`, `Prisma`, `JWT`, `Swagger`, `Docker`

## File Structure

```
/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── health.controller.ts
│   ├── common/              # guards, decorators, filters, types
│   ├── prisma/              # PrismaModule / PrismaService
│   ├── test-utils/          # shared mocks for unit tests
│   └── modules/
│       ├── auth/            # jwt + refresh tokens, strategies
│       ├── categories/
│       ├── products/        # includes pricing.util.ts
│       ├── cart/
│       ├── orders/          # includes order-status.util.ts
│       └── reviews/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── test/                    # e2e tests
├── docker/
│   └── entrypoint.sh        # migrate deploy, then start API
├── Dockerfile
├── docker-compose.yml
├── render.yaml
└── ...
```

## Setup

See [CMD.md](CMD.md) and [DEPLOY.md](DEPLOY.md).

## Tests

```bash
npm test              # unit tests of service logic behind endpoints
npm run test:e2e      # end-to-end API tests with seeded DB (preferably)
```

---

## Notes

- Auth uses JWT access tokens plus opaque refresh tokens with rotation via `/auth/refresh`.
- Soft-delete for products exists via `deletedAt` (and variants), so old orders stay valid.
- Prices are server-side only (`getEffectivePrice()`); clients never send amounts.
- Order line prices are snapshotted at checkout (`priceAtPurchase`).
- Placing an order runs stock check, price snapshot, stock decrement, and cart clear in one transaction.
- Customers can also cancel their own orders only while status is `PENDING` or `CONFIRMED` (not after shipped).
- Cancelled orders restore stock; order status changes follow allowed transitions.
- Reviews only allowed after a `DELIVERED` order that includes that product.
- Customers only see their own orders (store order detail is scoped to the logged-in user).
