import { describe,it,expect } from "vitest";import { money,dateBR,percent } from "@/lib/formatters";
describe("formatadores pt-BR",()=>{it("formata moeda brasileira",()=>expect(money(1234.56)).toMatch(/R\$\s?1\.234,56/));it("formata data",()=>expect(dateBR("2026-09-26")).toBe("26/09/2026"));it("formata percentual",()=>expect(percent(12.5)).toBe("12,5%"))});
