const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
let accessToken = null;
let refreshing = null;
export const setAccessToken = (token) => { accessToken = token; };
async function refresh() {
  if (!refreshing) refreshing = fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" }).then(async r => { if (!r.ok) throw new Error("Sessão expirada"); const d = await r.json(); accessToken = d.accessToken; return d; }).finally(() => { refreshing = null; });
  return refreshing;
}
export async function api(path, options = {}, retry = true) {
  const headers = { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...options.headers };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) { await refresh(); return api(path, options, false); }
  if (!response.ok) { const problem = await response.json().catch(() => ({})); const fields = problem.errors ? Object.values(problem.errors).flat().join(" ") : ""; throw new Error(fields || problem.detail || problem.title || "Não foi possível concluir a operação"); }
  if (response.status === 204) return null;
  return response.json();
}

export async function downloadFile(path, retry = true) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  const response = await fetch(`${BASE}${path}`, { headers, credentials: "include" });
  if (response.status === 401 && retry && !path.startsWith("/auth/")) { await refresh(); return downloadFile(path, false); }
  if (!response.ok) { const problem = await response.json().catch(() => ({})); throw new Error(problem.detail || problem.title || "Não foi possível baixar o arquivo"); }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = response.headers.get("content-disposition")?.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i)?.[1] || "exportacao.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
