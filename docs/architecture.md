# Arquitetura

## Visão geral

O sistema é um monorepo com solução Visual Studio para a API e um app Next.js separado para a interface.

```text
Next.js (Vercel/local)
        │ HTTPS + JSON/CSV
        ▼
Financeiro.Api (ASP.NET Core 10)
        │ serviços/DTOs
        ▼
Financeiro.Application ─ Financeiro.Domain
        │ EF Core/Identity
        ▼
PostgreSQL (Neon, Supabase ou equivalente)
```

## Camadas

- **Domain:** entidades financeiras, enums e invariantes que não dependem de banco ou HTTP.
- **Application:** contratos, records de entrada/saída, paginação e abstrações compartilhadas.
- **Infrastructure:** `FinanceiroDbContext`, Identity, PostgreSQL/Npgsql, refresh tokens, seed e e-mail webhook.
- **Api:** composição em `Program.cs`, autenticação JWT, CORS, rate limiting, ProblemDetails, health checks, Swagger e controllers versionados.
- **Frontend:** App Router em JavaScript, React Query para estado remoto, cliente HTTP centralizado, componentes reutilizáveis e páginas por módulo.

## Fluxos importantes

1. Login emite access token curto e cookie `HttpOnly` com refresh token. O frontend renova o access token em `/auth/refresh`.
2. Cada registro financeiro carrega `UserId`; filtros globais do EF e `ICurrentUser` evitam acesso cruzado.
3. Transferências criam débito/crédito vinculados dentro de transação do banco.
4. Compras parceladas criam faturas e parcelas futuras; pagamento cria uma despesa na conta e marca a fatura.
5. Saldo é calculado a partir do saldo inicial e transações pagas, não por contadores duplicados.

## Decisões operacionais

- API C# é implantada em Render/Railway/Azure/Fly.io, não na Vercel.
- Vercel hospeda apenas o frontend e recebe `NEXT_PUBLIC_API_URL`.
- Valores monetários usam `decimal`; datas financeiras usam `DateOnly`.
- Dados demonstrativos só são criados com `Seed__Enabled=true` e credenciais fornecidas por ambiente.
- O modo demo do frontend é opt-in e as operações mutáveis exibem que alterações não são persistidas; fora do demo, configurações usam os endpoints reais de perfil/preferências/senha.
- O frontend possui error boundary e loading boundary no segmento autenticado; o modal mantém foco, Escape e semântica de diálogo.
