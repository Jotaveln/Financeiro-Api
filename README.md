# Financeiro-Api

Sistema de gestão financeira pessoal com API ASP.NET Core 10, PostgreSQL/EF Core e frontend Next.js em JavaScript. A interface está em português do Brasil e usa BRL como moeda padrão.

> **Status de verificação:** a estrutura e o código foram gerados no Windows com .NET SDK 10.0.401, Node 24.20 e npm 11.19. O Docker, PostgreSQL local, `psql` e GitHub CLI não estavam instalados durante a preparação; portanto, `docker compose`, migrations contra banco real e publicação remota precisam ser executados em um ambiente que tenha essas ferramentas. O `npm install`/build depende da permissão da máquina para baixar pacotes.

## Estrutura

```text
Financeiro-Api/
├── Financeiro-Api.sln
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── Financeiro.Api/            # API, controllers, middleware e composição
│   │   ├── Financeiro.Application/   # DTOs e contratos
│   │   ├── Financeiro.Domain/        # Entidades, enums e regras
│   │   └── Financeiro.Infrastructure/# EF Core, Identity, tokens, seed
│   └── tests/
├── frontend/                          # Next.js App Router, JavaScript
├── docs/
├── scripts/
├── docker-compose.yml
└── .env.example
```

## Requisitos

- .NET SDK 10.0.401 ou compatível com `global.json`.
- Visual Studio 2026 com workload ASP.NET e desenvolvimento web, ou CLI .NET.
- Node.js 24+ e npm 11+.
- PostgreSQL 15+ local/gerenciado, ou Docker Desktop.
- Git. GitHub CLI é opcional para criar o repositório remoto.

## Configuração local

1. Copie `.env.example` para `.env` (PowerShell: `Copy-Item .env.example .env`) e troque a senha/chave JWT.
2. Defina as mesmas variáveis no ambiente do processo da API. A API aceita `ConnectionStrings__Postgres` ou `ConnectionStrings__DefaultConnection`; em produção use um secret manager.
3. Para execução local, prefira `ConnectionStrings__Postgres`:

```powershell
$env:ConnectionStrings__Postgres = "Host=localhost;Port=5432;Database=financeiro;Username=financeiro;Password=change-me"
$env:Jwt__Key = "uma-chave-local-com-mais-de-32-caracteres"
$env:Jwt__Issuer = "Financeiro.Api"
$env:Jwt__Audience = "Financeiro.Web"
$env:Auth__CookieSameSite = "Lax"
$env:Cors__Origins__0 = "http://localhost:3000"
```

4. Configure `frontend/.env.local`:

```text
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_DEMO_MODE=false
```

O modo demo do frontend é opt-in: só use `NEXT_PUBLIC_DEMO_MODE=true` para explorar a interface sem API; ele não substitui o backend.

## PostgreSQL e migrations

Com PostgreSQL disponível, crie o banco e aplique o schema:

```powershell
dotnet restore Financeiro-Api.sln
dotnet tool restore # restaura o manifesto local dotnet-tools.json
dotnet ef migrations list --context FinanceiroDbContext --project backend/src/Financeiro.Infrastructure/Financeiro.Infrastructure.csproj --startup-project backend/src/Financeiro.Api/Financeiro.Api.csproj
dotnet ef database update --context FinanceiroDbContext --project backend/src/Financeiro.Infrastructure/Financeiro.Infrastructure.csproj --startup-project backend/src/Financeiro.Api/Financeiro.Api.csproj
```

O seed só roda em Development quando `Seed__Enabled=true`. Use `Seed__Email` e `Seed__Password` no ambiente; não coloque credenciais reais no Git. O valor padrão é `false`. Para aplicar a migration sem `EnsureCreated`, habilite `Database__ApplyMigrations=true` somente durante um release controlado; a API executa `Database.MigrateAsync()` antes de aceitar requests.

## Executar backend

```powershell
dotnet restore Financeiro-Api.sln
dotnet build Financeiro-Api.sln --configuration Debug
dotnet run --project backend/src/Financeiro.Api --urls http://localhost:8080
```

Swagger fica disponível em `http://localhost:8080/swagger` no ambiente Development. Health checks: `/health/live` (processo) e `/health/ready` (PostgreSQL).

No Visual Studio, abra `Financeiro-Api.sln`, defina `Financeiro.Api` como Startup Project e configure as variáveis de ambiente do perfil de execução.

## Executar frontend

```powershell
Set-Location frontend
npm install
npm run dev
```

Abra `http://localhost:3000`. Para uma validação de produção:

```powershell
npm run lint
npm test -- --run
npm run build
npm start
```

## Docker

Docker não estava instalado no ambiente de criação, então os comandos abaixo são preparação e não foram declarados como executados:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

A API fica em `http://localhost:8080` e o PostgreSQL em `localhost:5432`. Para parar: `docker compose down`; para remover dados: `docker compose down -v`.

## API

Todas as rotas privadas usam `Authorization: Bearer <access_token>` e começam por `/api/v1`.

- `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`.
- `GET/PUT /users/me`, `POST /users/change-password`, `PUT /users/settings`; configurações atualizam perfil, preferências e senha, e a troca de senha revoga as sessões de refresh ativas.
- CRUD: `/accounts`, `/categories`, `/transactions`, `/credit-cards`, `/budgets`, `/goals`, `/investments`, `/debts`, `/subscriptions`.
- Fluxos: `POST /transfers`, `POST /credit-cards/{id}/purchases`, `GET /credit-cards/{id}/invoices`, `POST /credit-cards/invoices/{id}/pay`, `POST /goals/{id}/contributions`.
- Análise: `GET /dashboard`, `/reports/summary`, `/search`, `/notifications`; o dashboard lista até 20 próximos eventos financeiros reais e notifications usam geração idempotente.
- CSV: `GET /import-export/transactions.csv`, `POST /import-export/transactions/preview`.

Detalhes, corpos JSON e respostas devem ser consultados no Swagger ou em `docs/api.md`.

## Segurança

Senhas são gerenciadas pelo ASP.NET Identity. Refresh tokens são armazenados com hash e rotacionados. O fluxo de recuperação sempre retorna resposta genérica; links só são enviados pelo `Email:WebhookUrl` configurado. Em produção, use HTTPS, chave JWT aleatória com pelo menos 32 caracteres, CORS restrito, cookies seguros, PostgreSQL gerenciado com TLS, logs sem dados sensíveis e secrets do provedor.

## Deploy

- **Frontend:** Vercel, Root Directory `frontend`, Build `npm run build`, variável `NEXT_PUBLIC_API_URL` apontando para a API HTTPS.
- **Backend:** Render, Railway, Azure Container Apps/App Service ou Fly.io usando `backend/Dockerfile`; configure `ASPNETCORE_ENVIRONMENT=Production`, `PORT` (Render), `ConnectionStrings__Postgres`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`, `Cors__Origins__0`, `Frontend__Url`, `Auth__CookieSameSite=None`, `Database__ApplyMigrations` durante o release inicial, `Seed__Enabled=false` e SMTP/webhook. ASP.NET Core não deve ser forçado dentro da Vercel.
- **Banco:** Neon, Supabase ou PostgreSQL gerenciado equivalente. Aplique migrations em pipeline controlado antes de liberar a aplicação.

Passos detalhados estão em `docs/deployment.md`. Backup, restore, retenção e recuperação estão em `docs/backup-recovery.md`.

## GitHub

O Git local deve ser criado com os arquivos ignorados por `.gitignore`. Como GitHub CLI não estava disponível, não se deve afirmar que o remoto foi criado. Depois de autenticar:

```powershell
gh auth login
gh repo create Financeiro-Api --private --source . --remote origin --push
```

Alternativa: crie o repositório vazio na interface do GitHub e execute `git remote add origin <URL>` e `git push -u origin main`.

## Limitações conhecidas

- O preço de investimentos é informado manualmente; não há dependência de API paga.
- Exportação obrigatória é CSV; Excel/PDF não fazem parte do núcleo atual.
- Preferências granulares de notificações não são persistidas: não existem campos correspondentes em `UserSettings`.
- O preview de importação CSV apenas analisa o arquivo; a importação persistente de transações ainda não existe. A exportação CSV usa endpoint protegido, Bearer em memória, refresh após `401` e download via `Blob`.
- A integração PostgreSQL real depende de Docker ou de uma `TEST_CONNECTION_STRING` de teste explicitamente autorizada; sem essa variável a suíte é bloqueada, e não há conexão de produção alternativa. Esta rodada não aplicou migration, não validou produção e não executou E2E.
- A auditoria npm encontrou 21 vulnerabilidades (16 moderadas, 3 altas e 2 críticas), concentradas em tooling/build/testes; as correções principais exigem Vitest 5 e upgrades de lint/Next que devem ser tratados em rodada própria de compatibilidade. `npm audit fix --force` não foi executado.
- Error boundary e loading boundary segmentados estão ativos; o modal possui foco inicial, retorno de foco, Escape, `aria-modal` e focus trap. Não há E2E/browser automatizado nesta máquina e a validação visual manual continua pendente.
- Build npm e testes E2E devem ser executados em máquina com as dependências instaladas.
