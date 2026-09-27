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
2. Defina as mesmas variáveis no ambiente do processo da API. O ASP.NET Core lê `ConnectionStrings__DefaultConnection`; em produção use um secret manager.
3. A API usa `ConnectionStrings:Postgres`. Se o nome da variável usado for `ConnectionStrings__DefaultConnection`, ajuste para `ConnectionStrings__Postgres` ou defina ambos:

```powershell
$env:ConnectionStrings__Postgres = "Host=localhost;Port=5432;Database=financeiro;Username=financeiro;Password=change-me"
$env:Jwt__Key = "uma-chave-local-com-mais-de-32-caracteres"
$env:Jwt__Issuer = "Financeiro.Api"
$env:Jwt__Audience = "Financeiro.Web"
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
dotnet ef migrations list --project backend/src/Financeiro.Infrastructure --startup-project backend/src/Financeiro.Api
dotnet ef database update --project backend/src/Financeiro.Infrastructure --startup-project backend/src/Financeiro.Api
```

O seed só roda quando `Seed__Enabled=true`. Use `Seed__Email` e `Seed__Password` no ambiente; não coloque credenciais reais no Git. O valor padrão é `false`.

## Executar backend

```powershell
dotnet restore Financeiro-Api.sln
dotnet build Financeiro-Api.sln --configuration Debug
dotnet run --project backend/src/Financeiro.Api --urls http://localhost:8080
```

Swagger fica disponível em `http://localhost:8080/swagger` no ambiente Development. Health checks: `/health/live` e `/health/ready`.

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
- `GET/PUT /users/me`, `POST /users/change-password`, `PUT /users/settings`.
- CRUD: `/accounts`, `/categories`, `/transactions`, `/credit-cards`, `/budgets`, `/goals`, `/investments`, `/debts`, `/subscriptions`.
- Fluxos: `POST /transfers`, `POST /credit-cards/{id}/purchases`, `GET /credit-cards/{id}/invoices`, `POST /credit-cards/invoices/{id}/pay`, `POST /goals/{id}/contributions`.
- Análise: `GET /dashboard`, `/reports/summary`, `/search`, `/notifications`.
- CSV: `GET /import-export/transactions.csv`, `POST /import-export/transactions/preview`.

Detalhes, corpos JSON e respostas devem ser consultados no Swagger ou em `docs/api.md`.

## Segurança

Senhas são gerenciadas pelo ASP.NET Identity. Refresh tokens são armazenados com hash e rotacionados. O fluxo de recuperação sempre retorna resposta genérica; links só são enviados pelo `Email:WebhookUrl` configurado. Em produção, use HTTPS, chave JWT aleatória com pelo menos 32 caracteres, CORS restrito, cookies seguros, PostgreSQL gerenciado com TLS, logs sem dados sensíveis e secrets do provedor.

## Deploy

- **Frontend:** Vercel, Root Directory `frontend`, Build `npm run build`, variável `NEXT_PUBLIC_API_URL` apontando para a API HTTPS.
- **Backend:** Render, Railway, Azure Container Apps/App Service ou Fly.io usando `backend/Dockerfile`; configure `ConnectionStrings__Postgres`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`, `Cors__Origins__0`, `Frontend__Url` e SMTP/webhook. ASP.NET Core não deve ser forçado dentro da Vercel.
- **Banco:** Neon, Supabase ou PostgreSQL gerenciado equivalente. Aplique migrations em pipeline controlado antes de liberar a aplicação.

Passos detalhados estão em `docs/deployment.md`.

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
- O preview de importação CSV está disponível; confirme/normalize linhas conforme o contrato da API antes de persistir.
- Integração PostgreSQL/Docker, build npm e testes E2E devem ser executados em máquina com as dependências instaladas.
