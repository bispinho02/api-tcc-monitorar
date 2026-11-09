function converterUmidade(leitura) {
  const leituraMinima = 4095;
  const leituraMaxima = 1500;

  if (leitura < 0 || leitura > 4095) {
    throw new Error("Leitura inválida");
  }

  const porcentagem =
    ((leituraMinima - leitura) /
      (leituraMinima - leituraMaxima)) * 100;

  return Math.max(0, Math.min(100, porcentagem));
}

module.exports = { converterUmidade };