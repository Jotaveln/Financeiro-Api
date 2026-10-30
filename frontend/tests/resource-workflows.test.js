import { describe, expect, it } from "vitest";
import { resources } from "@/lib/demo";
import { resourceConfig } from "@/lib/resource-config";

describe("fluxos financeiros", () => {
  it("mantém os recursos de cartão e dívida em shape de API", () => {
    expect(resources.cartoes[0]).toMatchObject({ limit: expect.any(Number), closingDay: expect.any(Number), dueDay: expect.any(Number) });
    expect(resources.dividas[0]).toMatchObject({ principal: expect.any(Number), remaining: expect.any(Number) });
  });

  it("mantém a taxa da dívida informativa", () => {
    expect(resourceConfig.dividas.help).toMatch(/informativa/i);
    expect(resourceConfig.dividas.help).toMatch(/não simula/i);
  });
});
