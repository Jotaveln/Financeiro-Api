"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, LoaderCircle, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function GlobalSearch() {
  const router = useRouter();
  const root = useRef(null);
  const input = useRef(null);
  const [value, setValue] = useState("");
  const [results, setResults] = useState([]);
  const [state, setState] = useState("idle");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const query = value.trim();
    const currentRequest = ++requestId.current;
    if (query.length < 2) {
      setResults([]);
      setState("idle");
      setOpen(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      setOpen(true);
      try {
        const data = await api(`/search?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal });
        if (currentRequest !== requestId.current) return;
        setResults(Array.isArray(data) ? data : data.items || []);
        setActive(0);
        setState("ready");
      } catch (error) {
        if (error.name === "AbortError") return;
        setResults([]);
        setState("error");
      }
    }, 280);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (result) => {
    setValue("");
    setOpen(false);
    router.push(result.href);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (!open || !results.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % results.length); }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + results.length) % results.length); }
    if (event.key === "Enter") { event.preventDefault(); choose(results[active]); }
  };

  return <div ref={root} className="header-search-wrap relative flex min-w-0 h-[42px] max-w-lg flex-1">
    <Search className="header-search-icon" size={17} aria-hidden="true" />
    <input ref={input} className="input header-search h-full" value={value} onChange={(event) => setValue(event.target.value)} onFocus={() => value.trim().length > 1 && setOpen(true)} onKeyDown={onKeyDown} placeholder="Buscar transações, contas e cartões..." aria-label="Busca global" role="combobox" aria-expanded={open} aria-controls="global-search-results" aria-activedescendant={open && results[active] ? `search-result-${results[active].type}-${results[active].id}` : undefined} />
    {open && <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border bg-[var(--surface)] p-1 shadow-xl" style={{ borderColor: "var(--line)" }}>
      {state === "loading" && <p className="flex items-center gap-2 p-3 text-sm muted"><LoaderCircle size={16} className="animate-spin" />Buscando...</p>}
      {state === "error" && <p className="flex items-center gap-2 p-3 text-sm text-[var(--danger)]"><AlertCircle size={16} />Não foi possível buscar agora.</p>}
      {state === "ready" && !results.length && <p className="p-3 text-sm muted">Nenhum resultado encontrado.</p>}
      {results.map((result, index) => <button type="button" key={`${result.type}-${result.id}`} id={`search-result-${result.type}-${result.id}`} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose(result)} className={`flex w-full items-start gap-3 rounded-lg p-3 text-left ${index === active ? "bg-[var(--surface-2)]" : ""}`}>
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-xs font-black text-[var(--brand)]">{result.type?.slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{result.title}</span><span className="block truncate text-xs muted">{result.subtitle}</span></span>
      </button>)}
    </div>}
  </div>;
}
