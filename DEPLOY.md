# Deployment on Render

## Overview

- Hosted deploy uses the same **Dockerfile** as local Docker, but Render runs it on their servers.

- Repo includes [render.yaml](render.yaml), which creates:

    | Resource | Name |
    | -------- | ---- |
    | Web service | `mini-e-commerce-backend` |
    | Postgres (free) | `mini-ecommerce-db` |

- Migrations run automatically on boot (See [docker/entrypoint.sh](docker/entrypoint.sh)).
- Only seed **once** after the first successful deploy.

## Steps

1. Push this repo to GitHub.

2. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → select the repo.

3. When prompted for a blueprint name, use e.g. `mini-e-commerce-backend-blueprint`.

4. Apply the blueprint and wait for the first deploy to finish (Docker build + migrate).

5. Check URLs:
   - **Health**: _https://<your-service>.onrender.com/health_ → `{"status":"ok"}`
   - **Swagger**: _https://<your-service>.onrender.com/api/docs_
   - **API**: _http://<your-service>.onrender.com//api/v1_

6. Seed **once**:

   **Option A**: Render Shell (web service → **Shell):

   ```bash
   # install seed tooling temporarily, then seed
   npm install ts-node typescript --no-save
   npx ts-node prisma/seed.ts
   ```

   **Option B**: from local laptop (Dashboard → `mini-ecommerce-db` → External Database URL):

   ```bash
   DATABASE_URL='postgresql://...' npm run prisma:seed
   ```

   Do **not** use `npm run docker:seed` on Render as that URL is for local Docker only.

## Seed Accounts

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Admin    | `admin@example.com`    | `Password123!` |
| Customer | `customer@example.com` | `Password123!` |

Seed also creates a category tree, 6 published products (2+ variants each), 1 draft product, carts for admin and customer (customer cart has items), 2 sample orders (one `DELIVERED`, one `PENDING`), and a review on Classic Tee so store reviews work out of the box.