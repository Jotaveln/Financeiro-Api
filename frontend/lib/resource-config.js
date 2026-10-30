import { z } from "zod";

export const institutions = [
  "Nubank", "Banco Inter", "Itaú", "Bradesco", "Santander", "Banco do Brasil",
  "Caixa Econômica Federal", "C6 Bank", "BTG Pactual", "XP", "PicPay",
  "Mercado Pago", "Neon", "Sicredi", "Sicoob", "Outro",
];

export const accountTypes = [
  ["Checking", "Conta corrente"], ["Savings", "Conta poupança"], ["Digital", "Conta digital"],
  ["Wallet", "Carteira"], ["Cash", "Dinheiro"], ["Brokerage", "Conta investimento"], ["Other", "Outro"],
];
export const cardBrands = [["Visa", "Visa"], ["Mastercard", "Mastercard"], ["Elo", "Elo"], ["Amex", "American Express"], ["Hipercard", "Hipercard"], ["Other", "Outro"]];
export const investmentTypes = [
  ["Treasury", "Tesouro Direto"], ["Cdb", "CDB"], ["LciLca", "LCI/LCA"], ["Debenture", "Debênture"], ["Savings", "Poupança"],
  ["Stock", "Ação"], ["Etf", "ETF"], ["Fii", "FII"], ["Bdr", "BDR"], ["Fund", "Fundo de investimento"],
  ["Crypto", "Criptomoeda"], ["Pension", "Previdência"], ["Other", "Outro"],
];
export const debtTypes = [["Financing", "Financiamento"], ["Loan", "Empréstimo"], ["Personal", "Dívida pessoal"], ["Installment", "Parcelamento"]];
export const cycles = [["Weekly", "Semanal"], ["Monthly", "Mensal"], ["Quarterly", "Trimestral"], ["Semiannual", "Semestral"], ["Annual", "Anual"]];
export const transactionTypes = [["Income", "Receita"], ["Expense", "Despesa"]];
export const transactionStatuses = [["Pending", "Pendente"], ["Paid", "Pago"], ["Overdue", "Vencido"], ["Cancelled", "Cancelado"]];

const text = (message = "Campo obrigatório") => z.string().trim().min(1, message).max(160, "Use no máximo 160 caracteres");
const money = z.coerce.number().finite("Informe um valor válido");
const positiveMoney = money.gt(0, "Informe um valor maior que zero");
const nonNegativeMoney = money.nonnegative("Não pode ser negativo");
const day = z.coerce.number().int().min(1, "Use um dia entre 1 e 31").max(31, "Use um dia entre 1 e 31");
const date = z.string().min(1, "Informe uma data");

export const endpointByResource = {
  contas: "accounts", transacoes: "transactions", categorias: "categories", cartoes: "credit-cards",
  transferencias: "transfers", orcamentos: "budgets", metas: "goals", investimentos: "investments",
  dividas: "debts", assinaturas: "subscriptions",
};

export const resourceConfig = {
  contas: {
    title: "Contas", description: "Organize seus saldos por instituição e tipo.", action: "Nova conta", endpoint: "accounts",
    schema: z.object({ name: text("Informe o nome da conta"), institution: text("Selecione uma instituição"), type: z.string(), initialBalance: nonNegativeMoney, color: z.string().optional(), isActive: z.boolean().default(true) }),
    defaults: { name: "", institution: "Nubank", type: "Checking", initialBalance: 0, color: "#2563EB", isActive: true },
    fields: [
      { name: "name", label: "Nome ou apelido", placeholder: "Ex.: Conta principal" },
      { name: "institution", label: "Instituição", type: "institution" },
      { name: "type", label: "Tipo de conta", type: "select", options: accountTypes },
      { name: "initialBalance", label: "Saldo inicial (R$)", type: "number", min: 0, step: "0.01" },
      { name: "color", label: "Cor de identificação", type: "color" },
      { name: "isActive", label: "Conta ativa", type: "checkbox" },
    ],
    columns: [["name", "Nome"], ["institution", "Instituição"], ["type", "Tipo"], ["balance", "Saldo"]],
    payload: (v) => ({ ...v, initialBalance: Number(v.initialBalance) }),
  },
  cartoes: {
    title: "Cartões de crédito", description: "Controle limites, compras, parcelas e faturas.", action: "Novo cartão", endpoint: "credit-cards",
    schema: z.object({ name: text("Informe o nome do cartão"), bank: text("Selecione uma instituição"), brand: z.string(), limit: nonNegativeMoney, bestPurchaseDay: day, closingDay: day, dueDay: day, isActive: z.boolean().default(true) }),
    defaults: { name: "", bank: "Nubank", brand: "Mastercard", limit: 0, bestPurchaseDay: 1, closingDay: 10, dueDay: 17, isActive: true },
    fields: [
      { name: "name", label: "Nome ou apelido", placeholder: "Ex.: Cartão principal" },
      { name: "bank", label: "Instituição", type: "institution" },
      { name: "brand", label: "Bandeira", type: "select", options: cardBrands },
      { name: "limit", label: "Limite (R$)", type: "number", min: 0, step: "0.01" },
      { name: "bestPurchaseDay", label: "Melhor dia de compra", type: "number", min: 1, max: 31 },
      { name: "closingDay", label: "Dia de fechamento", type: "number", min: 1, max: 31 },
      { name: "dueDay", label: "Dia de vencimento", type: "number", min: 1, max: 31 },
      { name: "isActive", label: "Cartão ativo", type: "checkbox" },
    ],
    columns: [["name", "Cartão"], ["bank", "Instituição"], ["brand", "Bandeira"], ["limit", "Limite"]],
    payload: (v) => ({ ...v, limit: Number(v.limit), bestPurchaseDay: Number(v.bestPurchaseDay), closingDay: Number(v.closingDay), dueDay: Number(v.dueDay) }),
  },
  transferencias: {
    title: "Transferências", description: "Movimente valores entre suas próprias contas.", action: "Nova transferência", endpoint: "transfers",
    schema: z.object({ sourceAccountId: text("Selecione a conta de origem"), destinationAccountId: text("Selecione a conta de destino"), amount: positiveMoney, date, description: z.string().trim().max(200, "Use no máximo 200 caracteres").optional() }).refine((value) => value.sourceAccountId !== value.destinationAccountId, { path: ["destinationAccountId"], message: "Escolha uma conta diferente da origem" }),
    defaults: { sourceAccountId: "", destinationAccountId: "", amount: 0, date: new Date().toISOString().slice(0, 10), description: "" },
    fields: [{ name: "sourceAccountId", label: "Conta de origem", type: "account" }, { name: "destinationAccountId", label: "Conta de destino", type: "account" }, { name: "amount", label: "Valor (R$)", type: "number", min: 0.01, step: "0.01" }, { name: "date", label: "Data", type: "date" }, { name: "description", label: "Descrição", placeholder: "Ex.: Reserva mensal" }],
    columns: [["description", "Descrição"], ["date", "Data"], ["amount", "Valor"]],
    payload: (v) => ({ ...v, amount: Number(v.amount) }),
  },
  transacoes: {
    title: "Transações", description: "Acompanhe receitas e despesas em um só lugar.", action: "Nova transação", endpoint: "transactions",
    schema: z.object({ description: text("Informe a descrição"), amount: positiveMoney, type: z.string(), status: z.string(), date, accountId: text("Selecione uma conta"), categoryId: z.string().optional(), notes: z.string().max(500, "Use no máximo 500 caracteres").optional() }),
    defaults: { description: "", amount: 0, type: "Expense", status: "Paid", date: new Date().toISOString().slice(0, 10), accountId: "", categoryId: "", notes: "" },
    fields: [
      { name: "description", label: "Descrição", placeholder: "Ex.: Supermercado" },
      { name: "amount", label: "Valor (R$)", type: "number", min: 0.01, step: "0.01" },
      { name: "type", label: "Tipo", type: "select", options: transactionTypes },
      { name: "status", label: "Status", type: "select", options: transactionStatuses },
      { name: "date", label: "Data", type: "date" },
      { name: "accountId", label: "Conta", type: "account" },
      { name: "categoryId", label: "Categoria", type: "category" },
      { name: "notes", label: "Observação", type: "textarea" },
    ],
    columns: [["description", "Descrição"], ["date", "Data"], ["type", "Tipo"], ["amount", "Valor"]],
    payload: (v) => ({ ...v, amount: Number(v.amount), paidAt: v.status === "Paid" ? v.date : null, categoryId: v.categoryId || null, dueDate: null, tags: null, recurrence: "None", occurrences: 1 }),
  },
  categorias: {
    title: "Categorias", description: "Classifique lançamentos e entenda seus hábitos.", action: "Nova categoria", endpoint: "categories",
    schema: z.object({ name: text("Informe o nome da categoria"), type: z.string(), isActive: z.boolean().default(true) }),
    defaults: { name: "", type: "Expense", isActive: true },
    fields: [{ name: "name", label: "Nome", placeholder: "Ex.: Alimentação" }, { name: "type", label: "Aplica-se a", type: "select", options: transactionTypes }, { name: "isActive", label: "Categoria ativa", type: "checkbox" }],
    columns: [["name", "Categoria"], ["type", "Tipo"], ["isActive", "Status"]],
    payload: (v) => ({ ...v, color: "#64748B", icon: "tag", parentId: null }),
  },
  investimentos: {
    title: "Investimentos", description: "Acompanhe posições, custo e valores informados manualmente.", action: "Novo investimento", endpoint: "investments",
    schema: z.object({ asset: text("Informe o ativo"), type: z.string(), quantity: nonNegativeMoney, averagePrice: nonNegativeMoney, currentPrice: nonNegativeMoney, broker: z.string().max(120, "Use no máximo 120 caracteres").optional() }),
    defaults: { asset: "", type: "Treasury", quantity: 1, averagePrice: 0, currentPrice: 0, broker: "" },
    fields: [{ name: "asset", label: "Ativo ou ticker", placeholder: "Ex.: Tesouro Selic ou PETR4" }, { name: "type", label: "Tipo de investimento", type: "select", options: investmentTypes }, { name: "broker", label: "Instituição ou corretora", placeholder: "Ex.: XP" }, { name: "quantity", label: "Quantidade", type: "number", min: 0, step: "0.000001" }, { name: "averagePrice", label: "Preço médio (R$)", type: "number", min: 0, step: "0.01" }, { name: "currentPrice", label: "Valor atual informado (R$)", type: "number", min: 0, step: "0.01" }],
    help: "O valor atual é informado manualmente. Esta versão não consulta cotações em tempo real.",
    columns: [["asset", "Ativo"], ["type", "Tipo"], ["investedAmount", "Investido"], ["currentAmount", "Valor informado"]],
    payload: (v) => ({ ...v, quantity: Number(v.quantity), averagePrice: Number(v.averagePrice), currentPrice: Number(v.currentPrice), broker: v.broker || null }),
  },
  dividas: {
    title: "Dívidas e empréstimos", description: "Acompanhe saldo devedor, parcelas e vencimentos.", action: "Nova dívida", endpoint: "debts",
    schema: z.object({ name: text("Informe o credor ou descrição"), type: z.string(), principal: positiveMoney, interestRate: nonNegativeMoney, installmentCount: z.coerce.number().int().min(1, "Informe ao menos uma parcela").max(600, "Use no máximo 600 parcelas"), startDate: date }),
    defaults: { name: "", type: "Financing", principal: 0, interestRate: 0, installmentCount: 1, startDate: new Date().toISOString().slice(0, 10) },
    fields: [{ name: "name", label: "Credor ou descrição", placeholder: "Ex.: Financiamento do veículo" }, { name: "type", label: "Tipo", type: "select", options: debtTypes }, { name: "principal", label: "Valor total (R$)", type: "number", min: 0.01, step: "0.01" }, { name: "interestRate", label: "Taxa mensal informativa (%)", type: "number", min: 0, step: "0.01" }, { name: "installmentCount", label: "Número de parcelas", type: "number", min: 1, max: 600 }, { name: "startDate", label: "Data de início", type: "date" }],
    help: "A taxa é apenas informativa e o cronograma atual não simula amortização de juros.",
    columns: [["name", "Dívida"], ["installmentCount", "Parcelas"], ["remaining", "Saldo restante"], ["nextDue", "Próximo vencimento"]],
    payload: (v) => ({ ...v, principal: Number(v.principal), interestRate: Number(v.interestRate), installmentCount: Number(v.installmentCount) }),
  },
  metas: {
    title: "Metas financeiras", description: "Transforme planos em progresso mensurável.", action: "Nova meta", endpoint: "goals",
    schema: z.object({ name: text("Informe o nome da meta"), targetAmount: positiveMoney, deadline: z.string().optional() }),
    defaults: { name: "", targetAmount: 0, deadline: "" },
    fields: [{ name: "name", label: "Nome da meta", placeholder: "Ex.: Reserva de emergência" }, { name: "targetAmount", label: "Valor objetivo (R$)", type: "number", min: 0.01, step: "0.01" }, { name: "deadline", label: "Data alvo (opcional)", type: "date" }],
    columns: [["name", "Meta"], ["currentAmount", "Acumulado"], ["targetAmount", "Objetivo"], ["percent", "Progresso"]],
    payload: (v) => ({ ...v, targetAmount: Number(v.targetAmount), deadline: v.deadline || null, color: "#10B981" }),
  },
  orcamentos: {
    title: "Orçamentos", description: "Defina limites mensais por categoria.", action: "Novo orçamento", endpoint: "budgets",
    schema: z.object({ categoryId: text("Selecione uma categoria de despesa"), month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2000).max(2200), amount: positiveMoney }),
    defaults: { categoryId: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: 0 },
    fields: [{ name: "categoryId", label: "Categoria de despesa", type: "category" }, { name: "month", label: "Mês", type: "number", min: 1, max: 12 }, { name: "year", label: "Ano", type: "number", min: 2000, max: 2200 }, { name: "amount", label: "Limite planejado (R$)", type: "number", min: 0.01, step: "0.01" }],
    columns: [["category", "Categoria"], ["amount", "Planejado"], ["spent", "Realizado"], ["available", "Restante"], ["percent", "Consumido"]],
    payload: (v) => ({ ...v, month: Number(v.month), year: Number(v.year), amount: Number(v.amount) }),
  },
  assinaturas: {
    title: "Assinaturas", description: "Controle custos recorrentes e próximas cobranças.", action: "Nova assinatura", endpoint: "subscriptions",
    schema: z.object({ name: text("Informe o nome da assinatura"), amount: positiveMoney, cycle: z.string(), billingDay: day, startDate: date, accountId: z.string().optional(), categoryId: z.string().optional(), isActive: z.boolean().default(true) }),
    defaults: { name: "", amount: 0, cycle: "Monthly", billingDay: 1, startDate: new Date().toISOString().slice(0, 10), accountId: "", categoryId: "", isActive: true },
    fields: [{ name: "name", label: "Nome", placeholder: "Ex.: Internet" }, { name: "amount", label: "Valor da cobrança (R$)", type: "number", min: 0.01, step: "0.01" }, { name: "cycle", label: "Frequência", type: "select", options: cycles }, { name: "billingDay", label: "Dia da cobrança", type: "number", min: 1, max: 31 }, { name: "startDate", label: "Data inicial", type: "date" }, { name: "accountId", label: "Conta (opcional)", type: "account" }, { name: "categoryId", label: "Categoria de despesa", type: "category" }, { name: "isActive", label: "Assinatura ativa", type: "checkbox" }],
    columns: [["name", "Assinatura"], ["cycle", "Frequência"], ["amount", "Valor"], ["nextBillingDate", "Próxima cobrança"]],
    payload: (v) => ({ ...v, amount: Number(v.amount), billingDay: Number(v.billingDay), accountId: v.accountId || null, categoryId: v.categoryId || null }),
  },
};

export const fieldLabel = (options, value) => options?.find(([key]) => key === value)?.[1] || value || "—";
export const configFor = (resource) => resourceConfig[resource] || resourceConfig.contas;
