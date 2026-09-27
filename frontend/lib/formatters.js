export const money = (value, currency = "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value || 0));
export const dateBR = (value) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)) : "—";
export const percent = (value) => new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value || 0) / 100);
