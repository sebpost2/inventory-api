import { describe, it, expect, beforeAll, afterAll } from "vitest"
import Fastify from "fastify"
import cors from "@fastify/cors"
import jwt from "@fastify/jwt"
import rateLimit from "@fastify/rate-limit"

import { db } from "../db/client.js"
import { authRoutes } from "../routes/auth.js"
import { categoryRoutes } from "../routes/categories.js"

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(cors, { origin: true })
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" })
  await app.register(jwt, { secret: process.env.JWT_SECRET! })

  app.decorate("authenticate", async (req: any, reply: any) => {
    try { await req.jwtVerify() } catch { reply.status(401).send({ error: "Unauthorized" }) }
  })

  await app.register(authRoutes,     { prefix: "/auth" })
  await app.register(categoryRoutes, { prefix: "/categories" })
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
}

describe("Category routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let token: string
  let categoryId: string

  beforeAll(async () => {
    await initDb()
    app = await buildApp()
    await app.ready()

    const reg = await app.inject({
      method: "POST", url: "/auth/register",
      payload: { name: "Carol", email: "carol@example.com", password: "secret123" },
    })
    token = reg.json().token
  })

  afterAll(async () => {
    await app.close()
    await db.execute("DELETE FROM categories")
    await db.execute("DELETE FROM users")
  })

  it("POST /categories — creates a category", async () => {
    const res = await app.inject({
      method: "POST", url: "/categories",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Electronics", description: "Electronic goods" },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.name).toBe("Electronics")
    categoryId = body.id
  })

  it("POST /categories — rejects duplicate name", async () => {
    const res = await app.inject({
      method: "POST", url: "/categories",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Electronics" },
    })
    expect(res.statusCode).toBe(409)
  })

  it("GET /categories — lists categories", async () => {
    const res = await app.inject({
      method: "GET", url: "/categories",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
    expect(res.json().length).toBeGreaterThan(0)
  })

  it("GET /categories/:id — returns a category", async () => {
    const res = await app.inject({
      method: "GET", url: `/categories/${categoryId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(categoryId)
  })

  it("PUT /categories/:id — updates a category", async () => {
    const res = await app.inject({
      method: "PUT", url: `/categories/${categoryId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Electronics & Gadgets" },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe("Electronics & Gadgets")
  })

  it("DELETE /categories/:id — deletes category", async () => {
    const res = await app.inject({
      method: "DELETE", url: `/categories/${categoryId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it("GET /categories/:id — returns 404 after deletion", async () => {
    const res = await app.inject({
      method: "GET", url: `/categories/${categoryId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
