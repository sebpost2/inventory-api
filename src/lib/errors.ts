import { FastifyReply } from "fastify"

export function notFound(reply: FastifyReply, resource = "Resource") {
  return reply.status(404).send({ error: `${resource} not found` })
}

export function conflict(reply: FastifyReply, message: string) {
  return reply.status(409).send({ error: message })
}

export function forbidden(reply: FastifyReply) {
  return reply.status(403).send({ error: "Forbidden" })
}
