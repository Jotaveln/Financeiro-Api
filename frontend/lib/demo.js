export const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const dashboardDemo = {
  balance: 18472.83, netWorth: 128640.22, monthlyIncome: 12800, monthlyExpenses: 7942.31, monthlyResult: 4857.69, invested: 94210, debts: 18400, cardAvailable: 7600,
  cashFlow: [
    { month: "Abr", receitas: 11200, despesas: 7240 }, { month: "Mai", receitas: 11850, despesas: 8100 }, { month: "Jun", receitas: 12600, despesas: 7680 }, { month: "Jul", receitas: 11900, despesas: 8320 }, { month: "Ago", receitas: 13100, despesas: 7890 }, { month: "Set", receitas: 12800, despesas: 7942 }
  ],
  categories: [{ name: "Moradia", value: 2450 }, { name: "Alimentação", value: 1320 }, { name: "Transporte", value: 960 }, { name: "Lazer", value: 740 }, { name: "Outros", value: 2472 }],
  recent: [{ description: "Supermercado", category: "Alimentação", date: "2026-09-25", amount: -284.72 }, { description: "Salário", category: "Receita", date: "2026-09-24", amount: 9800 }, { description: "Tesouro Selic", category: "Investimento", date: "2026-09-23", amount: -1200 }],
  upcoming: [{ title: "Fatura Nubank", dueDate: "2026-09-29", amount: 1842.45 }, { title: "Internet", dueDate: "2026-10-02", amount: 119.9 }]
};
export const resources = {
  contas: [{ id: "demo-account-1", name: "Conta principal", institution: "Nubank", type: "Checking", balance: 12480.22, isActive: true }, { id: "demo-account-2", name: "Reserva", institution: "Banco do Brasil", type: "Savings", balance: 5992.61, isActive: true }],
  transacoes: [{ id: "demo-tx-1", description: "Supermercado", date: "2026-09-25", amount: 284.72, type: "Expense", status: "Paid" }, { id: "demo-tx-2", description: "Salário", date: "2026-09-24", amount: 9800, type: "Income", status: "Paid" }],
  categorias: [{ id: "demo-category-1", name: "Alimentação", type: "Expense", isActive: true }, { id: "demo-category-2", name: "Salário", type: "Income", isActive: true }],
  cartoes: [{ id: "demo-card-1", name: "Cartão principal", bank: "Nubank", brand: "Mastercard", limit: 8000, Used: 1842.45, Available: 6157.55, closingDay: 22, dueDay: 29, isActive: true }],
  transferencias: [],
  orcamentos: [{ id: "demo-budget-1", category: "Alimentação", amount: 2000, spent: 1320, available: 680, percent: 66 }, { id: "demo-budget-2", category: "Lazer", amount: 1500, spent: 735, available: 765, percent: 49 }],
  metas: [{ id: "demo-goal-1", name: "Reserva de emergência", currentAmount: 24000, targetAmount: 36000, percent: 66.7, isCompleted: false }],
  investimentos: [{ id: "demo-investment-1", asset: "Tesouro Selic 2029", type: "Treasury", quantity: 1, investedAmount: 38000, currentAmount: 42800, currentPrice: 42800, broker: "XP" }, { id: "demo-investment-2", asset: "IVVB11", type: "Etf", quantity: 32, investedAmount: 3920, currentAmount: 4190, currentPrice: 130.94, broker: "BTG Pactual" }],
  dividas: [{ id: "demo-debt-1", name: "Financiamento do veículo", principal: 22000, remaining: 18400, paidInstallments: 18, remainingInstallments: 18, nextDue: "2026-10-10" }],
  assinaturas: [{ id: "demo-subscription-1", name: "Internet", amount: 119.9, cycle: "Monthly", nextBillingDate: "2026-10-02", isActive: true }, { id: "demo-subscription-2", name: "Streaming", amount: 39.9, cycle: "Monthly", nextBillingDate: "2026-10-08", isActive: true }]
};
