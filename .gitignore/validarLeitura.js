function validarLeitura(dados) {
  if (
    typeof dados.temperatura !== "number" ||
    !Number.isFinite(dados.temperatura)
  ) {
    return false;
  }

  if (
    typeof dados.umidadeSolo !== "number" ||
    !Number.isFinite(dados.umidadeSolo) ||
    dados.umidadeSolo < 0 ||
    dados.umidadeSolo > 100
  ) {
    return false;
  }

  return true;
}

module.exports = { validarLeitura };