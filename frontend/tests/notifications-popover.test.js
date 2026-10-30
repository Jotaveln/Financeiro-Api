import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NotificationsPopover } from "@/components/notifications-popover";

const apiMock = vi.fn();
let queryData = [];
const invalidate = vi.fn();
const refetch = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...args) => apiMock(...args) }));
vi.mock("@/lib/demo", () => ({ demoEnabled: false }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate }),
  useQuery: () => ({ data: queryData, isLoading: false, isError: false, refetch })
}));

describe("popover de notifications", () => {
  beforeEach(() => { cleanup(); apiMock.mockReset(); invalidate.mockReset(); refetch.mockReset(); });

  it("mostra unread antes da abertura e aceita envelope items", () => {
    apiMock.mockReturnValue({ items: [{ id: "n1", title: "Fatura", message: "Vence amanhã", isRead: false }] });
    render(React.createElement(NotificationsPopover));
    expect(screen.getByRole("button", { name: /1 não lidas/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1 não lidas/i }));
    expect(screen.getByText("Fatura")).toBeInTheDocument();
  });

  it("mostra vazio e permite marcar como lida", async () => {
    apiMock.mockReturnValue([{ id: "n1", title: "Fatura", message: "Vence amanhã", isRead: false }]);
    render(React.createElement(NotificationsPopover));
    fireEvent.click(screen.getByRole("button", { name: /1 não lidas/i }));
    apiMock.mockResolvedValue(undefined);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Marcar como lida" })));
    expect(apiMock).toHaveBeenCalledWith("/notifications/n1/read", { method: "POST" });
    expect(invalidate).toHaveBeenCalled();
  });
});
