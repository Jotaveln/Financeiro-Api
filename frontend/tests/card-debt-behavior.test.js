import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardPage } from "@/components/card-page";
import { DebtPage } from "@/components/debt-page";

const { apiMock, invalidate, toast } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  invalidate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() }
}));
let screenMode = "card";
let queryState = {};
vi.mock("@/lib/api", () => ({ api: (...args) => apiMock(...args) }));
vi.mock("@/lib/demo", () => ({ demoEnabled: false, resources: {} }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate }),
  useQuery: ({ queryKey }) => queryState[queryKey.join(":")] || { data: [], isLoading: false, isError: false, refetch: vi.fn() }
}));

const account = { id: "account-1", name: "Conta principal", isActive: true };
const card = { id: "card-1", name: "Cartão principal", bank: "Banco", brand: "Visa", limit: 3000, used: 200, available: 2800, isActive: true };
const invoice = { id: "invoice-1", month: 10, year: 2026, closingDate: "2026-10-10", dueDate: "2026-10-17", status: "Open", total: 200, installments: [{ id: "card-installment-1", number: 1, total: 2, amount: 100 }, { id: "card-installment-2", number: 2, total: 2, amount: 100 }] };
const debt = { id: "debt-1", name: "Financiamento", principal: 1000, paid: 400, remaining: 600, paidInstallments: 1, remainingInstallments: 1 };
const debtDetail = { ...debt, installments: [{ id: "debt-installment-1", number: 1, amount: 600, dueDate: "2099-10-10", paidAt: null, isOverdue: false }] };

function setCardQueries(overrides = {}) {
  queryState = {
    cartoes: { data: [card], isLoading: false, isError: false, refetch: vi.fn() },
    "accounts:card-workflow": { data: [account], isLoading: false, isError: false, refetch: vi.fn() },
    "categories:card-workflow": { data: [], isLoading: false, isError: false, refetch: vi.fn() },
    "credit-card:card-1": { data: { ...card, invoices: [invoice] }, isLoading: false, isError: false, refetch: vi.fn() },
    ...overrides
  };
}

function setDebtQueries(overrides = {}) {
  queryState = {
    dividas: { data: [debt], isLoading: false, isError: false, refetch: vi.fn() },
    "accounts:debt-workflow": { data: [account], isLoading: false, isError: false, refetch: vi.fn() },
    "debt:debt-1": { data: debtDetail, isLoading: false, isError: false, refetch: vi.fn() },
    ...overrides
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  cleanup();
  apiMock.mockReset();
  invalidate.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  screenMode = "card";
  setCardQueries();
});

describe("cartões — comportamento", () => {
  it("cobre loading, erro, vazio e limite utilizado/disponível", () => {
    queryState = { cartoes: { data: [], isLoading: true, isError: false, refetch: vi.fn() } };
    const { rerender } = render(React.createElement(CardPage));
    expect(screen.getByLabelText("Carregando conteúdo")).toBeInTheDocument();

    queryState = { cartoes: { data: [], isLoading: false, isError: true, refetch: vi.fn() } };
    rerender(React.createElement(CardPage));
    expect(screen.getByText("Não foi possível carregar os cartões.")).toBeInTheDocument();

    queryState = { cartoes: { data: [], isLoading: false, isError: false, refetch: vi.fn() } };
    rerender(React.createElement(CardPage));
    expect(screen.getByText("Nenhum cartão cadastrado")).toBeInTheDocument();

    setCardQueries();
    rerender(React.createElement(CardPage));
    expect(screen.getByText("Cartão principal")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cartão principal/ }));
    expect(screen.getAllByText(/2\.800,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/200,00/).length).toBeGreaterThan(0);
  });

  it("cria cartão, registra compra parcelada e invalida consultas", async () => {
    render(React.createElement(CardPage));
    fireEvent.click(screen.getByRole("button", { name: "Novo cartão" }));
    fireEvent.change(screen.getByLabelText("Nome ou apelido"), { target: { value: "Cartão novo" } });
    fireEvent.change(screen.getByLabelText("Instituição"), { target: { value: "Banco novo" } });
    fireEvent.change(screen.getByLabelText("Limite (R$)"), { target: { value: "2500" } });
    apiMock.mockResolvedValue({});
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar cartão" })));
    expect(apiMock).toHaveBeenCalledWith("/credit-cards", expect.objectContaining({ method: "POST" }));
    expect(toast.success).toHaveBeenCalledWith("Cartão criado");

    fireEvent.click(screen.getByRole("button", { name: /Cartão principal/ }));
    fireEvent.click(screen.getByRole("button", { name: /Nova compra/ }));
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Notebook" } });
    fireEvent.change(screen.getByLabelText("Valor total (R$)"), { target: { value: "1200" } });
    fireEvent.change(screen.getByLabelText("Parcelas"), { target: { value: "3" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Registrar compra" })));
    expect(apiMock).toHaveBeenCalledWith("/credit-cards/card-1/purchases", expect.objectContaining({ method: "POST", body: expect.stringContaining('"installmentCount":3') }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["credit-card", "card-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("lista faturas, paga, impede duplicidade enquanto aguarda e trata erro", async () => {
    render(React.createElement(CardPage));
    fireEvent.click(screen.getByRole("button", { name: /Cartão principal/ }));
    expect(screen.getByText("Fatura 10/2026")).toBeInTheDocument();
    expect(screen.getByText("Parcela 1/2")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Pagar fatura" })[0]);
    fireEvent.change(screen.getByLabelText("Conta de pagamento"), { target: { value: "account-1" } });
    const request = deferred();
    apiMock.mockReturnValue(request.promise);
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Pagar fatura" })[1]));
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Processando..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Processando..." }));
    expect(apiMock).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve({}));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["transacoes"] });

    fireEvent.click(screen.getByRole("button", { name: /Cartão principal/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Pagar fatura" })[0]);
    apiMock.mockRejectedValueOnce(new Error("falha de pagamento"));
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Conta de pagamento"), { target: { value: "account-1" } });
      fireEvent.click(screen.getAllByRole("button", { name: "Pagar fatura" })[1]);
    });
    expect(toast.error).toHaveBeenCalledWith("falha de pagamento");
  });
});

describe("dívidas — comportamento", () => {
  beforeEach(() => { screenMode = "debt"; setDebtQueries(); });

  it("cobre loading, erro, vazio, progresso, cronograma e próxima parcela", () => {
    queryState = { dividas: { data: [], isLoading: true, isError: false, refetch: vi.fn() } };
    const { rerender } = render(React.createElement(DebtPage));
    expect(screen.getByLabelText("Carregando conteúdo")).toBeInTheDocument();

    queryState = { dividas: { data: [], isLoading: false, isError: true, refetch: vi.fn() } };
    rerender(React.createElement(DebtPage));
    expect(screen.getByText("Não foi possível carregar as dívidas.")).toBeInTheDocument();

    queryState = { dividas: { data: [], isLoading: false, isError: false, refetch: vi.fn() } };
    rerender(React.createElement(DebtPage));
    expect(screen.getByText("Nenhuma dívida cadastrada")).toBeInTheDocument();

    setDebtQueries();
    rerender(React.createElement(DebtPage));
    fireEvent.click(screen.getByRole("button", { name: /Financiamento/ }));
    expect(screen.getByText("Parcela 1")).toBeInTheDocument();
    expect(screen.getAllByText(/600,00/).length).toBeGreaterThan(0);
    expect(screen.getByText("Vencimento: 10/10/2099")).toBeInTheDocument();
  });

  it("paga parcela usando conta ativa, impede duplicidade e invalida consultas", async () => {
    render(React.createElement(DebtPage));
    fireEvent.click(screen.getByRole("button", { name: /Financiamento/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pagar" }));
    fireEvent.change(screen.getByLabelText("Conta de pagamento"), { target: { value: "account-1" } });
    const request = deferred();
    apiMock.mockReturnValue(request.promise);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pagar parcela" })));
    expect(apiMock).toHaveBeenCalledWith("/debts/debt-1/installments/debt-installment-1/pay", expect.objectContaining({ method: "POST", body: expect.stringContaining('"accountId":"account-1"') }));
    expect(screen.getByRole("button", { name: "Processando..." })).toBeDisabled();
    expect(apiMock).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve({ transactionId: "tx-1" }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["debt", "debt-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["calendar"] });
  });
});
