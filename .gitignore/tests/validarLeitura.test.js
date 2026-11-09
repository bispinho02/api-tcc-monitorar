const { validarLeitura } = require("../validarLeitura");

describe("Validação dos dados dos sensores", () => {
  test("deve aceitar uma leitura válida", () => {
    expect(
      validarLeitura({
        temperatura: 28,
        umidadeSolo: 65
      })
    ).toBe(true);
  });

  test("deve rejeitar uma umidade acima de 100%", () => {
    expect(
      validarLeitura({
        temperatura: 28,
        umidadeSolo: 120
      })
    ).toBe(false);
  });

  test("deve rejeitar dados incompletos", () => {
    expect(
      validarLeitura({
        temperatura: 28
      })
    ).toBe(false);
  });
});