import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard";

const state = vi.hoisted(() => ({
  api: vi.fn(),
  invalidate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  queryState: {}
}));

vi.mock("@/lib/api", () => ({ api: (...args) => state.api(...args) }));
vi.mock("@/lib/demo", () => ({ demoEnabled: false, dashboardDemo: {} }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
  useQuery: ({ queryKey }) => state.queryState[queryKey.join(":")] || { data: [], isLoading: false, isError: false, refetch: vi.fn() }
}));
vi.mock("recharts", () => {
  const Chart = ({ children }) => React.createElement("div", null, children);
  const Leaf = () => null;
  return { ResponsiveContainer: Chart, AreaChart: Chart, Area: Leaf, CartesianGrid: Leaf, XAxis: Leaf, YAxis: Leaf, Tooltip: Leaf, Legend: Leaf, BarChart: Chart, Bar: Leaf };
});

const dashboard = {
  balance: 1000,
  netWorth: 1000,
  monthIncome: 2000,
  monthExpense: 1000,
  investments: 0,
  availableCardLimit: 3000,
  cashFlow: [],
  byCategory: [],
  recent: [],
  upcoming: []
};
const accounts = [{ id: "account-1", name: "Conta principal" }];
const categories = [
  { id: "expense-category", name: "Alimentação", type: "Expense", isActive: true },
  { id: "income-category", name: "Salário", type: "Income", isActive: true }
];

function setQueries(overrides = {}) {
  state.queryState = {
    dashboard: { data: dashboard, isLoading: false, isError: false, refetch: vi.fn() },
    "accounts:form": { data: accounts, isLoading: false, isError: false, refetch: vi.fn() },
    "categories:form": { data: categories, isLoading: false, isError: false, refetch: vi.fn() },
    ...overrides
  };
}

beforeEach(() => {
  cleanup();
  state.api.mockReset();
  state.invalidate.mockReset();
  state.success.mockReset();
  state.error.mockReset();
  setQueries();
});

describe("dashboard — nova transação", () => {
  it("abre modal, alterna receita/despesa e filtra categorias", () => {
    render(React.createElement(Dashboard));
    fireEvent.click(screen.getByRole("button", { name: /Nova transação/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo")).toHaveValue("Expense");
    expect(screen.getByRole("option", { name: "Alimentação" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Salário" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "Income" } });
    expect(screen.getByRole("option", { name: "Salário" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alimentação" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Conta principal" })).toBeInTheDocument();
  });

  it("valida campos obrigatórios e envia com estado desabilitado e invalidação", async () => {
    render(React.createElement(Dashboard));
    fireEvent.click(screen.getByRole("button", { name: /Nova transação/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar transação" }));
    expect(state.api).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Salvar transação" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Supermercado" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "account-1" } });
    state.api.mockResolvedValueOnce({});
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar transação" })));
    expect(state.api).toHaveBeenCalledWith("/transactions", expect.objectContaining({ method: "POST", body: expect.stringContaining('"description":"Supermercado"') }));
    expect(state.success).toHaveBeenCalledWith("Transação adicionada");
    expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    expect(state.invalidate).toHaveBeenCalledWith({ queryKey: ["transacoes"] });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("desabilita durante envio, impede duplicidade e mostra erro", async () => {
    render(React.createElement(Dashboard));
    fireEvent.click(screen.getByRole("button", { name: /Nova transação/ }));
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Conta de luz" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "account-1" } });
    let resolve;
    const request = new Promise((res) => { resolve = res; });
    state.api.mockReturnValue(request);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar transação" })));
    expect(state.api).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvando..." }));
    expect(state.api).toHaveBeenCalledTimes(1);
    await act(async () => resolve({}));

    fireEvent.click(screen.getByRole("button", { name: /Nova transação/ }));
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Falha" } });
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "account-1" } });
    state.api.mockRejectedValueOnce(new Error("falha de rede"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar transação" })));
    await waitFor(() => expect(state.error).toHaveBeenCalledWith("falha de rede"));
  });

  it("mostra loading e erro do dashboard com retry", () => {
    const refetch = vi.fn();
    const { rerender } = render(React.createElement(Dashboard));
    state.queryState = { dashboard: { data: null, isLoading: true, isError: false, refetch } };
    rerender(React.createElement(Dashboard));
    expect(screen.getByLabelText("Carregando conteúdo")).toBeInTheDocument();
    state.queryState = { dashboard: { data: null, isLoading: false, isError: true, refetch } };
    rerender(React.createElement(Dashboard));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalled();
  });
});
