"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return <main className="grid min-h-[60vh] place-items-center p-6">
    <section className="card w-full max-w-lg p-8 text-center" role="alert">
      <AlertTriangle className="mx-auto mb-4 text-[var(--danger)]" aria-hidden="true" />
      <h1 className="text-xl font-black">Não foi possível carregar esta área</h1>
      <p className="muted mt-2 text-sm">Ocorreu um erro inesperado. Tente novamente; seus dados não foram alterados.</p>
      <button type="button" className="btn btn-secondary mt-5" onClick={() => reset()}><RefreshCw size={16} />Tentar novamente</button>
    </section>
  </main>;
}
