"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Receipt, ShoppingBag, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { demoEnabled, resources } from "@/lib/demo";
import { money, dateBR } from "@/lib/formatters";
import { cardBrands, configFor } from "@/lib/resource-config";
import { EmptyState, ErrorState, LoadingState } from "./states.jsx";
import { Modal } from "./modal";
import { PageHeader } from "./page-header";

const cardConfig = configFor("cartoes");
const asArray = (value) => value?.items || value || [];
const today = () => new Date().toISOString().slice(0, 10);

function CardForm({ initial, onSubmit, onClose, saving }) {
  const [form, setForm] = useState({ name: "", bank: "", brand: "Mastercard", limit: "", bestPurchaseDay: "1", closingDay: "10", dueDay: "17", isActive: true, ...initial });
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  return <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, limit: Number(form.limit), bestPurchaseDay: Number(form.bestPurchaseDay), closingDay: Number(form.closingDay), dueDay: Number(form.dueDay) }); }}>
    <label className="label">Nome ou apelido<input className="input" required maxLength={120} value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Ex.: Cartão principal" /></label>
    <label className="label">Instituição<input className="input" required maxLength={120} value={form.bank} onChange={(event) => update("bank", event.target.value)} placeholder="Ex.: Nubank" /></label>
    <label className="label">Bandeira<select className="input" value={form.brand} onChange={(event) => update("brand", event.target.value)}>{cardBrands.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="label">Limite (R$)<input className="input" required min="0" step="0.01" type="number" value={form.limit} onChange={(event) => update("limit", event.target.value)} /></label>
    <div className="grid gap-4 sm:grid-cols-3"><label className="label">Melhor compra<input className="input" required min="1" max="31" type="number" value={form.bestPurchaseDay} onChange={(event) => update("bestPurchaseDay", event.target.value)} /></label><label className="label">Fechamento<input className="input" required min="1" max="31" type="number" value={form.closingDay} onChange={(event) => update("closingDay", event.target.value)} /></label><label className="label">Vencimento<input className="input" required min="1" max="31" type="number" value={form.dueDay} onChange={(event) => update("dueDay", event.target.value)} /></label></div>
    <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} />Cartão ativo</label>
    <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar cartão"}</button></div>
  </form>;
}

function PurchaseForm({ accounts, categories, onSubmit, onClose, saving }) {
  const [form, setForm] = useState({ description: "", totalAmount: "", purchaseDate: today(), categoryId: "", installmentCount: "1" });
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  return <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, totalAmount: Number(form.totalAmount), installmentCount: Number(form.installmentCount), categoryId: form.categoryId || null }); }}>
    <label className="label">Descrição<input className="input" required maxLength={200} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Ex.: Notebook" /></label>
    <label className="label">Valor total (R$)<input className="input" required min="0.01" step="0.01" type="number" value={form.totalAmount} onChange={(event) => update("totalAmount", event.target.value)} /></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="label">Data da compra<input className="input" required type="date" value={form.purchaseDate} onChange={(event) => update("purchaseDate", event.target.value)} /></label><label className="label">Parcelas<input className="input" required min="1" max="60" type="number" value={form.installmentCount} onChange={(event) => update("installmentCount", event.target.value)} /></label></div>
    <label className="label">Categoria de despesa<select className="input" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">Sem categoria</option>{categories.filter((item) => item.type === "Expense" && item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? "Salvando..." : "Registrar compra"}</button></div>
  </form>;
}

function PaymentForm({ accounts, onSubmit, onClose, saving }) {
  const [accountId, setAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  return <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); onSubmit({ accountId, paymentDate }); }}><label className="label">Conta de pagamento<select className="input" required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Selecione uma conta</option>{accounts.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="label">Data do pagamento<input className="input" required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label><div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={saving || !accountId}>{saving ? "Processando..." : "Pagar fatura"}</button></div></form>;
}

export function CardPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const cardsQuery = useQuery({ queryKey: ["cartoes"], queryFn: () => demoEnabled ? Promise.resolve(resources.cartoes || []) : api("/credit-cards") });
  const accountsQuery = useQuery({ queryKey: ["accounts", "card-workflow"], queryFn: () => api("/accounts?activeOnly=true"), enabled: !demoEnabled });
  const categoriesQuery = useQuery({ queryKey: ["categories", "card-workflow"], queryFn: () => api("/categories?type=Expense"), enabled: !demoEnabled });
  const detailQuery = useQuery({ queryKey: ["credit-card", selectedId], queryFn: () => api(`/credit-cards/${selectedId}`), enabled: Boolean(selectedId) && !demoEnabled });
  const cards = asArray(cardsQuery.data);
  const accounts = asArray(accountsQuery.data);
  const categories = asArray(categoriesQuery.data);
  const selected = demoEnabled ? cards.find((card) => card.id === selectedId) : detailQuery.data;
  const invoices = selected?.invoices || selected?.Invoices || [];
  const closeModal = () => { setModal(null); setEditing(null); };
  async function saveCard(values) { setSaving(true); try { if (!demoEnabled) await api(editing ? `/credit-cards/${editing.id}` : "/credit-cards", { method: editing ? "PUT" : "POST", body: JSON.stringify(values) }); toast.success(demoEnabled ? "Modo demonstração — alterações não são persistidas." : editing ? "Cartão atualizado" : "Cartão criado"); closeModal(); qc.invalidateQueries({ queryKey: ["cartoes"] }); } catch (error) { toast.error(error.message); } finally { setSaving(false); } }
  async function savePurchase(values) { setSaving(true); try { if (!demoEnabled) await api(`/credit-cards/${selectedId}/purchases`, { method: "POST", body: JSON.stringify(values) }); toast.success(demoEnabled ? "Modo demonstração — alterações não são persistidas." : "Compra registrada"); closeModal(); qc.invalidateQueries({ queryKey: ["cartoes"] }); qc.invalidateQueries({ queryKey: ["credit-card", selectedId] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); } catch (error) { toast.error(error.message); } finally { setSaving(false); } }
  async function payInvoice(invoiceId, values) { setSaving(true); try { if (!demoEnabled) await api(`/credit-cards/invoices/${invoiceId}/pay`, { method: "POST", body: JSON.stringify(values) }); toast.success(demoEnabled ? "Modo demonstração — alterações não são persistidas." : "Fatura paga"); closeModal(); qc.invalidateQueries({ queryKey: ["cartoes"] }); qc.invalidateQueries({ queryKey: ["credit-card", selectedId] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["transacoes"] }); } catch (error) { toast.error(error.message); } finally { setSaving(false); } }
  if (cardsQuery.isLoading) return <LoadingState />;
  if (cardsQuery.isError) return <ErrorState message="Não foi possível carregar os cartões." onRetry={cardsQuery.refetch} />;
  return <><PageHeader title={cardConfig.title} description={cardConfig.description} action={<button className="btn btn-primary" onClick={() => { setEditing(null); setModal("card"); }}><Plus size={17} />Novo cartão</button>} />
    {!cards.length ? <EmptyState title="Nenhum cartão cadastrado" description="Cadastre um cartão para acompanhar compras, parcelas e faturas." /> : <div className="grid gap-5 xl:grid-cols-[minmax(260px,.8fr)_minmax(0,1.7fr)]"><section className="grid content-start gap-3">{cards.map((card) => <button type="button" key={card.id} onClick={() => setSelectedId(card.id)} className={`card p-5 text-left transition ${selectedId === card.id ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/20" : ""}`}><div className="mb-4 flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><CreditCard size={19} /></span><span className={`text-xs font-bold ${card.isActive === false ? "text-[var(--danger)]" : "text-[var(--brand)]"}`}>{card.isActive === false ? "Inativo" : "Ativo"}</span></div><p className="font-black">{card.name}</p><p className="muted text-sm">{card.bank} · {card.brand}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><span><small className="muted block">Utilizado</small><b>{money(card.used ?? card.Used)}</b></span><span><small className="muted block">Disponível</small><b>{money(card.available ?? card.Available)}</b></span></div></button>)}</section><section className="card p-5">{!selectedId ? <EmptyState title="Selecione um cartão" description="Escolha um cartão para ver faturas e registrar compras." /> : detailQuery.isLoading && !demoEnabled ? <LoadingState /> : detailQuery.isError ? <ErrorState message="Não foi possível carregar o detalhe do cartão." onRetry={detailQuery.refetch} /> : <><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="muted text-sm">Cartão selecionado</p><h2 className="text-xl font-black">{selected?.name}</h2><p className="muted text-sm">Limite total: {money(selected?.limit)}</p></div><div className="flex gap-2"><button className="btn btn-secondary" onClick={() => { setEditing(selected); setModal("card"); }}>Editar</button><button className="btn btn-primary" disabled={selected?.isActive === false} onClick={() => setModal("purchase")}><ShoppingBag size={16} />Nova compra</button></div></div><div className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[var(--surface-2)] p-4"><small className="muted">Limite total</small><p className="font-black">{money(selected?.limit)}</p></div><div className="rounded-xl bg-[var(--surface-2)] p-4"><small className="muted">Utilizado</small><p className="font-black">{money(selected?.used ?? selected?.Used)}</p></div><div className="rounded-xl bg-[var(--brand-soft)] p-4"><small className="muted">Disponível</small><p className="font-black text-[var(--brand)]">{money(selected?.available ?? selected?.Available)}</p></div></div><div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--line)" }}><Receipt size={17} className="text-[var(--brand)]" /><h3 className="font-black">Histórico de faturas</h3></div>{!invoices.length ? <p className="muted py-6 text-sm">Nenhuma fatura gerada ainda.</p> : <div className="mt-3 grid gap-3">{invoices.map((invoice) => { const total = invoice.total ?? invoice.Total ?? invoice.installments?.reduce((sum, item) => sum + Number(item.amount), 0) ?? 0; const paid = invoice.paidAt || invoice.PaidAt || invoice.status === "Paid"; return <article className="rounded-xl border p-4" style={{ borderColor: "var(--line)" }} key={invoice.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">Fatura {String(invoice.month).padStart(2, "0")}/{invoice.year}</p><p className="muted text-xs">Fecha em {dateBR(invoice.closingDate)} · vence em {dateBR(invoice.dueDate)}</p></div><div className="text-right"><p className="font-black">{money(total)}</p><p className={`text-xs font-bold ${paid ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{paid ? "Paga" : invoice.status === "Overdue" ? "Vencida" : "Em aberto"}</p></div></div><details className="mt-3"><summary className="cursor-pointer text-sm font-bold">Ver parcelas</summary><div className="mt-2 grid gap-2">{(invoice.installments || invoice.Installments || []).map((item) => <div className="flex justify-between text-sm" key={item.id}><span>Parcela {item.number}/{item.total}</span><b>{money(item.amount)}</b></div>)}</div></details>{!paid && <button className="btn btn-secondary mt-3" onClick={() => setModal(`pay:${invoice.id}`)}><WalletCards size={16} />Pagar fatura</button>}</article>; })}</div>}</>}</section></div>}
    <Modal open={modal === "card"} onClose={closeModal} title={editing ? "Editar cartão" : "Novo cartão"}><CardForm initial={editing} onSubmit={saveCard} onClose={closeModal} saving={saving} /></Modal><Modal open={modal === "purchase"} onClose={closeModal} title="Nova compra no cartão"><PurchaseForm accounts={accounts} categories={categories} onSubmit={savePurchase} onClose={closeModal} saving={saving} /></Modal>{typeof modal === "string" && modal.startsWith("pay:") && <Modal open onClose={closeModal} title="Pagar fatura"><PaymentForm accounts={accounts} onSubmit={(values) => payInvoice(modal.slice(4), values)} onClose={closeModal} saving={saving} /></Modal>}</>;
}
