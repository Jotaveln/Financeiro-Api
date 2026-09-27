"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, WalletCards, ArrowLeftRight, Shapes, CreditCard, Repeat2, ChartPie, Target, TrendingUp, Landmark, CalendarDays, FileBarChart, Upload, Settings, Menu, X, Search, Bell, LogOut } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { api, setAccessToken } from "@/lib/api";
const sections=[
 {label:"VISÃO GERAL",items:[["/","Dashboard",LayoutDashboard]]},
 {label:"GESTÃO",items:[["/contas","Contas",WalletCards],["/transacoes","Transações",ArrowLeftRight],["/categorias","Categorias",Shapes],["/cartoes","Cartões",CreditCard],["/transferencias","Transferências",Repeat2]]},
 {label:"PLANEJAMENTO",items:[["/orcamentos","Orçamentos",ChartPie],["/metas","Metas",Target],["/investimentos","Investimentos",TrendingUp],["/dividas","Dívidas",Landmark],["/assinaturas","Assinaturas",Repeat2]]},
 {label:"ANÁLISE",items:[["/calendario","Calendário",CalendarDays],["/relatorios","Relatórios",FileBarChart],["/importar","Importar / Exportar",Upload],["/configuracoes","Configurações",Settings]]}
];
export function AppShell({children}){const pathname=usePathname();const [open,setOpen]=useState(false);async function logout(){try{await api('/auth/logout',{method:'POST'});}finally{setAccessToken(null);document.cookie='financeiro_session=; Max-Age=0; path=/';window.location.href='/login';}}return <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
 <aside className={`${open?"translate-x-0":"-translate-x-full"} fixed inset-y-0 left-0 z-50 w-[250px] bg-[#102a23] text-white transition lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
  <div className="flex h-20 items-center justify-between px-5"><Link href="/" className="flex items-center gap-3 font-black text-xl"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-[#102a23]">F</span>Financeiro</Link><button className="lg:hidden" onClick={()=>setOpen(false)} aria-label="Fechar menu"><X/></button></div>
  <nav className="h-[calc(100vh-9rem)] overflow-y-auto px-3">{sections.map(s=><div key={s.label} className="mb-5"><p className="px-3 pb-2 text-[10px] font-bold tracking-[.18em] text-emerald-100/50">{s.label}</p>{s.items.map(([href,label,Icon])=>{const active=pathname===href;return <Link key={href} href={href} onClick={()=>setOpen(false)} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${active?"bg-emerald-400 font-bold text-[#102a23]":"text-emerald-50/75 hover:bg-white/10 hover:text-white"}`}><Icon size={18}/>{label}</Link>})}</div>)}</nav>
  <button type="button" onClick={logout} className="mx-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm text-emerald-50/75"><LogOut size={18}/>Sair</button>
 </aside>{open&&<button className="fixed inset-0 z-40 bg-black/45 lg:hidden" aria-label="Fechar menu" onClick={()=>setOpen(false)}/>}
 <div className="min-w-0"><header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b px-4 backdrop-blur lg:px-8" style={{background:"color-mix(in srgb,var(--bg) 88%,transparent)",borderColor:"var(--line)"}}><button className="btn btn-secondary !p-2.5 lg:hidden" onClick={()=>setOpen(true)} aria-label="Abrir menu"><Menu size={19}/></button><div className="relative hidden max-w-lg flex-1 md:block"><Search className="absolute left-3 top-2.5 text-[var(--muted)]" size={18}/><input className="input pl-10" placeholder="Buscar transações, contas e cartões..." aria-label="Busca global"/></div><div className="ml-auto flex items-center gap-2"><ThemeToggle/><button className="btn btn-secondary relative !p-2.5" aria-label="Notificações"><Bell size={18}/><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange-500"/></button><div className="ml-1 hidden text-right sm:block"><p className="text-sm font-bold">Conta Demo</p><p className="muted text-xs">Setembro 2026</p></div></div></header><main className="p-4 lg:p-8">{children}</main></div>
 </div>}
