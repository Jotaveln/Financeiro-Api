import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { GlobalSearch } from "@/components/global-search";

const push = vi.fn();
const apiMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api", () => ({ api: (...args) => apiMock(...args) }));

describe("busca global", () => {
  beforeEach(() => {
    cleanup();
    apiMock.mockReset();
  });

  it("aguarda o debounce e navega com teclado", async () => {
    vi.useFakeTimers();
    apiMock.mockResolvedValue([{ type: "account", id: "1", title: "Conta principal", subtitle: "Nubank", href: "/contas" }]);
    render(React.createElement(GlobalSearch));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "conta" } });
    expect(apiMock).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(280); await Promise.resolve(); });
    expect(apiMock).toHaveBeenCalledWith(expect.stringContaining("q=conta"), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/contas");
    vi.useRealTimers();
  });

  it("não pesquisa termos com menos de dois caracteres", async () => {
    render(React.createElement(GlobalSearch));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
    await act(async () => { await Promise.resolve(); });
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("ignora resposta obsoleta e trata aborto sem erro", async () => {
    vi.useFakeTimers();
    const requests = [];
    apiMock.mockImplementation((_url, options) => new Promise((resolve, reject) => {
      requests.push({ resolve, reject, signal: options.signal });
    }));
    render(React.createElement(GlobalSearch));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ab" } });
    await act(async () => { vi.advanceTimersByTime(280); });
    fireEvent.change(input, { target: { value: "abc" } });
    await act(async () => { vi.advanceTimersByTime(280); });
    await act(async () => {
      requests[0].reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      requests[1].resolve([{ type: "account", id: "new", title: "Novo", subtitle: "", href: "/contas" }]);
      await Promise.resolve();
    });
    expect(screen.getByText("Novo")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível buscar agora.")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("fecha com Escape e mostra estado vazio", async () => {
    vi.useFakeTimers();
    apiMock.mockResolvedValue([]);
    render(React.createElement(GlobalSearch));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "zz" } });
    await act(async () => { vi.advanceTimersByTime(280); await Promise.resolve(); });
    expect(screen.getByText("Nenhum resultado encontrado.")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
