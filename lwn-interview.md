# Take-Home Project: Mini E-Commerce Backend API (La Wun Nanda)

## Overview

Build a simplified e-commerce backend API using **NestJS**, **PostgreSQL**, and **Prisma ORM**.

**Time Estimate**: 7 days  
**Submission**: Push to a public GitHub repository and share the link.

---

## Tech Stack (Required)

| Tool            | Purpose           |
| --------------- | ----------------- |
| NestJS          | Backend framework |
| PostgreSQL      | Database          |
| Prisma ORM      | Database ORM      |
| TypeScript      | Language          |
| class-validator | DTO validation    |
| Swagger         | API documentation |

---

## What to Build

A mini e-commerce API with the following domains: **Auth**, **Products**, **Categories**, **Cart**, **Orders**, and **Reviews**.

Each domain must have:

- **Store endpoints** (customer-facing, prefixed with `/store/`)
- **Admin endpoints** (admin-facing, prefixed with `/admin/`)
- **Auth endpoints** (public, prefixed with `/auth/`)

---

## Database Schema

Design a Prisma schema with the following models and relationships (at minimum). You decide the fields, types, and constraints.

### Models & Relationships

- **User** — Represents a customer or admin user. Must support authentication (email + password). Consider roles for store vs admin access.
- **Category** — Hierarchical product categories (supports nested subcategories). A product belongs to a category.
- **Product** — Has many **ProductVariant**s. Belongs to a **Category**. Needs a URL-friendly slug and publish status tracking.
- **ProductVariant** — Belongs to a **Product**. Each variant has its own SKU, price, and stock count.
- **Cart** — Belongs to a **User**. Has many **CartItem**s. One cart per user.
- **CartItem** — Belongs to a **Cart** and a **ProductVariant**. Tracks quantity of a variant in the cart.
- **Order** — Belongs to a **User**. Has many **OrderItem**s. Needs a unique, auto-generated order number and a computed total.
- **OrderItem** — Belongs to an **Order**, a **Product**, and a **ProductVariant**. Captures quantity and pricing at time of purchase.
- **Review** — Belongs to a **User** and a **Product**. Includes a rating and optional comment.

### Key Design Considerations

- Products have a lifecycle (draft → published → archived).
- Categories can be nested (parent/child hierarchy).
- Orders have a lifecycle (pending → confirmed → shipped → delivered, with cancellation possible).
- Prices must be calculated server-side — never trust client-sent amounts.
- Stock must be validated and deducted atomically during order placement.
- Cancelled orders should restore stock.
- Order status transitions must be valid (e.g., a cancelled order cannot be shipped).
- Placing an order should clear the user's cart.
- A user can only review a product they have purchased.
- Passwords must be hashed; use JWT for authentication.

You can extend this schema with additional models or fields as needed.

---

## Required API Endpoints

### Auth (Public)

| Method | Endpoint              | Description              |
| ------ | --------------------- | ------------------------ |
| POST   | `/auth/register`      | Register a new user      |
| POST   | `/auth/login`         | Login and receive a JWT  |
| GET    | `/auth/me`            | Get current user profile |

### Store - Categories (Customer-facing)

| Method | Endpoint                          | Description                         |
| ------ | --------------------------------- | ----------------------------------- |
| GET    | `/store/categories`               | List all categories (tree)          |
| GET    | `/store/categories/:slug`         | Get category with its products      |

### Admin - Categories

| Method | Endpoint                       | Description                |
| ------ | ------------------------------ | -------------------------- |
| GET    | `/admin/categories`            | List all categories        |
| POST   | `/admin/categories`            | Create a category          |
| PATCH  | `/admin/categories/:id`        | Update a category          |
| DELETE | `/admin/categories/:id`        | Delete a category          |

### Store - Products (Customer-facing)

| Method | Endpoint                | Description                         |
| ------ | ----------------------- | ----------------------------------- |
| GET    | `/store/products`       | List published products (paginated) |
| GET    | `/store/products/:slug` | Get a single product by slug        |

### Admin - Products

| Method | Endpoint              | Description                    |
| ------ | --------------------- | ------------------------------ |
| GET    | `/admin/products`     | List all products (paginated)  |
| GET    | `/admin/products/:id` | Get product by ID              |
| POST   | `/admin/products`     | Create a product with variants |
| PATCH  | `/admin/products/:id` | Update a product               |
| DELETE | `/admin/products/:id` | Delete a product               |

### Store - Cart (Customer-facing)

| Method | Endpoint                    | Description                    |
| ------ | --------------------------- | ------------------------------ |
| GET    | `/store/cart`               | Get current user's cart        |
| POST   | `/store/cart/items`         | Add an item to cart            |
| PATCH  | `/store/cart/items/:id`     | Update cart item quantity      |
| DELETE | `/store/cart/items/:id`     | Remove an item from cart       |

### Store - Orders (Customer-facing)

| Method | Endpoint            | Description             |
| ------ | ------------------- | ----------------------- |
| POST   | `/store/orders`     | Place a new order       |
| GET    | `/store/orders`     | List user's orders      |
| GET    | `/store/orders/:id` | Get order details       |

### Admin - Orders

| Method | Endpoint                       | Description         |
| ------ | ------------------------------ | ------------------- |
| GET    | `/admin/orders`                | List all orders     |
| GET    | `/admin/orders/:id`            | Get order details   |
| PATCH  | `/admin/orders/:id/status`     | Update order status |

### Store - Reviews (Customer-facing)

| Method | Endpoint                          | Description                         |
| ------ | --------------------------------- | ----------------------------------- |
| GET    | `/store/products/:slug/reviews`   | List reviews for a product          |
| POST   | `/store/products/:slug/reviews`   | Create a review for a product       |

### Admin - Reviews

| Method | Endpoint                    | Description              |
| ------ | --------------------------- | ------------------------ |
| GET    | `/admin/reviews`            | List all reviews         |
| DELETE | `/admin/reviews/:id`        | Delete a review          |

---

## Project Setup Requirements

- Global API prefix: `api/v1`
- Swagger docs available at `/api/docs`
- Seed script that creates sample users, categories, products (5+ with 2+ variants each), and orders
- Include a `.env.example` file
- Include a `README.md` with setup instructions

---

## Evaluation Criteria

| Criteria                        | Weight | What We Look For                                               |
| ------------------------------- | ------ | -------------------------------------------------------------- |
| **Code Organization**           | 25%    | Clean module structure, separation of concerns                 |
| **API Design**                  | 25%    | RESTful conventions, consistent responses, proper status codes |
| **Database Design**             | 15%    | Proper relations, indexes, use of transactions                 |
| **Validation & Error Handling** | 15%    | DTO validation, meaningful error messages, edge cases          |
| **Documentation**               | 10%    | Swagger completeness, README clarity                           |
| **Code Quality**                | 10%    | TypeScript usage, naming conventions, no `any` types           |

---

## Bonus (Optional — Not Required)

- Unit tests for the service layer
- Dockerized setup (`docker-compose.yml` with PostgreSQL)
- Refresh token rotation
- Soft-delete for products
- Order status history tracking

---

## Submission Checklist

- [ ] GitHub repository with clean commit history
- [ ] `README.md` with setup instructions
- [ ] `.env.example` with required environment variables
- [ ] Prisma schema with migrations
- [ ] Seed script with sample data
- [ ] All required endpoints implemented and working
- [ ] Swagger documentation accessible

Good luck! Focus on clean, working code over feature completeness.
