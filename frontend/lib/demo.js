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
  contas: [{ id: 1, nome: "Conta Principal", detalhe: "Banco Digital · Conta corrente", valor: 12480.22, status: "Ativa" }, { id: 2, nome: "Reserva", detalhe: "Poupança", valor: 5992.61, status: "Ativa" }],
  transacoes: [{ id: 1, nome: "Supermercado", detalhe: "Alimentação · 25/09/2026", valor: -284.72, status: "Pago" }, { id: 2, nome: "Salário", detalhe: "Receita · 24/09/2026", valor: 9800, status: "Recebido" }],
  categorias: [{ id: 1, nome: "Alimentação", detalhe: "5 lançamentos", valor: 1320, status: "Ativa" }, { id: 2, nome: "Moradia", detalhe: "3 lançamentos", valor: 2450, status: "Ativa" }],
  cartoes: [{ id: 1, nome: "Nubank Platinum", detalhe: "Fecha dia 22 · vence dia 29", valor: 1842.45, status: "Aberta" }],
  transferencias: [{ id: 1, nome: "Principal → Reserva", detalhe: "20/09/2026", valor: 800, status: "Concluída" }],
  orcamentos: [{ id: 1, nome: "Alimentação", detalhe: "66% utilizado", valor: 2000, status: "No limite" }, { id: 2, nome: "Lazer", detalhe: "49% utilizado", valor: 1500, status: "Saudável" }],
  metas: [{ id: 1, nome: "Reserva de emergência", detalhe: "R$ 24.000 de R$ 36.000", valor: 66.7, status: "Em andamento" }],
  investimentos: [{ id: 1, nome: "Tesouro Selic 2029", detalhe: "Renda fixa · Corretora", valor: 42800, status: "+12,4%" }, { id: 2, nome: "ETF BOVA11", detalhe: "32 cotas", valor: 4190, status: "+6,8%" }],
  dividas: [{ id: 1, nome: "Financiamento veículo", detalhe: "18 de 36 parcelas", valor: 18400, status: "Em dia" }],
  assinaturas: [{ id: 1, nome: "Internet", detalhe: "Mensal · próxima em 02/10", valor: 119.9, status: "Ativa" }, { id: 2, nome: "Streaming", detalhe: "Mensal", valor: 39.9, status: "Ativa" }]
};
