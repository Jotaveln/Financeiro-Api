"use client";

import React, { useState } from "react";
import { Bell, Check } from "lucide-react";
import { ErrorState } from "./states.jsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { demoEnabled } from "@/lib/demo";

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [markReadError, setMarkReadError] = useState(false);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: () => demoEnabled ? Promise.resolve([]) : api("/notifications?unreadOnly=false"), staleTime: 30000, retry: 2 });
  const notifications = query.data?.items || query.data || [];
  const unread = notifications.filter((item) => !item.isRead).length;
  async function markRead(id) {
    try {
      setMarkReadError(false);
      if (!demoEnabled) await api(`/notifications/${id}/read`, { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      setMarkReadError(true);
    }
  }
  return <div className="relative"><button type="button" className="icon-btn relative" aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="notifications-panel"><Bell size={18}/>{unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />}</button>{open && <div id="notifications-panel" className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-[var(--surface)] p-2 shadow-xl" style={{ borderColor: "var(--line)" }}><div className="flex items-center justify-between p-2"><p className="font-black">Notificações</p><span className="text-xs muted">{unread} não lidas</span></div>{query.isLoading ? <p className="p-3 text-sm muted">Carregando...</p> : query.isError ? <ErrorState message="Não foi possível carregar as notificações." onRetry={query.refetch}/> : markReadError ? <p className="p-3 text-sm text-[var(--danger)]" role="alert">Não foi possível marcar a notificação como lida.</p> : !notifications.length ? <p className="p-3 text-sm muted">Nenhuma notificação.</p> : <div className="grid gap-1">{notifications.slice(0, 8).map((item) => <article className={`rounded-lg p-3 ${item.isRead ? "" : "bg-[var(--surface-2)]"}`} key={item.id}><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs muted">{item.message}</p></div>{!item.isRead && <button className="icon-btn !min-h-8 !min-w-8 !p-1" onClick={() => markRead(item.id)} aria-label="Marcar como lida"><Check size={14}/></button>}</div></article>)}</div>}</div>}</div>;
}
