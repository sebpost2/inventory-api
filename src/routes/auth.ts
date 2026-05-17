import { FastifyInstance } from "fastify"
import bcrypt from "bcryptjs"
import { db } from "../db/client.js"
import { generateId } from "../lib/id.js"
import { RegisterSchema, LoginSchema } from "../schemas/auth.js"

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post("/register", {
    schema: {
      tags: ["Auth"],
      summary: "Register a new user",
      body: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name:     { type: "string", minLength: 2 },
          email:    { type: "string", format: "email" },
          password: { type: "string", minLength: 6 },
        },
      },
    },
  }, async (req, reply) => {
    const result = RegisterSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues[0].message })
    }
    const { name, email, password } = result.data

    const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] })
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: "Email already in use" })
    }

    const id = generateId()
    const hash = await bcrypt.hash(password, 10)
    await db.execute({ sql: "INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)", args: [id, name, email, hash] })

    const token = app.jwt.sign({ id, email }, { expiresIn: "7d" })
    return reply.status(201).send({ token, user: { id, name, email } })
  })

  // POST /auth/login
  app.post("/login", {
    schema: {
      tags: ["Auth"],
      summary: "Login and get JWT token",
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email:    { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const result = LoginSchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues[0].message })
    }
    const { email, password } = result.data

    const rows = await db.execute({ sql: "SELECT id, name, email, password FROM users WHERE email = ?", args: [email] })
    if (rows.rows.length === 0) {
      return reply.status(401).send({ error: "Invalid email or password" })
    }

    const user = rows.rows[0]
    const valid = await bcrypt.compare(password, user.password as string)
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" })
    }

    const token = app.jwt.sign({ id: user.id, email: user.email }, { expiresIn: "7d" })
    return reply.send({ token, user: { id: user.id, name: user.name, email: user.email } })
  })

  // GET /auth/me
  app.get("/me", {
    onRequest: [app.authenticate],
    schema: {
      tags: ["Auth"],
      summary: "Get current user info",
      security: [{ bearerAuth: [] }],
    },
  }, async (req, reply) => {
    const { id } = req.user as { id: string }
    const rows = await db.execute({ sql: "SELECT id, name, email, created_at FROM users WHERE id = ?", args: [id] })
    if (rows.rows.length === 0) return reply.status(404).send({ error: "User not found" })
    return reply.send(rows.rows[0])
  })
}
