import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NotificationsPopover } from "@/components/notifications-popover";

const apiMock = vi.fn();
let queryState;
const invalidate = vi.fn();
const refetch = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args) => apiMock(...args) }));
vi.mock("@/lib/demo", () => ({ demoEnabled: false }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate }),
  useQuery: () => queryState
}));

describe("popover de notifications", () => {
  beforeEach(() => {
    cleanup();
    apiMock.mockReset();
    invalidate.mockReset();
    refetch.mockReset();
    queryState = { data: [], isLoading: false, isError: false, refetch };
  });

  it("mostra unread antes da abertura e aceita envelope items", () => {
    queryState = { data: { items: [{ id: "n1", title: "Fatura", message: "Vence amanhã", isRead: false }] }, isLoading: false, isError: false, refetch };
    render(React.createElement(NotificationsPopover));
    expect(screen.getByRole("button", { name: /1 não lidas/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1 não lidas/i }));
    expect(screen.getByText("Fatura")).toBeInTheDocument();
  });

  it("marca como lida somente depois de resposta bem-sucedida", async () => {
    queryState = { data: [{ id: "n1", title: "Fatura", message: "Vence amanhã", isRead: false }], isLoading: false, isError: false, refetch };
    render(React.createElement(NotificationsPopover));
    fireEvent.click(screen.getByRole("button", { name: /1 não lidas/i }));
    apiMock.mockResolvedValue(undefined);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Marcar como lida" })));
    expect(apiMock).toHaveBeenCalledWith("/notifications/n1/read", { method: "POST" });
    expect(invalidate).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mostra carregamento, vazio e erro recuperável", () => {
    queryState = { data: [], isLoading: true, isError: false, refetch };
    const { rerender } = render(React.createElement(NotificationsPopover));
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }));
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    queryState = { data: [], isLoading: false, isError: false, refetch };
    rerender(React.createElement(NotificationsPopover));
    expect(screen.getByText("Nenhuma notificação.")).toBeInTheDocument();
    queryState = { data: [], isLoading: false, isError: true, refetch };
    rerender(React.createElement(NotificationsPopover));
    expect(screen.getByText("Não foi possível carregar as notificações.")).toBeInTheDocument();
  });

  it("não simula sucesso quando a marcação falha", async () => {
    queryState = { data: [{ id: "n1", title: "Fatura", message: "Vence amanhã", isRead: false }], isLoading: false, isError: false, refetch };
    render(React.createElement(NotificationsPopover));
    fireEvent.click(screen.getByRole("button", { name: /1 não lidas/i }));
    apiMock.mockRejectedValue(new Error("falha"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Marcar como lida" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível marcar");
    expect(invalidate).not.toHaveBeenCalled();
  });
});
