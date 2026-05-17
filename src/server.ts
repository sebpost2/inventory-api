import "dotenv/config"
import Fastify from "fastify"
import cors from "@fastify/cors"
import jwt from "@fastify/jwt"
import rateLimit from "@fastify/rate-limit"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"

import { authRoutes } from "./routes/auth.js"
import { categoryRoutes } from "./routes/categories.js"
import { productRoutes } from "./routes/products.js"

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required")

const app = Fastify({ logger: process.env.NODE_ENV !== "test" })

// ── Plugins ──────────────────────────────────────────────────────────────────

await app.register(cors, { origin: true })

await app.register(rateLimit, { max: 100, timeWindow: "1 minute" })

await app.register(jwt, { secret: process.env.JWT_SECRET })

await app.register(swagger, {
  openapi: {
    info: {
      title:       "Inventory API",
      description: "RESTful inventory management API — Fastify + Turso + JWT",
      version:     "1.0.0",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
})

await app.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig:    { docExpansion: "list", deepLinking: true },
})

// ── Auth decorator ────────────────────────────────────────────────────────────

app.decorate("authenticate", async (req: any, reply: any) => {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ error: "Unauthorized" })
  }
})

// ── Routes ───────────────────────────────────────────────────────────────────

await app.register(authRoutes,     { prefix: "/auth" })
await app.register(categoryRoutes, { prefix: "/categories" })
await app.register(productRoutes,  { prefix: "/products" })

app.get("/", async () => ({
  name:    "inventory-api",
  version: "1.0.0",
  docs:    "/docs",
  health:  "/health",
}))

app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }))

// ── Start ─────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3000)
const host = "0.0.0.0"

try {
  await app.listen({ port, host })
  console.log(`Server running on http://localhost:${port}`)
  console.log(`API docs:    http://localhost:${port}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}

export { app }
