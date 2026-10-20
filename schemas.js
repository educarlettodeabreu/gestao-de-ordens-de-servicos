const { z } = require("zod");

const loginSchema = z.object({
  email: z.email().max(150),
  senha: z.string().min(1)
});

const cadastroSchema = z.object({
  nome: z.string().trim().min(3).max(100),
  email: z.email().max(150),
  senha: z.string().min(8).max(72)
});

module.exports = {
  loginSchema,
  cadastroSchema
};