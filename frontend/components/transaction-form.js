"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { configFor, fieldLabel } from "@/lib/resource-config";

const config = configFor("transacoes");

function Field({ field, register, errors, accounts, categories, watch }) {
  const error = errors[field.name];
  const type = watch("type");
  const options = field.type === "account"
    ? accounts.map((item) => [item.id, item.name])
    : field.type === "category"
      ? categories.filter((item) => item.type === type && item.isActive !== false).map((item) => [item.id, item.name])
      : field.options;
  if (field.type === "textarea") return <label className="label">{field.label}<textarea className="input min-h-24" {...register(field.name)} />{error && <small className="field-error">{error.message}</small>}</label>;
  if (field.type === "select" || field.type === "account" || field.type === "category") return <label className="label">{field.label}<select className="input" {...register(field.name)}><option value="">Selecione</option>{options?.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>{error && <small className="field-error">{error.message}</small>}</label>;
  return <label className="label">{field.label}<input className="input" type={field.type || "text"} min={field.min} step={field.step} {...register(field.name)} />{error && <small className="field-error">{error.message}</small>}</label>;
}

export function TransactionForm({ accounts = [], categories = [], onSubmit, onClose, isSubmitting = false }) {
  const defaults = useMemo(() => ({ ...config.defaults, date: new Date().toISOString().slice(0, 10) }), []);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ resolver: zodResolver(config.schema), defaultValues: defaults });
  return <form className="grid gap-4" onSubmit={handleSubmit((values) => onSubmit(config.payload(values)))}>
    {config.fields.map((field) => <Field key={field.name} field={field} register={register} errors={errors} accounts={accounts} categories={categories} watch={watch} />)}
    <div className="mt-2 flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar transação"}</button></div>
  </form>;
}
