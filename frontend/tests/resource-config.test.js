import { describe, expect, it } from "vitest";
import { institutions, resourceConfig } from "@/lib/resource-config";

describe("contratos dos recursos financeiros", () => {
  it("mantém catálogo local com instituições solicitadas e Outro", () => {
    expect(institutions).toEqual(expect.arrayContaining(["Nubank", "Banco Inter", "Itaú", "Bradesco", "Santander", "Banco do Brasil", "Caixa Econômica Federal", "C6 Bank", "BTG Pactual", "XP", "PicPay", "Mercado Pago", "Neon", "Sicredi", "Sicoob", "Outro"]));
  });

  it("serializa conta com contrato da API", () => {
    const payload = resourceConfig.contas.payload({ name: "Reserva", institution: "Nubank", type: "Savings", initialBalance: "1200.50", isActive: true });
    expect(payload).toMatchObject({ name: "Reserva", institution: "Nubank", type: "Savings", initialBalance: 1200.5 });
    expect(payload).not.toHaveProperty("nome");
  });

  it("deixa explícito que valuation de investimento é manual", () => {
    expect(resourceConfig.investimentos.help).toMatch(/manualmente/i);
    expect(resourceConfig.investimentos.help).toMatch(/tempo real/i);
  });

  it("usa validação positiva para metas", () => {
    expect(() => resourceConfig.metas.schema.parse({ name: "Reserva", targetAmount: 0, deadline: "" })).toThrow();
  });
});
