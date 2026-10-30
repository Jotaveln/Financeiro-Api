function valueOf(source, name) {
  if (!source) return undefined;
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  return source[name] ?? source[pascal];
}

export function normalizeDashboard(data = {}) {
  const cashFlow = valueOf(data, "cashFlow") || [];
  const categories = valueOf(data, "byCategory") || valueOf(data, "categories") || [];
  const recent = valueOf(data, "recent") || [];
  const upcoming = valueOf(data, "upcoming") || [];

  return {
    balance: valueOf(data, "balance") ?? 0,
    netWorth: valueOf(data, "netWorth") ?? 0,
    monthlyIncome: valueOf(data, "monthIncome") ?? valueOf(data, "monthlyIncome") ?? 0,
    monthlyExpenses: valueOf(data, "monthExpense") ?? valueOf(data, "monthlyExpense") ?? 0,
    monthlyResult: valueOf(data, "monthlyResult") ?? 0,
    invested: valueOf(data, "investments") ?? valueOf(data, "invested") ?? 0,
    cardAvailable: valueOf(data, "availableCardLimit") ?? valueOf(data, "cardAvailable") ?? 0,
    cashFlow: cashFlow.map((item) => ({
      month: valueOf(item, "month") ?? "",
      receitas: valueOf(item, "income") ?? valueOf(item, "receitas") ?? 0,
      despesas: valueOf(item, "expense") ?? valueOf(item, "despesas") ?? 0
    })),
    categories: categories.map((item) => ({
      name: valueOf(item, "name") ?? valueOf(item, "category") ?? "Outros",
      value: valueOf(item, "value") ?? 0
    })),
    recent: recent.map((item) => ({
      id: valueOf(item, "id"),
      description: valueOf(item, "description") ?? "Movimentação",
      amount: valueOf(item, "amount") ?? 0,
      date: valueOf(item, "date"),
      category: valueOf(item, "category")
    })),
    upcoming: upcoming.map((item) => ({
      sourceId: valueOf(item, "sourceId"),
      title: valueOf(item, "title") ?? "Vencimento",
      dueDate: valueOf(item, "dueDate"),
      amount: valueOf(item, "amount") ?? 0,
      eventType: valueOf(item, "eventType")
    }))
  };
}
