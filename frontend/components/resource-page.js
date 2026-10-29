"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, Pencil, Trash2, Info } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { demoEnabled, resources } from "@/lib/demo";
import { dateBR, money, percent, quantity } from "@/lib/formatters";
import { configFor, fieldLabel, institutions, endpointByResource } from "@/lib/resource-config";
import { PageHeader } from "./page-header";
import { Modal } from "./modal";
import { EmptyState, ErrorState, LoadingState } from "./states";

const asArray = (value) => value?.items || value || [];
const labelFor = (field, value) => fieldLabel(field.options, value);

function Field({ field, register, errors, accounts, categories, watch, setValue }) {
  const error = errors[field.name];
  const current = watch(field.name);
  const options = field.type === "account"
    ? accounts.map((x) => [x.id, x.name])
    : field.type === "category"
      ? categories.filter((x) => x.type === "Expense").map((x) => [x.id, x.name])
      : field.options;
  if (field.type === "checkbox") return <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" {...register(field.name)} />{field.label}</label>;
  if (field.type === "color") return <label className="label">{field.label}<input className="h-11 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-transparent p-1" type="color" {...register(field.name)} /></label>;
  if (field.type === "textarea") return <label className="label">{field.label}<textarea className="input min-h-24" placeholder={field.placeholder} {...register(field.name)} />{error && <small className="field-error">{error.message}</small>}</label>;
  if (field.type === "institution") return <>
    <label className="label">{field.label}<select className="input" {...register(field.name)}>{institutions.map((item) => <option key={item} value={item}>{item}</option>)}</select>{error && <small className="field-error">{error.message}</small>}</label>
    {current === "Outro" && <label className="label">Nome da instituição<input className="input" placeholder="Digite o nome da instituição" {...register("customInstitution")} /></label>}
  </>;
  if (field.type === "select" || field.type === "account" || field.type === "category") return <label className="label">{field.label}<select className="input" {...register(field.name)}><option value="">Selecione</option>{options?.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>{error && <small className="field-error">{error.message}</small>}</label>;
  return <label className="label">{field.label}<input className="input" type={field.type || "text"} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} {...register(field.name)} />{error && <small className="field-error">{error.message}</small>}</label>;
}

function ResourceForm({ config, initial, onSubmit, onClose, isSubmitting, accounts, categories }) {
  const defaults = { ...config.defaults, ...(initial || {}) };
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({ resolver: zodResolver(config.schema), defaultValues: defaults });
  const [customInstitution, setCustomInstitution] = useState(initial?.institution && !institutions.includes(initial.institution) ? initial.institution : "");
  const submit = (values) => {
    const data = { ...values };
    if ((data.institution === "Outro" || data.bank === "Outro") && customInstitution.trim()) {
      if (data.institution !== undefined) data.institution = customInstitution.trim();
      if (data.bank !== undefined) data.bank = customInstitution.trim();
    }
    delete data.customInstitution;
    onSubmit(data);
  };
  return <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
    {config.help && <div className="flex gap-2 rounded-xl bg-blue-500/10 p-3 text-sm text-[var(--muted)]"><Info size={17} className="mt-0.5 shrink-0" />{config.help}</div>}
    {config.fields.map((field) => <Field key={field.name} field={field} register={register} errors={errors} accounts={accounts} categories={categories} watch={watch} setValue={setValue} />)}
    <div className="mt-2 flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar"}</button></div>
  </form>;
}

function displayValue(resource, field, row) {
  const value = row[field];
  if (value === undefined || value === null || value === "") return "—";
  if (["amount", "limit", "balance", "initialBalance", "targetAmount", "currentAmount", "investedAmount", "currentAmount", "spent", "available", "remaining", "principal"].includes(field)) return money(value);
  if (["percent", "returnPercent"].includes(field)) return percent(value);
  if (["date", "deadline", "nextDue", "nextBillingDate", "startDate"].includes(field)) return dateBR(value);
  if (field === "quantity") return quantity(value);
  if (["type", "brand", "cycle", "status"].includes(field)) return row[`${field}Label`] || value;
  if (typeof value === "boolean") return value ? "Ativo" : "Inativo";
  return value;
}

export function ResourcePage({ resource }) {
  const config = configFor(resource);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const endpoint = endpointByResource[resource];
  const query = useQuery({ queryKey: [resource], queryFn: () => demoEnabled ? Promise.resolve(resources[resource] || []) : api(`/${endpoint}`) });
  const accountsQuery = useQuery({ queryKey: ["accounts", "form"], queryFn: () => api("/accounts"), enabled: !demoEnabled && ["transacoes", "assinaturas"].includes(resource) });
  const categoriesQuery = useQuery({ queryKey: ["categories", "form"], queryFn: () => api("/categories?type=Expense"), enabled: !demoEnabled && ["transacoes", "orcamentos", "assinaturas"].includes(resource) });
  const accounts = asArray(accountsQuery.data);
  const categories = asArray(categoriesQuery.data);
  const rows = useMemo(() => asArray(query.data).filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [query.data, search]);
  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (row) => { setEditing(row); setOpen(true); };
  async function save(values) {
    try {
      if (!demoEnabled) await api(editing ? `/${endpoint}/${editing.id}` : `/${endpoint}`, { method: editing ? "PUT" : "POST", body: JSON.stringify(config.payload(values)) });
      toast.success(editing ? "Registro atualizado" : `${config.title.slice(0, -1)} adicionado com sucesso`);
      qc.invalidateQueries({ queryKey: [resource] }); setOpen(false); setEditing(null);
    } catch (error) { toast.error(error.message); }
  }
  async function remove(id) {
    if (!confirm("Deseja realmente excluir este registro?")) return;
    try { if (!demoEnabled) await api(`/${endpoint}/${id}`, { method: "DELETE" }); toast.success("Registro excluído"); qc.invalidateQueries({ queryKey: [resource] }); }
    catch (error) { toast.error(error.message); }
  }
  return <>
    <PageHeader title={config.title} description={config.description} action={<button className="btn btn-primary" onClick={openCreate}><Plus size={17} />{config.action}</button>} />
    <div className="card mb-5 flex flex-col gap-3 p-4 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} /><input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar em ${config.title.toLowerCase()}...`} aria-label={`Buscar em ${config.title.toLowerCase()}`} /></div></div>
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message="Não foi possível carregar os registros." onRetry={query.refetch} /> : !rows.length ? <EmptyState title={search ? "Nenhum resultado encontrado" : "Nenhum registro por aqui"} description={search ? "Tente buscar por outro termo." : "Crie o primeiro registro para começar."} /> : <div className="table-shell"><table className="w-full text-left"><thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wider text-[var(--muted)]"><tr>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}<th className="text-right">Ações</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{config.columns.map(([field, label]) => <td key={field} data-label={label} className={field === config.columns[0][0] ? "font-bold" : "muted"}>{displayValue(resource, field, row)}</td>)}<td data-label="Ações"><div className="flex justify-end gap-1"><button className="icon-btn !min-h-9 !min-w-9 !p-2" onClick={() => openEdit(row)} aria-label={`Editar ${row.name || row.asset || row.description || "registro"}`}><Pencil size={15} /></button><button className="icon-btn !min-h-9 !min-w-9 !p-2 !text-[var(--danger)]" onClick={() => remove(row.id)} aria-label={`Excluir ${row.name || row.asset || row.description || "registro"}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
    <Modal open={open} onClose={() => { setOpen(false); setEditing(null); }} title={editing ? `Editar — ${config.title}` : config.action}><ResourceForm config={config} initial={editing} onSubmit={save} onClose={() => { setOpen(false); setEditing(null); }} isSubmitting={false} accounts={accounts} categories={categories} /></Modal>
  </>;
}
