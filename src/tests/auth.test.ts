import { describe, it, expect, beforeAll, afterAll } from "vitest"
import Fastify from "fastify"
import cors from "@fastify/cors"
import jwt from "@fastify/jwt"
import rateLimit from "@fastify/rate-limit"

import { db } from "../db/client.js"
import { authRoutes } from "../routes/auth.js"

async function buildApp() {
  const app = Fastify({ logger: false })

  await app.register(cors, { origin: true })
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" })
  await app.register(jwt, { secret: process.env.JWT_SECRET! })

  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.status(401).send({ error: "Unauthorized" })
    }
  })

  await app.register(authRoutes, { prefix: "/auth" })
  return app
}

async function initDb() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`)
}

describe("Auth routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    await initDb()
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await db.execute("DELETE FROM users")
  })

  it("POST /auth/register — creates a user and returns a token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Alice", email: "alice@example.com", password: "secret123" },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.email).toBe("alice@example.com")
  })

  it("POST /auth/register — rejects duplicate email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Alice2", email: "alice@example.com", password: "secret123" },
    })
    expect(res.statusCode).toBe(409)
  })

  it("POST /auth/register — rejects short password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { name: "Bob", email: "bob@example.com", password: "123" },
    })
    expect(res.statusCode).toBe(400)
  })

  it("POST /auth/login — returns token with valid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "alice@example.com", password: "secret123" },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().token).toBeTruthy()
  })

  it("POST /auth/login — rejects wrong password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "alice@example.com", password: "wrong" },
    })
    expect(res.statusCode).toBe(401)
  })

  it("GET /auth/me — returns user info when authenticated", async () => {
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "alice@example.com", password: "secret123" },
    })
    const { token } = loginRes.json()

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toBe("alice@example.com")
  })

  it("GET /auth/me — returns 401 without token", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" })
    expect(res.statusCode).toBe(401)
  })
})
