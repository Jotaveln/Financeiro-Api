"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
export function Providers({ children }) { const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } })); return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><QueryClientProvider client={client}>{children}<Toaster richColors position="top-right" /></QueryClientProvider></ThemeProvider>; }
