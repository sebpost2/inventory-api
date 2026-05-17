# Inventory API

A production-ready RESTful inventory management API built with **Fastify**, **TypeScript**, **Turso (SQLite)**, and **JWT authentication**.

Live docs: [https://inventory-api-production.up.railway.app/docs](https://inventory-api-production.up.railway.app/docs)

---

## Tech Stack

| Layer       | Choice                                     |
|-------------|--------------------------------------------|
| Runtime     | Node.js 20 + TypeScript (ESM)              |
| Framework   | Fastify v5                                 |
| Database    | Turso (libSQL / SQLite edge)               |
| Auth        | JWT via `@fastify/jwt` + bcrypt            |
| Validation  | Zod v4                                     |
| API Docs    | Swagger / OpenAPI 3 (`@fastify/swagger`)   |
| Rate limit  | `@fastify/rate-limit` (100 req/min)        |
| Tests       | Vitest with Fastify inject (in-memory DB)  |

---

## Features

- **JWT Authentication** — register, login, protected routes
- **Product Management** — full CRUD with SKU, pricing, stock tracking
- **Category Management** — organize products into user-owned categories
- **Stock Adjustments** — atomic +/- operations with optional reason log
- **Inventory Stats** — total products, low-stock count, out-of-stock, total value
- **Search & Filter** — query products by name/SKU, filter by category or low-stock flag
- **Pagination** — all list endpoints support `page` + `limit`
- **OpenAPI Docs** — interactive Swagger UI at `/docs`
- **Rate Limiting** — 100 requests per minute per IP
- **CORS** — configured for cross-origin access

---

## Getting Started

### Prerequisites

- Node.js 20+
- A free [Turso](https://turso.tech) account (SQLite edge database)

### 1. Clone and install

```bash
git clone https://github.com/sebpost2/inventory-api.git
cd inventory-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

```env
TURSO_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your-token"
JWT_SECRET="at-least-32-random-characters"
PORT=3000
```

**Create your Turso database:**

```bash
# Install Turso CLI
npm install -g @turso/cli

turso auth login
turso db create inventory-db
turso db show inventory-db   # copy the URL
turso db tokens create inventory-db  # copy the token
```

### 3. Initialize the database

```bash
npm run db:init
```

### 4. Run

```bash
npm run dev      # development with hot reload
npm run build    # compile TypeScript
npm start        # production
```

---

## API Reference

Interactive docs are available at `/docs` (Swagger UI).

### Auth

| Method | Endpoint          | Description              |
|--------|-------------------|--------------------------|
| POST   | `/auth/register`  | Create a new account     |
| POST   | `/auth/login`     | Login and get JWT token  |
| GET    | `/auth/me`        | Get current user info    |

### Products

| Method | Endpoint                  | Description                        |
|--------|---------------------------|------------------------------------|
| GET    | `/products`               | List products (search, filter, paginate) |
| POST   | `/products`               | Create a product                   |
| GET    | `/products/:id`           | Get a product by ID                |
| PUT    | `/products/:id`           | Update a product                   |
| DELETE | `/products/:id`           | Delete a product                   |
| PATCH  | `/products/:id/stock`     | Adjust stock (+/-)                 |
| GET    | `/products/stats/summary` | Inventory summary stats            |

**Query parameters for `GET /products`:**

| Param         | Type    | Description                        |
|---------------|---------|------------------------------------|
| `search`      | string  | Search name or SKU                 |
| `category_id` | string  | Filter by category                 |
| `low_stock`   | boolean | Show only items with stock < 10    |
| `page`        | number  | Page number (default: 1)           |
| `limit`       | number  | Items per page (default: 20, max 100) |

### Categories

| Method | Endpoint           | Description             |
|--------|--------------------|-------------------------|
| GET    | `/categories`      | List all categories     |
| POST   | `/categories`      | Create a category       |
| GET    | `/categories/:id`  | Get a category          |
| PUT    | `/categories/:id`  | Update a category       |
| DELETE | `/categories/:id`  | Delete a category       |

### Example Request

```bash
# Register
curl -X POST https://your-api.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}'

# Create a product (use token from register/login)
curl -X POST https://your-api.railway.app/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":9.99,"stock":100,"sku":"WGT-001"}'

# Adjust stock
curl -X PATCH https://your-api.railway.app/products/<id>/stock \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"adjustment":-5,"reason":"Sold at trade show"}'
```

---

## Testing

Tests run against an in-memory SQLite database — no external services needed.

```bash
npm test
```

Test coverage:
- Auth: register, login, duplicate email, bad password, protected routes
- Products: CRUD, duplicate SKU, stock adjustments, pagination, 401 guards
- Categories: CRUD, duplicate name, ownership checks

---

## Project Structure

```
src/
├── db/
│   ├── client.ts       # Turso client initialization
│   └── migrate.ts      # Schema creation
├── lib/
│   ├── errors.ts       # notFound / conflict / forbidden helpers
│   └── id.ts           # Secure random ID generation
├── routes/
│   ├── auth.ts         # /auth routes
│   ├── categories.ts   # /categories routes
│   └── products.ts     # /products routes
├── schemas/
│   ├── auth.ts         # Zod schemas for auth
│   ├── category.ts     # Zod schemas for categories
│   └── product.ts      # Zod schemas for products
├── tests/
│   ├── auth.test.ts
│   ├── categories.test.ts
│   └── products.test.ts
├── types/
│   └── fastify.d.ts    # Fastify type augmentations
└── server.ts           # Entry point, plugin registration
```

---

## Deployment

This API is deployed on [Railway](https://railway.app) (free tier).

**Environment variables required on Railway:**

```
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
JWT_SECRET=your-secret
NODE_ENV=production
PORT=3000
```

Railway auto-detects Node.js, runs `npm run build` then `npm start`.

---

## License

MIT
