import { describe, expect, it } from "vitest";
import { normalizeDashboard } from "@/components/dashboard-normalizers";

describe("normalização do dashboard", () => {
  it("aceita o contrato camelCase da API", () => {
    expect(normalizeDashboard({
      monthIncome: 100,
      monthExpense: 40,
      availableCardLimit: 500,
      cashFlow: [{ month: "10/2026", income: 100, expense: 40 }],
      byCategory: [{ name: "Casa", value: 40 }],
      recent: [{ id: "tx-1", description: "Conta", amount: -40, date: "2026-10-01" }],
      upcoming: [{ sourceId: "tx-2", title: "Fatura", dueDate: "2026-10-10", amount: 20 }]
    })).toMatchObject({ monthlyIncome: 100, monthlyExpenses: 40, cardAvailable: 500, categories: [{ name: "Casa", value: 40 }], recent: [{ amount: -40 }], upcoming: [{ title: "Fatura" }] });
  });

  it("aceita o contrato PascalCase sem espalhar fallback no componente", () => {
    expect(normalizeDashboard({
      MonthIncome: 100,
      MonthExpense: 40,
      AvailableCardLimit: 500,
      CashFlow: [{ Month: "10/2026", Income: 100, Expense: 40 }],
      ByCategory: [{ Name: "Casa", Value: 40 }],
      Recent: [{ Id: "tx-1", Description: "Conta", Amount: -40, Date: "2026-10-01", Category: "Casa" }],
      Upcoming: [{ SourceId: "tx-2", Title: "Fatura", DueDate: "2026-10-10", Amount: 20 }]
    })).toMatchObject({ monthlyIncome: 100, monthlyExpenses: 40, cardAvailable: 500, cashFlow: [{ receitas: 100, despesas: 40 }], recent: [{ description: "Conta", category: "Casa" }], upcoming: [{ dueDate: "2026-10-10" }] });
  });
});
