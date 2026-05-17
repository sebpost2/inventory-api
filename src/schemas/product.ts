import { z } from "zod"

export const ProductSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price:       z.number().nonnegative(),
  stock:       z.number().int().nonnegative().default(0),
  sku:         z.string().max(100).optional(),
  category_id: z.string().optional(),
})

export const StockAdjustSchema = z.object({
  adjustment: z.number().int(),
  reason:     z.string().min(1).max(200),
})

export const ProductQuerySchema = z.object({
  search:      z.string().optional(),
  category_id: z.string().optional(),
  low_stock:   z.coerce.boolean().optional(),
  page:        z.coerce.number().int().positive().default(1),
  limit:       z.coerce.number().int().positive().max(100).default(20),
})

export type ProductInput    = z.infer<typeof ProductSchema>
export type StockAdjustInput = z.infer<typeof StockAdjustSchema>
export type ProductQuery    = z.infer<typeof ProductQuerySchema>
