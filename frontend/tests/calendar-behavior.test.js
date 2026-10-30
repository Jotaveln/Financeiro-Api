import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CalendarPage, ReportsPage } from "@/components/analysis-pages";

const state = vi.hoisted(() => ({
  api: vi.fn(),
  refetch: vi.fn(),
  demoMode: false,
  queryState: {},
  queryConfigs: [],
  open: vi.fn()
}));

vi.mock("@/lib/api", () => ({ api: (...args) => state.api(...args) }));
vi.mock("@/lib/demo", () => ({
  get demoEnabled() { return state.demoMode; },
  dashboardDemo: {
    upcoming: [{ title: "Evento demo", amount: 0 }],
    cashFlow: [{ month: "Out", income: 100, expense: 0 }]
  }
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options) => {
    state.queryConfigs.push(options);
    return state.queryState[options.queryKey.join(":")] || state.queryState[options.queryKey[0]] || { data: [], isLoading: false, isError: false, refetch: state.refetch };
  }
}));
vi.mock("recharts", () => {
  const Chart = ({ children }) => React.createElement("div", null, children);
  const Leaf = () => null;
  const Tooltip = ({ formatter }) => formatter
    ? React.createElement("span", { "data-testid": "tooltip-values" }, formatter(1200, "Receitas"), " | ", formatter(450, "Despesas"))
    : null;
  return {
    ResponsiveContainer: Chart,
    BarChart: Chart,
    Bar: Leaf,
    CartesianGrid: Leaf,
    XAxis: Leaf,
    YAxis: Leaf,
    Tooltip,
    Legend: Leaf
  };
});

const event = (overrides = {}) => ({
  id: "invoice-1",
  sourceId: "invoice-1",
  eventType: "invoice",
  date: "2026-10-12",
  title: "Fatura do cartão",
  amount: 0,
  status: "upcoming",
  isPaid: false,
  ...overrides
});

function setCalendarQuery(overrides = {}) {
  state.queryState = {
    ...state.queryState,
    ...overrides
  };
}

beforeEach(() => {
  cleanup();
  state.api.mockReset();
  state.refetch.mockReset();
  state.queryConfigs = [];
  state.queryState = {};
  state.demoMode = false;
  state.open.mockReset();
  window.open = state.open;
});

describe("calendário financeiro — comportamento", () => {
  it("consulta o mês atual na API e renderiza fatura, dívida, assinatura, zero, pago, atrasado e ignora data inválida", async () => {
    setCalendarQuery({
      calendar: {
        data: [
          event(),
          event({ id: "debt-1", title: "Parcela da dívida", eventType: "debt", date: "2026-10-15", amount: 100 }),
          event({ id: "subscription-1", title: "Assinatura", eventType: "subscription", date: "2026-10-18", amount: 39.9 }),
          event({ id: "paid-1", title: "Evento pago", eventType: "invoice", date: "2026-10-20", status: "paid", isPaid: true }),
          event({ id: "overdue-1", title: "Evento atrasado", eventType: "debt", date: "2026-10-21", status: "overdue" }),
          event({ id: "invalid-1", title: "Data inválida", eventType: "debt", date: "not-a-date" })
        ],
        isLoading: false,
        isError: false,
        refetch: state.refetch
      }
    });
    render(React.createElement(CalendarPage));

    expect(screen.getByText("Fatura do cartão")).toBeInTheDocument();
    expect(screen.getByText("Parcela da dívida")).toBeInTheDocument();
    expect(screen.getByText("Assinatura")).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(screen.getByText("Em atraso")).toBeInTheDocument();
    expect(screen.queryByText("Data inválida")).not.toBeInTheDocument();
    expect(screen.getAllByText(/0,00/).length).toBeGreaterThan(0);

    const calendarQuery = state.queryConfigs.find((query) => query.queryKey[0] === "calendar");
    state.api.mockResolvedValue([]);
    await expect(calendarQuery.queryFn()).resolves.toEqual([]);
    expect(state.api).toHaveBeenCalledWith(expect.stringMatching(/^\/calendar\?from=\d{4}-\d{2}-01&to=\d{4}-\d{2}-\d{2}$/));

      const eventTexts = ["Fatura do cartão", "Parcela da dívida", "Assinatura", "Evento pago", "Evento atrasado"];
    expect(new Set(eventTexts).size).toBe(eventTexts.length);
  });

  it("navega para o mês anterior e próximo", () => {
    setCalendarQuery({ calendar: { data: [], isLoading: false, isError: false, refetch: state.refetch } });
    render(React.createElement(CalendarPage));
    const month = screen.getByText(/2026|2025/);
    expect(month).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByRole("button", { name: "Mês anterior" })).toBeInTheDocument();
  });

  it("mostra loading, vazio e erro com retry", () => {
    setCalendarQuery({ calendar: { data: [], isLoading: true, isError: false, refetch: state.refetch } });
    const { rerender } = render(React.createElement(CalendarPage));
    expect(screen.getByLabelText("Carregando conteúdo")).toBeInTheDocument();

    setCalendarQuery({ calendar: { data: [], isLoading: false, isError: false, refetch: state.refetch } });
    rerender(React.createElement(CalendarPage));
    expect(screen.getByText("Nenhum evento neste mês")).toBeInTheDocument();

    setCalendarQuery({ calendar: { data: [], isLoading: false, isError: true, refetch: state.refetch } });
    rerender(React.createElement(CalendarPage));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it("usa eventos demo sem chamar a API", async () => {
    state.demoMode = true;
    setCalendarQuery({ calendar: { data: undefined, isLoading: false, isError: false, refetch: state.refetch } });
    render(React.createElement(CalendarPage));
    const demoQuery = state.queryConfigs.find((query) => query.queryKey[0] === "calendar");
    const demoEvents = await demoQuery.queryFn();
    expect(demoEvents[0]).toMatchObject({ title: "Evento demo", amount: 0 });
    expect(state.api).not.toHaveBeenCalled();
  });
});

describe("relatórios — comportamento", () => {
  const report = {
    monthly: [
      { month: "Out", income: 1200, expense: 450 },
      { month: "Nov", income: 0, expense: 80 }
    ]
  };
  const accounts = [{ id: "account-1", name: "Conta principal" }];

  beforeEach(() => {
    state.queryState = {
      "accounts:reports": { data: accounts, isLoading: false, isError: false, refetch: state.refetch }
    };
    state.api.mockResolvedValue(report);
  });

  it("mantém o formatter do gráfico seguro quando o Recharts envia o nome da série", async () => {
    render(React.createElement(ReportsPage));
    await waitFor(() => expect(screen.getByText("Receita x despesa")).toBeInTheDocument());
    expect(screen.getByTestId("tooltip-values")).toHaveTextContent(/R\$\s?1\.200,00/);
    expect(screen.getByTestId("tooltip-values")).toHaveTextContent(/R\$\s?450,00/);
  });

  it("envia from, to e accountId, mostra resumo, gráfico e tabela", async () => {
    render(React.createElement(ReportsPage));
    await waitFor(() => expect(screen.getByText("Receita x despesa")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "account-1" } });
    await waitFor(() => expect(state.api).toHaveBeenCalledWith(expect.stringContaining("from=2026-01-01")));
    expect(state.api).toHaveBeenCalledWith(expect.stringContaining("to=2026-12-31"));
    expect(state.api).toHaveBeenCalledWith(expect.stringContaining("accountId=account-1"));
    expect(screen.getByRole("img", { name: "Gráfico de receitas e despesas por mês" })).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.getByText("Receita x despesa")).toBeInTheDocument();
    expect(screen.getAllByText(/750,00/).length).toBeGreaterThan(0);
  });

  it("mantém todas as contas e exporta CSV com os filtros ativos", async () => {
    render(React.createElement(ReportsPage));
    await waitFor(() => expect(screen.getByText("Receita x despesa")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-02-28" } });
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(state.open).toHaveBeenCalledWith(expect.stringContaining("from=2026-02-01"), "_blank");
    expect(state.open).toHaveBeenCalledWith(expect.stringContaining("to=2026-02-28"), "_blank");
    expect(screen.getByRole("option", { name: "Todas as contas" })).toBeInTheDocument();
  });

  it("protege a renderização quando o relatório vem nulo, PascalCase ou sem monthly", async () => {
    state.queryState["accounts:reports"] = { data: { Items: [{ Id: "account-1", Name: "Conta principal" }] }, isLoading: false, isError: false, refetch: state.refetch };
    state.api.mockResolvedValue({ Monthly: [{ Month: "Out", Income: "100", Expense: null }] });
    render(React.createElement(ReportsPage));
    await waitFor(() => expect(screen.getByText("Out")).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Conta principal" })).toBeInTheDocument();
  });

  it("mostra erro de contas e permite retry do relatório", async () => {
    state.queryState["accounts:reports"] = { data: [], isLoading: false, isError: true, refetch: state.refetch };
    render(React.createElement(ReportsPage));
    expect(screen.getByText("Não foi possível carregar as contas para filtrar o relatório.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(state.refetch).toHaveBeenCalled();

    cleanup();
    state.queryState["accounts:reports"] = { data: accounts, isLoading: false, isError: false, refetch: state.refetch };
    state.api.mockReset();
    state.api.mockRejectedValueOnce(new Error("falha"));
    render(React.createElement(ReportsPage));
    await waitFor(() => expect(screen.getByText("Não foi possível carregar o relatório.")).toBeInTheDocument());
    state.api.mockResolvedValue(report);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByText("Receita x despesa")).toBeInTheDocument());
  });
});
