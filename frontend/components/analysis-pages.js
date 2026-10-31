"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Upload, CalendarDays, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PageHeader } from "./page-header";
import { Modal } from "./modal";
import { money, dateBR } from "@/lib/formatters";
import { dashboardDemo, demoEnabled } from "@/lib/demo";
import { api, downloadFile } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "./states.jsx";
import { toast } from "sonner";

const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const userValue = (user, camel, pascal = camel.charAt(0).toUpperCase() + camel.slice(1)) =>
  user?.[camel] ?? user?.[pascal];

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const month = cursor.getMonth() + 1;
  const year = cursor.getFullYear();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  const q = useQuery({
    queryKey: ["calendar", start, end],
    queryFn: () => demoEnabled
      ? Promise.resolve(dashboardDemo.upcoming.map((event, index) => ({
        id: `demo-calendar-${index}`,
        sourceId: null,
        eventType: "demo",
        date: `${year}-${String(month).padStart(2, "0")}-${String(Math.min(index ? 10 : 2, endDate.getDate())).padStart(2, "0")}`,
        title: event.title,
        amount: event.amount,
        status: "upcoming",
        isPaid: false
      })))
      : api(`/calendar?from=${start}&to=${end}`)
  });
  const events = useMemo(() => {
    const grouped = {};
    (q.data || []).forEach((event) => {
      if (!event?.date) return;
      const parts = String(event.date).split("-").map(Number);
      const day = parts.length === 3 ? parts[2] : Number(String(event.date).slice(-2));
      if (!Number.isInteger(day) || day < 1 || day > 31) return;
      grouped[day] ??= [];
      grouped[day].push(event);
    });
    return grouped;
  }, [q.data]);
  const leading = new Date(year, month - 1, 1).getDay();
  const days = Array.from({ length: endDate.getDate() }, (_, i) => i + 1);
  const title = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return <>
    <PageHeader title="Calendário financeiro" description={`Vencimentos, recebimentos e faturas de ${title}.`} action={<div className="flex gap-2"><button className="icon-btn" onClick={() => setCursor(new Date(year, month - 2, 1))} aria-label="Mês anterior"><ChevronLeft size={17} /></button><button className="icon-btn" onClick={() => setCursor(new Date(year, month, 1))} aria-label="Próximo mês"><ChevronRight size={17} /></button></div>} />
    {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState message="Não foi possível carregar o calendário." onRetry={q.refetch} /> : !demoEnabled && !q.data?.length ? <EmptyState title="Nenhum evento neste mês" description="Os próximos vencimentos e cobranças aparecerão aqui." /> : <div className="card grid grid-cols-7 overflow-hidden text-center"><div className="col-span-7 grid grid-cols-7 bg-[var(--surface-2)] py-3 text-xs font-bold text-[var(--muted)]">{["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((x) => <span key={x}>{x}</span>)}</div>{Array.from({ length: leading }, (_, i) => <div key={`empty-${i}`} className="min-h-24 border p-2" style={{ borderColor: "var(--line)" }} />)}{days.map((day) => <div key={day} className="min-h-24 border p-2 text-left" style={{ borderColor: "var(--line)" }}><b className="text-sm">{day}</b>{(events[day] || []).map((event) => <div className={`mt-2 rounded-md p-1 text-[10px] font-bold ${event.isPaid || event.status === "paid" ? "bg-slate-500/10 text-[var(--muted)]" : event.status === "overdue" ? "bg-red-500/10 text-[var(--danger)]" : "bg-emerald-500/10 text-[var(--brand)]"}`} key={event.id}><span>{event.title}</span><span className="block font-normal">{event.amount != null ? money(event.amount) : event.eventType}</span><span className="block font-normal">{event.isPaid || event.status === "paid" ? "Pago" : event.status === "overdue" ? "Em atraso" : event.eventType}</span></div>)}</div>)}</div>}
  </>;
}

export function ReportsPage() {
  const [period, setPeriod] = useState("6");
  const [report, setReport] = useState(() => demoEnabled ? dashboardDemo : null);
  const [error, setError] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [retry, setRetry] = useState(0);
  const [reportReady, setReportReady] = useState(demoEnabled);
  const accounts = useQuery({ queryKey: ["accounts", "reports"], queryFn: () => api("/accounts?activeOnly=true"), enabled: !demoEnabled });
  const range = useMemo(() => {
    if (from || to) return { from, to };
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - Number(period) + 1, 1);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }, [from, to, period]);
  useEffect(() => {
    if (demoEnabled) return undefined;
    let cancelled = false;
    setError(false);
    setReport(null);
    setReportReady(false);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (accountId) params.set("accountId", accountId);
    api(`/reports/summary?${params}`).then((value) => {
      if (!cancelled) {
        setReport(value);
        setReportReady(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setReportReady(true);
        setError(true);
      }
    });
    return () => { cancelled = true; };
  }, [range.from, range.to, accountId, retry]);
  const reportRows = Array.isArray(report?.monthly) ? report.monthly : Array.isArray(report?.Monthly) ? report.Monthly : [];
  const data = reportRows.map((item, index) => ({
    month: item?.month ?? item?.Month ?? `Período ${index + 1}`,
    receitas: finiteNumber(item?.income ?? item?.Income ?? item?.receitas ?? item?.Receitas),
    despesas: finiteNumber(item?.expense ?? item?.Expense ?? item?.despesas ?? item?.Despesas)
  }));
  async function download() {
    if (demoEnabled) return;
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (accountId) params.set("accountId", accountId);
    try {
      await downloadFile(`/import-export/transactions.csv?${params.toString()}`);
    } catch {
      setError(true);
    }
  }

  return <>
    <PageHeader title="Relatórios" description="Compare períodos e encontre tendências nas suas finanças." />
    <div className="card mb-5 flex flex-wrap items-end gap-3 p-4"><label className="label w-44">Período<select className="input" value={period} onChange={(event) => { setPeriod(event.target.value); setFrom(""); setTo(""); }}><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option></select></label><label className="label w-44">De<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="label w-44">Até<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label className="label w-56">Conta<select className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Todas as contas</option>{(Array.isArray(accounts.data) ? accounts.data : Array.isArray(accounts.data?.items) ? accounts.data.items : Array.isArray(accounts.data?.Items) ? accounts.data.Items : []).map((account) => <option value={account.id ?? account.Id} key={account.id ?? account.Id}>{account.name ?? account.Name}</option>)}</select></label><button className="btn btn-secondary ml-auto" onClick={download} disabled={demoEnabled}><Download size={16} />Exportar CSV</button></div>
    {accounts.isError ? <ErrorState message="Não foi possível carregar as contas para filtrar o relatório." onRetry={accounts.refetch} /> : error ? <ErrorState message="Não foi possível carregar o relatório." onRetry={() => setRetry((value) => value + 1)} /> : !reportReady && !demoEnabled ? <LoadingState /> : !data.length ? <EmptyState title="Nenhum dado no período" description="Não há movimentações para os filtros selecionados." /> : <section className="card p-5"><h2 className="font-black">Receita x despesa</h2><p className="muted mb-5 text-sm">Resultado mensal consolidado no período selecionado</p><div className="h-80" role="img" aria-label="Gráfico de receitas e despesas por mês"><ResponsiveContainer><BarChart data={data}><CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={(value) => `${value / 1000}k`} /><Tooltip formatter={(value) => money(value)} /><Legend /><Bar dataKey="receitas" name="Receitas" fill="#087f5b" radius={[4, 4, 0, 0]} /><Bar dataKey="despesas" name="Despesas" fill="#c2410c" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead><tbody>{data.map((item) => <tr key={item.month} className="border-t text-center" style={{ borderColor: "var(--line)" }}><td className="p-2 text-left font-bold">{item.month}</td><td>{money(item.receitas)}</td><td>{money(item.despesas)}</td><td>{money(item.receitas - item.despesas)}</td></tr>)}</tbody></table></div></section>}
  </>;
}

export function ImportPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function previewFile() {
    if (!file || demoEnabled || loading) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setPreview(await api("/import-export/transactions/preview", { method: "POST", body: form }));
    } catch (requestError) {
      setError(requestError.message || "Não foi possível pré-visualizar o arquivo.");
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (demoEnabled) return;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      await downloadFile(`/import-export/transactions.csv${params.toString() ? `?${params}` : ""}`);
    } catch (requestError) {
      setError(requestError.message || "Não foi possível baixar o CSV.");
    }
  }

  return <>
    <PageHeader title="Importar e exportar" description="Leve seus dados com você usando arquivos CSV." />
    <div className="grid gap-5 lg:grid-cols-2"><section className="card p-6"><Upload className="mb-4 text-[var(--brand)]" aria-hidden="true" /><h2 className="text-xl font-black">Pré-visualização de CSV</h2><p className="muted my-2 text-sm">Envie um CSV para revisar até 100 linhas. Esta etapa apenas analisa o arquivo; a importação persistente ainda não está disponível.</p><label className="mt-5 grid cursor-pointer place-items-center rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: "var(--line)" }}><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setError(""); }} /><b>{file ? file.name : "Selecionar arquivo CSV"}</b><small className="muted mt-1">Máximo de 5 MB</small></label><button type="button" className="btn btn-primary mt-4" disabled={!file || demoEnabled || loading} onClick={previewFile}>{loading ? "Analisando..." : "Pré-visualizar CSV"}</button>{preview && <div className="mt-4 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><p className="font-bold">{preview.totalPreview ?? preview.TotalPreview ?? 0} linhas carregadas para revisão.</p><p className="muted mt-1">Nenhuma transação foi salva.</p></div>}{error && <p className="field-error mt-3" role="alert">{error}</p>}</section><section className="card p-6"><Download className="mb-4 text-[var(--brand)]" aria-hidden="true" /><h2 className="text-xl font-black">Exportar dados</h2><p className="muted my-2 text-sm">Baixe as transações ou filtre o período desejado.</p><div className="mt-5 grid gap-3"><label className="label">De<input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="label">Até<input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button type="button" className="btn btn-secondary" onClick={download} disabled={demoEnabled}><Download size={16} />Baixar CSV</button></div></section></div>
  </>;
}

export function SettingsPage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => demoEnabled ? Promise.resolve({ name: "Usuário", email: "usuario@exemplo.com", settings: {} }) : api("/users/me"), staleTime: 60000 });
  const user = profile.data;
  const settings = useMemo(() => userValue(user, "settings") || {}, [user]);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [culture, setCulture] = useState("pt-BR");
  const [dateFormat, setDateFormat] = useState("dd/MM/yyyy");
  const [theme, setTheme] = useState("system");
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState("0");
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    if (!user) return;
    setName(userValue(user, "name") || "");
    setCurrency(userValue(settings, "currency") || "BRL");
    setCulture(userValue(settings, "culture") || "pt-BR");
    setDateFormat(userValue(settings, "dateFormat") || "dd/MM/yyyy");
    setTheme(userValue(settings, "theme") || "system");
    setLowBalanceThreshold(String(userValue(settings, "lowBalanceThreshold") ?? 0));
  }, [user, settings]);

  const displayName = name || userValue(user, "name") || userValue(user, "email") || "Usuário";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((value) => value[0]).join("").toUpperCase();

  async function saveSettings(event) {
    event.preventDefault();
    const trimmedName = name.trim();
    const threshold = Number(lowBalanceThreshold);
    if (trimmedName.length < 2) {
      toast.error("Informe um nome válido.");
      return;
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      toast.error("Informe um limite de saldo válido.");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      if (!demoEnabled) {
        await api("/users/me", { method: "PUT", body: JSON.stringify({ name: trimmedName, phoneNumber: userValue(user, "phoneNumber") || null }) });
        await api("/users/settings", { method: "PUT", body: JSON.stringify({ currency, culture, dateFormat, theme, lowBalanceThreshold: threshold }) });
      }
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(demoEnabled ? "Modo demonstração — alterações não são persistidas." : "Configurações salvas.");
    } catch (requestError) {
      toast.error(requestError.message || "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (password.next.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password.next !== password.confirm) {
      toast.error("A confirmação da senha não confere.");
      return;
    }
    if (passwordSaving) return;
    setPasswordSaving(true);
    try {
      if (!demoEnabled) await api("/users/change-password", { method: "POST", body: JSON.stringify({ currentPassword: password.current, newPassword: password.next }) });
      setPassword({ current: "", next: "", confirm: "" });
      setPasswordOpen(false);
      toast.success(demoEnabled ? "Modo demonstração — alterações não são persistidas." : "Senha alterada. As outras sessões foram revogadas.");
    } catch (requestError) {
      toast.error(requestError.message || "Não foi possível alterar a senha.");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (profile.isLoading) return <><PageHeader title="Configurações" description="Personalize sua conta, preferências e segurança." /><LoadingState /></>;
  if (profile.isError) return <><PageHeader title="Configurações" description="Personalize sua conta, preferências e segurança." /><ErrorState message="Não foi possível carregar suas configurações." onRetry={profile.refetch} /></>;

  return <>
    <PageHeader title="Configurações" description="Personalize sua conta, preferências e segurança." />
    <div className="mb-5 flex items-center gap-4 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--brand-soft)] p-5"><span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--brand)] text-lg font-black text-white">{initials || "EU"}</span><div><p className="text-lg font-black">{displayName}</p><p className="text-sm text-[var(--brand-strong)]">{userValue(user, "email") || "Sua conta pessoal"}</p></div></div>
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]"><form className="card grid gap-4 p-6" onSubmit={saveSettings}><h2 className="text-xl font-black">Perfil e preferências</h2><label className="label">Nome<input className="input" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></label><label className="label">E-mail<input className="input" value={userValue(user, "email") || ""} type="email" readOnly /></label><div className="grid gap-4 sm:grid-cols-2"><label className="label">Moeda<select className="input" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="BRL">BRL — Real brasileiro</option><option value="USD">USD — Dólar americano</option><option value="EUR">EUR — Euro</option></select></label><label className="label">Cultura<select className="input" value={culture} onChange={(event) => setCulture(event.target.value)}><option value="pt-BR">Português (Brasil)</option><option value="en-US">English (United States)</option></select></label><label className="label">Formato de data<select className="input" value={dateFormat} onChange={(event) => setDateFormat(event.target.value)}><option value="dd/MM/yyyy">DD/MM/AAAA</option><option value="MM/dd/yyyy">MM/DD/YYYY</option><option value="yyyy-MM-dd">AAAA-MM-DD</option></select></label><label className="label">Tema<select className="input" value={theme} onChange={(event) => setTheme(event.target.value)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label></div><label className="label">Alerta de saldo baixo<input className="input" type="number" min="0" step="0.01" value={lowBalanceThreshold} onChange={(event) => setLowBalanceThreshold(event.target.value)} /><small className="muted">Use zero para não definir um limite.</small></label><button type="submit" className="btn btn-primary w-fit" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></form><section className="card p-6"><ShieldCheck className="mb-4 text-[var(--brand)]" aria-hidden="true" /><h2 className="text-xl font-black">Segurança</h2><p className="muted my-2 text-sm">Sua sessão usa tokens de curta duração e renovação segura.</p><button type="button" className="btn btn-secondary mt-4" onClick={() => setPasswordOpen((value) => !value)}>{passwordOpen ? "Cancelar alteração" : "Alterar senha"}</button>{passwordOpen && <form className="mt-4 grid gap-3" onSubmit={changePassword}><label className="label">Senha atual<input className="input" type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} required /></label><label className="label">Nova senha<input className="input" type="password" autoComplete="new-password" minLength={8} value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} required /></label><label className="label">Confirmar nova senha<input className="input" type="password" autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} required /></label><button type="submit" className="btn btn-primary" disabled={passwordSaving}>{passwordSaving ? "Alterando..." : "Confirmar nova senha"}</button></form>}<hr className="my-6 border-[var(--line)]" /><p className="text-sm font-bold">Notificações</p><p className="muted mt-2 text-sm">As preferências de notificações por tipo ainda não estão disponíveis. Os avisos seguem as regras padrão da conta.</p></section></div>
  </>;
}
