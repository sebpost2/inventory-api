import { FastifyInstance } from "fastify"
import { db } from "../db/client.js"
import { generateId } from "../lib/id.js"
import { ProductSchema, StockAdjustSchema, ProductQuerySchema } from "../schemas/product.js"
import { notFound, conflict, forbidden } from "../lib/errors.js"

export async function productRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] }
  const tag  = { tags: ["Products"], security: [{ bearerAuth: [] }] }

  // GET /products
  app.get("/", { ...auth, schema: { ...tag, summary: "List products (supports search, filter, pagination)" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const q = ProductQuerySchema.parse(req.query)

    const conditions: string[] = ["p.user_id = ?"]
    const args: (string | number | boolean)[] = [userId]

    if (q.search) {
      conditions.push("(p.name LIKE ? OR p.sku LIKE ?)")
      args.push(`%${q.search}%`, `%${q.search}%`)
    }
    if (q.category_id) {
      conditions.push("p.category_id = ?")
      args.push(q.category_id)
    }
    if (q.low_stock) {
      conditions.push("p.stock < 10")
    }

    const where  = conditions.join(" AND ")
    const offset = (q.page - 1) * q.limit

    const [rows, total] = await Promise.all([
      db.execute({ sql: `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, args: [...args, q.limit, offset] }),
      db.execute({ sql: `SELECT COUNT(*) AS count FROM products p WHERE ${where}`, args }),
    ])

    return reply.send({
      data:       rows.rows,
      pagination: { page: q.page, limit: q.limit, total: Number(total.rows[0].count) },
    })
  })

  // POST /products
  app.post("/", { ...auth, schema: { ...tag, summary: "Create a product" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const result = ProductSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.issues[0].message })
    const data = result.data

    if (data.sku) {
      const exists = await db.execute({ sql: "SELECT id FROM products WHERE sku = ? AND user_id = ?", args: [data.sku, userId] })
      if (exists.rows.length > 0) return conflict(reply, "SKU already in use")
    }

    const id = generateId()
    await db.execute({
      sql:  "INSERT INTO products (id, name, description, price, stock, sku, category_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, data.name, data.description ?? null, data.price, data.stock, data.sku ?? null, data.category_id ?? null, userId],
    })
    const row = await db.execute({ sql: "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?", args: [id] })
    return reply.status(201).send(row.rows[0])
  })

  // GET /products/:id
  app.get("/:id", { ...auth, schema: { ...tag, summary: "Get a product" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const { id } = req.params as { id: string }
    const rows = await db.execute({ sql: "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?", args: [id] })
    if (rows.rows.length === 0) return notFound(reply, "Product")
    if (rows.rows[0].user_id !== userId) return forbidden(reply)
    return reply.send(rows.rows[0])
  })

  // PUT /products/:id
  app.put("/:id", { ...auth, schema: { ...tag, summary: "Update a product" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const { id } = req.params as { id: string }
    const result = ProductSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.issues[0].message })

    const rows = await db.execute({ sql: "SELECT user_id FROM products WHERE id = ?", args: [id] })
    if (rows.rows.length === 0) return notFound(reply, "Product")
    if (rows.rows[0].user_id !== userId) return forbidden(reply)

    const data = result.data
    await db.execute({
      sql:  "UPDATE products SET name = ?, description = ?, price = ?, stock = ?, sku = ?, category_id = ?, updated_at = datetime('now') WHERE id = ?",
      args: [data.name, data.description ?? null, data.price, data.stock, data.sku ?? null, data.category_id ?? null, id],
    })
    const updated = await db.execute({ sql: "SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?", args: [id] })
    return reply.send(updated.rows[0])
  })

  // DELETE /products/:id
  app.delete("/:id", { ...auth, schema: { ...tag, summary: "Delete a product" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const { id } = req.params as { id: string }
    const rows = await db.execute({ sql: "SELECT user_id FROM products WHERE id = ?", args: [id] })
    if (rows.rows.length === 0) return notFound(reply, "Product")
    if (rows.rows[0].user_id !== userId) return forbidden(reply)
    await db.execute({ sql: "DELETE FROM products WHERE id = ?", args: [id] })
    return reply.status(204).send()
  })

  // PATCH /products/:id/stock — adjust stock (increment or decrement)
  app.patch("/:id/stock", { ...auth, schema: { ...tag, summary: "Adjust product stock (+/-)" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const { id } = req.params as { id: string }
    const result = StockAdjustSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.issues[0].message })

    const rows = await db.execute({ sql: "SELECT user_id, stock FROM products WHERE id = ?", args: [id] })
    if (rows.rows.length === 0) return notFound(reply, "Product")
    if (rows.rows[0].user_id !== userId) return forbidden(reply)

    const current  = Number(rows.rows[0].stock)
    const newStock = current + result.data.adjustment
    if (newStock < 0) return reply.status(400).send({ error: "Stock cannot go below 0" })

    await db.execute({ sql: "UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?", args: [newStock, id] })
    return reply.send({ id, previous_stock: current, new_stock: newStock, adjustment: result.data.adjustment, reason: result.data.reason })
  })

  // GET /products/stats/summary
  app.get("/stats/summary", { ...auth, schema: { ...tag, summary: "Get inventory summary stats" } }, async (req, reply) => {
    const { id: userId } = req.user as { id: string }
    const [total, lowStock, outOfStock, value] = await Promise.all([
      db.execute({ sql: "SELECT COUNT(*) AS count FROM products WHERE user_id = ?", args: [userId] }),
      db.execute({ sql: "SELECT COUNT(*) AS count FROM products WHERE user_id = ? AND stock < 10 AND stock > 0", args: [userId] }),
      db.execute({ sql: "SELECT COUNT(*) AS count FROM products WHERE user_id = ? AND stock = 0", args: [userId] }),
      db.execute({ sql: "SELECT SUM(price * stock) AS total FROM products WHERE user_id = ?", args: [userId] }),
    ])
    return reply.send({
      total_products:  Number(total.rows[0].count),
      low_stock:       Number(lowStock.rows[0].count),
      out_of_stock:    Number(outOfStock.rows[0].count),
      inventory_value: Number(value.rows[0].total ?? 0),
    })
  })
}
