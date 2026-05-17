import { z } from "zod"

export const RegisterSchema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters"),
  email:    z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput    = z.infer<typeof LoginSchema>
