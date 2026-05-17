import { createClient } from "@libsql/client"

if (!process.env.TURSO_URL) throw new Error("TURSO_URL is required")

export const db = createClient({
  url:       process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
})
