import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata = { title: "Financeiro", description: "Gestão financeira pessoal completa", icons: { icon: "/icon.svg", apple: "/icon.svg" } };
export default function RootLayout({ children }) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
