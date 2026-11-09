const request = require("supertest");
const app = require("../app");

describe("Rota de consulta de leituras", () => {
  test("deve retornar status HTTP 200", async () => {
    const resposta = await request(app).get("/leituras");

    expect(resposta.status).toBe(200);
  });

  test("deve retornar uma lista de leituras", async () => {
    const resposta = await request(app).get("/leituras");

    expect(Array.isArray(resposta.body)).toBe(true);
  });
});