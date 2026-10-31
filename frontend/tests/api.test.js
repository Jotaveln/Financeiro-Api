import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function response({ status = 200, blob = new Blob(["csv"]), headers = {}, json = {} } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    blob: vi.fn().mockResolvedValue(blob),
    json: vi.fn().mockResolvedValue(json)
  };
}

describe("downloadFile", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("envia Bearer, cria o download Blob e respeita filename*", async () => {
    const { downloadFile, setAccessToken } = await import("@/lib/api");
    setAccessToken("access-token");
    globalThis.fetch.mockResolvedValue(response({ headers: { "Content-Disposition": "attachment; filename*=UTF-8''relatorio%20mensal.csv" } }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadFile("/import-export/transactions.csv?from=2026-02-01&to=2026-02-28");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/import-export/transactions.csv?from=2026-02-01&to=2026-02-28"),
      expect.objectContaining({ credentials: "include", headers: { Authorization: "Bearer access-token" } })
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    expect(document.querySelector("a")).not.toBeInTheDocument();
    click.mockRestore();
  });

  it("renova a sessão uma vez após 401 e tenta o download novamente", async () => {
    const { downloadFile, setAccessToken } = await import("@/lib/api");
    setAccessToken("expired-token");
    globalThis.fetch
      .mockResolvedValueOnce(response({ status: 401, json: { title: "Não autorizado" } }))
      .mockResolvedValueOnce(response({ json: { accessToken: "fresh-token" } }))
      .mockResolvedValueOnce(response({ headers: { "Content-Disposition": "attachment; filename=exportacao.csv" } }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadFile("/import-export/transactions.csv");

    expect(globalThis.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/auth/refresh"), expect.objectContaining({ method: "POST", credentials: "include" }));
    expect(globalThis.fetch).toHaveBeenNthCalledWith(3, expect.stringContaining("/import-export/transactions.csv"), expect.objectContaining({ headers: { Authorization: "Bearer fresh-token" } }));
    click.mockRestore();
  });

  it("retorna erro amigável quando o download falha", async () => {
    const { downloadFile } = await import("@/lib/api");
    globalThis.fetch.mockResolvedValue(response({ status: 500, json: { detail: "Exportação indisponível" } }));

    await expect(downloadFile("/import-export/transactions.csv")).rejects.toThrow("Exportação indisponível");
  });
});
