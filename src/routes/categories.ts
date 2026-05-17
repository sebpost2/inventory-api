import { FastifyInstance } from "fastify"
import { db } from "../db/client.js"
import { generateId } from "../lib/id.js"
import { CategorySchema } from "../schemas/category.js"
import { notFound, conflict, forbidden } from "../lib/errors.js"

export async function categoryRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] }
  const tag  = { tags: ["Categories"], security: [{ bearerAuth: [] }] }

  // GET /categories
  app.get("/", { ...auth, schema: { ...tag, summary: "List all categories" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const rows = await db.execute({ sql: "SELECT * FROM categories WHERE user_id = ? ORDER BY name", args: [userId] })
    return reply.send(rows.rows)
  })

  // POST /categories
  app.post("/", { ...auth, schema: { ...tag, summary: "Create a category" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const result = CategorySchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.issues[0].message })
    const { name, description } = result.data

    const exists = await db.execute({ sql: "SELECT id FROM categories WHERE name = ? AND user_id = ?", args: [name, userId] })
    if (exists.rows.length > 0) return conflict(reply, "Category name already exists")

    const id = generateId()
    await db.execute({ sql: "INSERT INTO categories (id, name, description, user_id) VALUES (?, ?, ?, ?)", args: [id, name, description ?? null, userId] })
    const row = await db.execute({ sql: "SELECT * FROM categories WHERE id = ?", args: [id] })
    return reply.status(201).send(row.rows[0])
  })

  // GET /categories/:id
  app.get("/:id", { ...auth, schema: { ...tag, summary: "Get a category" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const { id } = req.params as { id: string }
    const rows = await db.execute({ sql: "SELECT * FROM categories WHERE id = ?", args: [id] })
    if (rows.rows.length === 0) return notFound(reply, "Category")
    if (rows.rows[0].user_id !== userId) return forbidden(reply)
    return reply.send(rows.rows[0])
  })

  // PUT /categories/:id
  app.put("/:id", { ...auth, schema: { ...tag, summary: "Update a category" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const { id } = req.params as { id: string }
    const result = CategorySchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.issues[0].message })

    const rows = await db.execute({ sql: "SELECT user_id FROM categories WHERE id = ?", args: [id] })
    if (rows.rows.length === 0) return notFound(reply, "Category")
    if (rows.rows[0].user_id !== userId) return forbidden(reply)

    const { name, description } = result.data
    await db.execute({ sql: "UPDATE categories SET name = ?, description = ? WHERE id = ?", args: [name, description ?? null, id] })
    const updated = await db.execute({ sql: "SELECT * FROM categories WHERE id = ?", args: [id] })
    return reply.send(updated.rows[0])
  })

  // DELETE /categories/:id
  app.delete("/:id", { ...auth, schema: { ...tag, summary: "Delete a category" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const { id } = req.params as { id: string }
    const rows = await db.execute({ sql: "SELECT user_id FROM categories WHERE id = ?", args: [id] })
    if (rows.rows.length === 0) return notFound(reply, "Category")
    if (rows.rows[0].user_id !== userId) return forbidden(reply)
    await db.execute({ sql: "DELETE FROM categories WHERE id = ?", args: [id] })
    return reply.status(204).send()
  })
}
