const { converterUmidade } = require("../umidade");

describe("Conversão da umidade do solo", () => {
  test("deve retornar 0% para a leitura mínima de umidade", () => {
    expect(converterUmidade(4095)).toBe(0);
  });

  test("deve retornar 100% para a leitura máxima de umidade", () => {
    expect(converterUmidade(1500)).toBe(100);
  });

  test("deve rejeitar uma leitura inválida", () => {
    expect(() => converterUmidade(5000))
      .toThrow("Leitura inválida");
  });
});