function validar(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);

    if (!resultado.success) {
      return res.status(400).json({
        erro: "Dados inválidos"
      });
    }

    req.body = resultado.data;

    next();
  };
}

module.exports = validar;