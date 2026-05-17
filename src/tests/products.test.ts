import { describe, it, expect, beforeAll, afterAll } from "vitest"
import Fastify from "fastify"
import cors from "@fastify/cors"
import jwt from "@fastify/jwt"
import rateLimit from "@fastify/rate-limit"

import { db } from "../db/client.js"
import { authRoutes } from "../routes/auth.js"
import { productRoutes } from "../routes/products.js"

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true })
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" })
  await app.register(jwt, { secret: process.env.JWT_SECRET! })

  app.decorate("authenticate", async (req: any, reply: any) => {
    try { await req.jwtVerify() } catch { reply.status(401).send({ error: "Unauthorized" }) }
  })

  await app.register(authRoutes,    { prefix: "/auth" })
  await app.register(productRoutes, { prefix: "/products" })
  return app
}

async function initDb() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`)
  await db.execute(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
    user_id TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
  )`)
  await db.execute(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
    price REAL NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    sku TEXT, category_id TEXT, user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  )`)
}

describe("Product routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let token: string
  let productId: string

  beforeAll(async () => {
    await initDb()
    app = await buildApp()
    await app.ready()

    const reg = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { name: "Bob", email: "bob-prod@example.com", password: "secret123" },
    })
    token = reg.json().token
  })

  afterAll(async () => {
    await app.close()
    await db.execute("DELETE FROM products")
    await db.execute("DELETE FROM users")
  })

  it("POST /products — creates a product", async () => {
    const res = await app.inject({
      method: "POST", url: "/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Widget A", price: 9.99, stock: 50, sku: "WGT-001" },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.name).toBe("Widget A")
    expect(body.stock).toBe(50)
    productId = body.id
  })

  it("POST /products — rejects duplicate SKU", async () => {
    const res = await app.inject({
      method: "POST", url: "/products",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Widget B", price: 5.00, stock: 10, sku: "WGT-001" },
    })
    expect(res.statusCode).toBe(409)
  })

  it("GET /products — lists products with pagination", async () => {
    const res = await app.inject({
      method: "GET", url: "/products",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.pagination).toBeDefined()
  })

  it("GET /products/:id — returns product by id", async () => {
    const res = await app.inject({
      method: "GET", url: `/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(productId)
  })

  it("GET /products/:id — returns 404 for unknown id", async () => {
    const res = await app.inject({
      method: "GET", url: "/products/nonexistent",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it("PUT /products/:id — updates a product", async () => {
    const res = await app.inject({
      method: "PUT", url: `/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Widget A Pro", price: 14.99, stock: 50, sku: "WGT-001" },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe("Widget A Pro")
    expect(res.json().price).toBe(14.99)
  })

  it("PATCH /products/:id/stock — adjusts stock up", async () => {
    const res = await app.inject({
      method: "PATCH", url: `/products/${productId}/stock`,
      headers: { authorization: `Bearer ${token}` },
      payload: { adjustment: 10, reason: "Restock" },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.new_stock).toBe(60)
    expect(body.previous_stock).toBe(50)
  })

  it("PATCH /products/:id/stock — rejects stock going below 0", async () => {
    const res = await app.inject({
      method: "PATCH", url: `/products/${productId}/stock`,
      headers: { authorization: `Bearer ${token}` },
      payload: { adjustment: -999 },
    })
    expect(res.statusCode).toBe(400)
  })

  it("GET /products/stats/summary — returns inventory stats", async () => {
    const res = await app.inject({
      method: "GET", url: "/products/stats/summary",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total_products).toBeGreaterThan(0)
    expect(typeof body.inventory_value).toBe("number")
  })

  it("DELETE /products/:id — deletes product", async () => {
    const res = await app.inject({
      method: "DELETE", url: `/products/${productId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it("GET /products — returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/products" })
    expect(res.statusCode).toBe(401)
  })
})
