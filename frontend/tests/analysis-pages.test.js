import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportPage, SettingsPage } from "@/components/analysis-pages";

const state = vi.hoisted(() => ({
  api: vi.fn(),
  downloadFile: vi.fn(),
  invalidateQueries: vi.fn(),
  profile: { data: null, isLoading: false, isError: false, refetch: vi.fn() },
  demo: false
}));

vi.mock("@/lib/api", () => ({
  api: (...args) => state.api(...args),
  downloadFile: (...args) => state.downloadFile(...args)
}));
vi.mock("@/lib/demo", () => ({
  get demoEnabled() { return state.demo; },
  dashboardDemo: { upcoming: [] }
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => state.profile,
  useQueryClient: () => ({ invalidateQueries: state.invalidateQueries })
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  cleanup();
  state.api.mockReset();
  state.downloadFile.mockReset();
  state.invalidateQueries.mockReset();
  state.profile = { data: null, isLoading: false, isError: false, refetch: vi.fn() };
  state.demo = false;
});

describe("ImportPage", () => {
  it("envia o arquivo para preview e impede segundo envio durante loading", async () => {
    let resolve;
    state.api.mockReturnValue(new Promise((finish) => { resolve = finish; }));
    render(React.createElement(ImportPage));
    const input = screen.getByLabelText(/Selecionar arquivo CSV/i);
    const file = new File(["description,amount\nCafe,10"], "dados.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });
    const button = screen.getByRole("button", { name: "Pré-visualizar CSV" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(state.api).toHaveBeenCalledTimes(1);
    expect(button).toHaveTextContent("Analisando...");
    await act(async () => resolve({ totalPreview: 1 }));
    expect(screen.getByText("1 linhas carregadas para revisão.")).toBeInTheDocument();
  });

  it("mostra erro amigável quando o preview falha", async () => {
    state.api.mockRejectedValue(new Error("CSV inválido"));
    render(React.createElement(ImportPage));
    fireEvent.change(screen.getByLabelText(/Selecionar arquivo CSV/i), { target: { files: [new File(["x"], "dados.csv", { type: "text/csv" })] } });
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Pré-visualizar CSV" })[0]));
    expect(screen.getByRole("alert")).toHaveTextContent("CSV inválido");
  });
});

describe("SettingsPage", () => {
  it("carrega e salva perfil e preferências nos endpoints existentes", async () => {
    state.profile.data = { name: "Jota", email: "jota@example.com", settings: { currency: "BRL", culture: "pt-BR", dateFormat: "dd/MM/yyyy", theme: "system", lowBalanceThreshold: 100 } };
    state.api.mockResolvedValue(undefined);
    render(React.createElement(SettingsPage));
    await waitFor(() => expect(screen.getByDisplayValue("Jota")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Jota Silva" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(state.api).toHaveBeenCalledWith("/users/me", expect.objectContaining({ method: "PUT" })));
    expect(state.api).toHaveBeenCalledWith("/users/settings", expect.objectContaining({ method: "PUT" }));
    expect(state.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(screen.getByText(/preferências de notificações por tipo ainda não estão disponíveis/i)).toBeInTheDocument();
  });

  it("valida e envia a alteração de senha", async () => {
    state.profile.data = { name: "Jota", email: "jota@example.com", settings: {} };
    state.api.mockResolvedValue(undefined);
    render(React.createElement(SettingsPage));
    fireEvent.click(screen.getByRole("button", { name: "Alterar senha" }));
    fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: "Senha-atual1!" } });
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "Senha-nova1!" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "Senha-nova1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar nova senha" }));
    await waitFor(() => expect(state.api).toHaveBeenCalledWith("/users/change-password", expect.objectContaining({ method: "POST" })));
  });
});
