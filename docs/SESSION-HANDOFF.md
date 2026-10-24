# SESSION HANDOFF — Financeiro-Api

Data da verificação: 27/09/2026
Diretório do projeto: `C:\Users\vitor\Financeiro-Api`

Este arquivo registra o estado real verificado no filesystem e no Git para que outra sessão possa continuar sem depender do histórico desta conversa.

## 1. Resumo do projeto

### Nome e objetivo

**Financeiro-Api** é um sistema de gestão financeira pessoal em português do Brasil, com valores em BRL e datas no formato brasileiro. O objetivo é permitir que cada usuário controle contas, receitas, despesas, transferências, cartões, faturas, parcelas, orçamentos, metas, investimentos, dívidas, assinaturas, relatórios, notificações e exportação/importação CSV.

### Arquitetura

Monorepo com solution Visual Studio e separação entre frontend e backend:

```text
frontend Next.js/React
        │ HTTP/JSON/CSV + JWT/cookie de refresh
        ▼
Financeiro.Api (ASP.NET Core)
        │ contratos e regras
        ▼
Financeiro.Application ─ Financeiro.Domain
        │ EF Core/Identity/Npgsql
        ▼
PostgreSQL
```

O frontend e o backend são implantados separadamente. O frontend está preparado para Vercel. O backend ASP.NET Core deve ser executado em container ou serviço próprio, como Render, Railway, Azure ou Fly.io. O PostgreSQL pode ser local, Docker, Neon, Supabase ou outro provedor compatível.

### Stack detectada

- .NET SDK `10.0.401`, target `net10.0`.
- ASP.NET Core Web API.
- Entity Framework Core `10.0.0`.
- Npgsql PostgreSQL provider `10.0.0`.
- ASP.NET Identity com usuários `Guid`.
- JWT Bearer, refresh tokens opacos e cookies HttpOnly.
- Serilog, Swagger/Swashbuckle, ProblemDetails e rate limiting nativo.
- Next.js `15.5.26`.
- React `19.3.0`.
- JavaScript, sem TypeScript.
- Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Lucide, next-themes, Sonner e Vitest.
- Node.js `24.20.0` e npm `11.19.0`.

### Estrutura principal

```text
Financeiro-Api/
├── Financeiro-Api.sln
├── global.json
├── Directory.Build.props
├── dotnet-tools.json
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── src/
│   │   ├── Financeiro.Api/            # composição, controllers, auth, health, Swagger
│   │   ├── Financeiro.Application/   # DTOs, requests, responses e contratos
│   │   ├── Financeiro.Domain/        # entidades, enums e cálculos
│   │   └── Financeiro.Infrastructure/# EF Core, Identity, migrations, tokens, seed
│   └── tests/
│       ├── Financeiro.UnitTests/
│       └── Financeiro.IntegrationTests/
├── frontend/                          # Next.js App Router em JavaScript
├── docs/
└── scripts/
```

## 2. O que já foi concluído

### Backend

- Solution clássica `Financeiro-Api.sln` criada para Visual Studio.
- Projetos em camadas Domain, Application, Infrastructure e Api.
- Controllers para autenticação, usuários, contas, categorias, transações, transferências, dashboard, orçamentos, metas, investimentos, dívidas, assinaturas, cartões, faturas, relatórios, busca, notificações e CSV.
- `ProblemDetails` e handler global de exceções.
- Logging estruturado com Serilog e `TraceIdentifier`/correlation id no erro.
- Headers básicos de segurança.
- CORS configurável por ambiente.
- Rate limiting no grupo de autenticação.
- Health checks separados:
  - `/health/live`: processo.
  - `/health/ready`: conexão PostgreSQL.
- A API aceita `ConnectionStrings__Postgres` e `ConnectionStrings__DefaultConnection`.
- O Docker Compose usa `ConnectionStrings__Postgres`.
- `Database__ApplyMigrations=true` executa `Database.MigrateAsync()` no startup para um release controlado; `EnsureCreated` não é usado.

### Frontend

- Next.js App Router em JavaScript.
- Rotas de login, cadastro e recuperação de senha.
- Shell autenticado com sidebar, menu móvel, tema claro/escuro e navegação por módulos.
- Dashboard com KPIs e gráficos.
- Páginas para contas, transações, categorias, cartões, transferências, orçamentos, metas, investimentos, dívidas, assinaturas, calendário, relatórios, importação/exportação e configurações.
- Estados de loading, erro e empty state em componentes compartilhados.
- Cliente API centralizado em `frontend/lib/api.js`.
- `NEXT_PUBLIC_DEMO_MODE` é opt-in; o valor esperado para produção é `false`.
- Logout agora chama a API e remove o cookie de sessão do frontend.
- Relatórios, preview/exportação CSV usam a API quando o modo demo está desligado.
- Build standalone configurado para Windows com `fileURLToPath` em `next.config.mjs`.

### Banco e modelo

- `FinanceiroDbContext` usa schema PostgreSQL `financeiro`.
- ASP.NET Identity incluído no mesmo contexto.
- Entidades financeiras têm `UserId`.
- Query filters por usuário foram configurados para os registros financeiros.
- Índices de usuário, datas, status, faturas, orçamentos, notificações e refresh tokens.
- Unique constraints para orçamento por usuário/categoria/mês/ano, fatura por cartão/mês/ano, notification key e hash de refresh token.
- FKs e comportamentos de delete configurados.
- Valores monetários usam `decimal`, com precision monetária configurada em entidades principais.

### Migrations

Migration real gerada:

```text
backend/src/Financeiro.Infrastructure/Migrations/20260927030932_InitialCreate.cs
backend/src/Financeiro.Infrastructure/Migrations/20260927030932_InitialCreate.Designer.cs
backend/src/Financeiro.Infrastructure/Migrations/FinanceiroDbContextModelSnapshot.cs
```

A migration contém tabelas de domínio e tabelas do ASP.NET Identity, incluindo `RefreshTokens`, contas, transações, categorias, cartões, faturas, compras, parcelas, transferências, orçamentos, metas, investimentos, dívidas, assinaturas, notificações e configurações.

A descoberta design-time foi validada com caminhos explícitos e retornou:

```text
20260927030932_InitialCreate
```

A migration **não foi aplicada a PostgreSQL real** nesta máquina.

### Autenticação e segurança

- Cadastro, login, refresh, logout, recuperação e redefinição de senha.
- ASP.NET Identity para hash de senha e lockout.
- JWT com validação de issuer, audience, lifetime e signing key.
- Chave JWT exige pelo menos 32 caracteres no `TokenService`.
- Refresh tokens gerados com bytes aleatórios, armazenados somente como SHA-256.
- Rotação de refresh token.
- Detecção de reutilização e revogação da família.
- Cookie HttpOnly para refresh token.
- `Auth__CookieSameSite` permite escolher a política de cookie; localmente `Lax` é o padrão e produção cross-site deve usar HTTPS e configuração compatível, normalmente `None`.
- Resposta genérica no fluxo de recuperação de senha.
- Tokens de recuperação não são retornados nem registrados em logs pelo código.
- Ownership reforçado por `UserId`, query filters e validações de associação.
- Seed desativado por padrão no Docker Compose e restrito a Development.

### Módulos financeiros

Implementados no backend e representados no frontend:

- Contas e cálculo de saldo.
- Categorias.
- Receitas e despesas com status, datas, recorrência e parcelas.
- Transferências atômicas com duas movimentações vinculadas.
- Cartões, compras parceladas, faturas e pagamento de faturas.
- Orçamentos por categoria e período.
- Metas e contribuições.
- Investimentos com quantidade, preço médio, preço atual e rentabilidade.
- Dívidas e parcelas.
- Assinaturas.
- Dashboard, relatórios, busca e notificações.
- Exportação CSV e preview de importação CSV.

### Testes

- Testes unitários de regras de saldo, contribuições de metas e valores de investimentos.
- Teste de integração com `WebApplicationFactory` e Testcontainers PostgreSQL.
- O teste de integração cobre cadastro, contas, categoria, transação, transferência, cartão, compra parcelada, segundo usuário e isolamento.
- O teste só inicia PostgreSQL quando `RUN_POSTGRES_INTEGRATION=true`.
- Sem essa variável, a suíte passa sem alegar que PostgreSQL real foi testado.
- O pacote Testcontainers foi atualizado para `4.15.0`, que usa `SSH.NET 2026.0.0`.

### Docker

- `backend/Dockerfile` multi-stage com SDK/runtime .NET 10; o processo usa `PORT` quando fornecida pelo provedor e `8080` como fallback.
- `docker-compose.yml` com PostgreSQL 17 Alpine, API, volume persistente e health checks.
- O Compose aguarda PostgreSQL saudável antes de iniciar a API.
- O health check da API usa `/health/ready`.
- Docker Desktop não estava instalado/funcional durante esta sessão, portanto o Compose não foi executado.

### Documentação e scripts

Existem:

- `README.md`.
- `docs/architecture.md`.
- `docs/api.md`.
- `docs/data-model.md`.
- `docs/deployment.md`.
- `docs/backup-recovery.md`.
- `scripts/setup.ps1`.
- `scripts/run-dev.ps1`.
- `docker-compose.yml`.
- `.env.example`.
- `frontend/.env.example` e `frontend/.env.local.example`.

A estratégia mínima de backup, restore, retenção e recuperação está em `docs/backup-recovery.md`.

## 3. Estado atual real

### Funcionando/verificado

- Solution e projetos compilam em Release.
- Backend build final: 0 erros e 0 warnings.
- Testes unitários: 3 aprovados.
- Suíte padrão de backend: 4 aprovados no total; o teste de integração PostgreSQL fica condicionado e, sem a variável de execução real, retorna sem iniciar container.
- Frontend `npm install`: concluído.
- Frontend lint: concluído com 0 erros e 2 warnings estilísticos não bloqueantes em `eslint.config.mjs` e `postcss.config.mjs`.
- Frontend tests: 3 aprovados.
- Frontend build: concluído com 21 rotas estáticas.
- API iniciada localmente sem banco: `/health/live` retornou HTTP 200.
- Swagger em Development retornou HTTP 200.
- Migration foi descoberta pelo EF.
- Auditoria NuGet final não encontrou vulnerabilidades.
- Working tree estava limpo antes deste arquivo, exceto `desktop.ini` não rastreado.

### Parcialmente validado

- Autenticação, ownership, refresh rotation, cartões e isolamento têm código e testes preparados, mas o fluxo completo PostgreSQL real não foi executado nesta máquina.
- `/health/ready` foi executado e retornou HTTP 503 porque o PostgreSQL não estava acessível. Isso confirma que o readiness check detecta a ausência do banco.
- Frontend está configurado para `NEXT_PUBLIC_DEMO_MODE=false` e possui caminhos de API real, mas o fluxo completo frontend → API → PostgreSQL não foi executado.
- Migration e snapshot existem e são compilados, mas ainda não foram aplicados nem inspecionados em um banco real.

### Não testado

- `docker compose config` com Docker instalado.
- `docker compose up --build -d`.
- PostgreSQL real.
- `dotnet ef database update` contra banco real.
- Teste de integração com Testcontainers executando container real.
- Login/cadastro/refresh/logout ponta a ponta contra PostgreSQL.
- Criação real de todos os módulos através de API e frontend.
- Teste visual em browsers e larguras reais.
- Deploy em Vercel ou provedor do backend.

## 4. Últimos resultados de validação

### Backend

Comandos executados:

```powershell
dotnet restore Financeiro-Api.sln
dotnet build Financeiro-Api.sln --configuration Release --no-restore
dotnet test Financeiro-Api.sln --configuration Release --no-build
```

Resultado final:

```text
Build: PASS — 0 erros, 0 warnings
UnitTests: 3 aprovados
IntegrationTests padrão: 1 aprovado condicionado, sem PostgreSQL real
```

Tentativa de integração real:

```powershell
$env:RUN_POSTGRES_INTEGRATION = "true"
dotnet test backend/tests/Financeiro.IntegrationTests/Financeiro.IntegrationTests.csproj --configuration Release --no-build
```

Resultado:

```text
FAIL — Docker is either not running or misconfigured
Failed to connect to Docker endpoint at npipe://./pipe/docker_engine
```

### Frontend

Comandos executados:

```powershell
npm install --prefix frontend --registry https://registry.npmjs.org
npm run lint --prefix frontend
npm test --prefix frontend -- --run
npm run build --prefix frontend
```

Resultados:

- Install: PASS.
- Lint: PASS com 2 warnings estilísticos.
- Testes: PASS, 1 arquivo e 3 testes.
- Build: PASS, Next.js 15.5.26 e 21 rotas geradas.

Também foram executados:

```powershell
npm ls --prefix frontend --depth=0
npm outdated --prefix frontend
```

O `npm outdated` mostrou atualizações disponíveis, incluindo Next.js 16 e Vitest 5, mas não foram aplicadas por serem upgrades potencialmente breaking.

### npm audit

Comando:

```powershell
npm audit --prefix frontend --audit-level=moderate
```

Resultado: FAIL com 4 vulnerabilidades:

- 3 moderadas em `@vitest/mocker`, dependência de tooling/testes.
- 1 alta em `postcss`, transitiva pelo Next.js.
- A correção automática exige Vitest 5 e Next.js 16.
- `npm audit fix --force` não foi executado.
- O impacto direto no bundle de produção não foi demonstrado; Vitest é tooling e PostCSS é usado no pipeline/build, não como funcionalidade financeira do navegador.

### NuGet audit

Comando:

```powershell
dotnet list Financeiro-Api.sln package --vulnerable --include-transitive
```

Resultado: PASS. Nenhum pacote vulnerável reportado nos projetos da solution.

A cadeia corrigida foi verificada com:

```text
Testcontainers.PostgreSql 4.15.0
└── Testcontainers 4.15.0
    └── SSH.NET 2026.0.0
```

### Migrations

Comando validado:

```powershell
dotnet tool run dotnet-ef migrations list `
  --context FinanceiroDbContext `
  --project backend/src/Financeiro.Infrastructure/Financeiro.Infrastructure.csproj `
  --startup-project backend/src/Financeiro.Api/Financeiro.Api.csproj `
  --configuration Debug `
  --no-connect
```

Resultado: PASS na descoberta de `20260927030932_InitialCreate`. O status aplicado/pendente não pode ser determinado sem conexão com o banco.

### PostgreSQL e Docker

- PostgreSQL local/`psql`: não detectado.
- Docker CLI: não detectado.
- Docker Desktop: não instalado/funcional.
- WSL: não instalado.
- Compose real: não executado.
- Database update: não executado contra banco real.

O instalador do Docker Desktop via `winget` foi tentado, mas não concluiu durante a sessão. Consultas posteriores de `winget` foram interrompidas automaticamente pelo ambiente por pressão crítica de memória; não interpretar isso como confirmação de instalação.

### Health checks e Swagger

A API foi iniciada localmente em HTTP, sem PostgreSQL:

```text
GET /health/live   → 200 Healthy
GET /health/ready  → 503 Unhealthy, PostgreSQL indisponível
GET /swagger/index.html → 200
```

O `503` de readiness é esperado sem banco e não representa falha do código do health check.

### Frontend → API

Não foi validado ponta a ponta contra banco real. O código foi ajustado para:

- usar `NEXT_PUBLIC_API_URL`;
- manter access token em memória;
- renovar via `/auth/refresh`;
- chamar logout real;
- usar endpoints reais de relatórios e CSV quando `NEXT_PUBLIC_DEMO_MODE=false`.

## 5. Alterações importantes recentes

- `Testcontainers.PostgreSql` atualizado de `4.8.1` para `4.15.0`, eliminando a cadeia vulnerável com SSH.NET antigo.
- `Microsoft.EntityFrameworkCore.Design` removido da camada Infrastructure; permanece no projeto startup da API.
- Comandos de migration documentados com `--context`, caminhos `.csproj` explícitos e startup project correto.
- Teste de isolamento corrigido para autenticar efetivamente o segundo usuário antes de consultar recurso do primeiro.
- Construtor obsoleto do `PostgreSqlBuilder` substituído.
- Warning de using duplicado removido.
- Warnings de nullable em projeções corrigidos.
- `outputFileTracingRoot` do Next corrigido para Windows.
- `ConnectionStrings__Postgres` alinhado entre API, README e Compose.
- Seed do Compose alterado para desligado por padrão e nomes `Seed__Email`/`Seed__Password` alinhados ao código.
- Health check de PostgreSQL adicionado ao readiness.
- Logout real implementado no `AppShell`.
- Relatórios passaram a consultar API em modo não-demo.
- Preview e exportação CSV receberam caminhos de API real.
- Dados estáticos de calendário e perfil demo foram restringidos ao modo demo.
- Cookie de refresh passou a aceitar `Auth__CookieSameSite`, necessário para cenários cross-origin em produção.
- Procedimento de backup e recuperação criado em `docs/backup-recovery.md`.

Arquivos recentes importantes:

```text
backend/src/Financeiro.Api/Program.cs
backend/src/Financeiro.Api/Infrastructure.cs
backend/src/Financeiro.Api/Controllers/AuthController.cs
backend/src/Financeiro.Api/appsettings.json
backend/tests/Financeiro.IntegrationTests/ApiIntegrationTests.cs
backend/tests/Financeiro.IntegrationTests/Financeiro.IntegrationTests.csproj
docker-compose.yml
frontend/components/app-shell.js
frontend/components/analysis-pages.js
frontend/next.config.mjs
frontend/package.json
frontend/package-lock.json
README.md
docs/deployment.md
docs/backup-recovery.md
```

## 6. Commits locais

Comando executado:

```powershell
git log --oneline -10
```

Resultado:

```text
4852a25 fix: make refresh cookie deployment configurable
cec1df3 fix: complete runtime validation hardening
c10b479 fix: harden final validation setup
f927e76 fix: validate production readiness
3c59962 chore: scaffold Financeiro-Api platform
```

Comando executado antes da criação deste handoff:

```powershell
git status
```

Resultado real antes deste arquivo:

```text
On branch main
Untracked files:
  desktop.ini

nothing added to commit but untracked files present
```

`desktop.ini` já estava não rastreado e não foi removido nem alterado. Este próprio `docs/SESSION-HANDOFF.md` também aparecerá como novo arquivo não rastreado até ser incluído em um commit local futuro.

Não foi configurado remote, não foi feito push e nenhuma ação no GitHub foi executada.

## 7. Pendências priorizadas

1. Instalar e configurar Docker Desktop, se for possível neste ambiente.
2. Instalar/configurar WSL 2, pois `wsl --status` e `wsl -l -v` informaram que o WSL não está instalado.
3. Confirmar `docker info` e `docker compose version` após a instalação.
4. Executar `docker compose config`.
5. Executar `docker compose up --build -d` e confirmar containers sem restart loop.
6. Confirmar PostgreSQL healthy e API healthy.
7. Executar a migration real com `dotnet ef database update`.
8. Inspecionar tabelas, FKs, índices, constraints, schema `financeiro`, Identity e `RefreshTokens` no PostgreSQL.
9. Executar o teste com `RUN_POSTGRES_INTEGRATION=true` contra Docker real.
10. Testar os fluxos auth, ownership, cartões, faturas, parcelas, transferências, orçamentos e metas contra banco real.
11. Validar frontend com `NEXT_PUBLIC_DEMO_MODE=false` contra API e PostgreSQL reais.
12. Corrigir ou planejar, com compatibilidade validada, as vulnerabilidades npm de Vitest/PostCSS. Não aplicar `npm audit fix --force` sem validar Next 16/Vitest 5.
13. Fazer teste visual/e2e real em browser, se a ferramenta estiver disponível.
14. Decidir o destino do `desktop.ini` não rastreado; não removê-lo automaticamente sem confirmar sua origem/necessidade.
15. Reavaliar a exposição de Swagger fora de Development antes de produção.
16. Configurar secrets reais somente no provedor, nunca no Git.

## 8. Docker / WSL / PostgreSQL

### Docker Desktop

- Estado: **não instalado ou não funcional**.
- `docker version`: comando não reconhecido.
- `docker compose`: não validado porque o Docker CLI não existe.
- Tentativa de instalação via `winget --id Docker.DockerDesktop`: não concluiu dentro da sessão.
- Não há versão detectada.
- Docker Engine: indisponível.

### WSL

Comandos executados:

```powershell
wsl --status
wsl -l -v
```

Ambos retornaram que o Subsistema do Windows para Linux não está instalado e sugeriram:

```powershell
wsl.exe --install
```

Não há distribuição WSL detectada. A instalação pode exigir reinicialização e privilégios administrativos; a próxima sessão deve executar isso somente se necessário e acompanhar o resultado real.

### PostgreSQL

- `psql` não foi detectado.
- PostgreSQL local não estava acessível.
- Não foi possível aplicar migration ou consultar tabelas.
- A API sem banco iniciou, mas `/health/ready` retornou 503.
- A alternativa recomendada continua sendo Docker Compose com PostgreSQL 17 Alpine, depois de Docker Desktop/WSL funcionais.

Erros relevantes:

```text
Docker is either not running or misconfigured.
Failed to connect to Docker endpoint at npipe://./pipe/docker_engine.
```

E, em tentativa anterior de EF contra PostgreSQL local:

```text
autenticação do tipo senha falhou para o usuário "postgres"
```

## 9. Comandos para continuar

Executar a partir de `C:\Users\vitor\Financeiro-Api`.

### Primeiro: estado das ferramentas

```powershell
wsl --status
wsl -l -v
docker version
docker compose version
Get-Command psql -ErrorAction SilentlyContinue
```

Se WSL ainda não estiver instalado e Docker Desktop for necessário:

```powershell
wsl.exe --install
```

Esse comando pode exigir reinicialização. Não assumir sucesso sem verificar novamente `wsl --status` e `wsl -l -v`.

### Depois: Docker Compose

Somente quando `docker version` e `docker compose version` funcionarem:

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 postgres api
```

Confirmar:

```powershell
Invoke-WebRequest http://localhost:8080/health/live -UseBasicParsing
Invoke-WebRequest http://localhost:8080/health/ready -UseBasicParsing
```

### Migration real

Com PostgreSQL e API/configuração disponíveis:

```powershell
dotnet tool restore
dotnet ef migrations list `
  --context FinanceiroDbContext `
  --project backend/src/Financeiro.Infrastructure/Financeiro.Infrastructure.csproj `
  --startup-project backend/src/Financeiro.Api/Financeiro.Api.csproj

dotnet ef database update `
  --context FinanceiroDbContext `
  --project backend/src/Financeiro.Infrastructure/Financeiro.Infrastructure.csproj `
  --startup-project backend/src/Financeiro.Api/Financeiro.Api.csproj
```

### Testes reais

```powershell
$env:RUN_POSTGRES_INTEGRATION = "true"
dotnet test Financeiro-Api.sln --configuration Release
Remove-Item Env:RUN_POSTGRES_INTEGRATION
```

### Revalidação completa

```powershell
dotnet restore Financeiro-Api.sln
dotnet build Financeiro-Api.sln --configuration Release
dotnet test Financeiro-Api.sln --configuration Release

npm install --prefix frontend
npm run lint --prefix frontend
npm test --prefix frontend -- --run
npm run build --prefix frontend
npm audit --prefix frontend

dotnet list Financeiro-Api.sln package --vulnerable --include-transitive
```

### Inspeção de tabelas PostgreSQL

Com `psql` e credenciais fornecidas apenas por ambiente/secret manager:

```powershell
$env:PGPASSWORD = '<senha-local-ou-do-secret-manager>'
psql --host=localhost --port=5432 --username=financeiro --dbname=financeiro -c '\\dn'
psql --host=localhost --port=5432 --username=financeiro --dbname=financeiro -c '\\dt financeiro.*'
psql --host=localhost --port=5432 --username=financeiro --dbname=financeiro -c 'SELECT * FROM financeiro."__EFMigrationsHistory";'
Remove-Item Env:PGPASSWORD
```

Não substituir `<senha-local-ou-do-secret-manager>` por uma senha real dentro deste arquivo.

## 10. Como executar o projeto

### Backend sem Docker

É necessário PostgreSQL acessível e variáveis configuradas:

```powershell
$env:ConnectionStrings__Postgres = "Host=localhost;Port=5432;Database=financeiro;Username=financeiro;Password=<senha>"
$env:Jwt__Key = "<chave-aleatoria-com-pelo-menos-32-caracteres>"
$env:Jwt__Issuer = "Financeiro.Api"
$env:Jwt__Audience = "Financeiro.Web"
$env:Auth__CookieSameSite = "Lax"
$env:Cors__Origins__0 = "http://localhost:3000"
$env:Seed__Enabled = "false"

dotnet run --project backend/src/Financeiro.Api/Financeiro.Api.csproj --urls http://localhost:8080
```

### Frontend

Criar `frontend/.env.local` sem secrets:

```text
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_DEMO_MODE=false
```

Executar:

```powershell
npm install --prefix frontend
npm run dev --prefix frontend
```

Abrir `http://localhost:3000`.

### Docker

Depois de Docker funcional:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

A API ficará em `http://localhost:8080` e o PostgreSQL em `localhost:5432`. O Compose inicia com seed desligado. Para habilitar dados de demonstração somente em Development, fornecer `Seed__Enabled=true`, `Seed__Email` e `Seed__Password` pelo ambiente, sem gravar credenciais no Git.

## 11. Limitações conhecidas

- PostgreSQL real não foi validado nesta máquina.
- Docker Desktop não foi instalado/validado.
- WSL não está instalado.
- Migration real existe, mas não foi aplicada a um banco real.
- Testcontainers está preparado, mas a integração real não foi executada.
- Frontend foi compilado com `NEXT_PUBLIC_DEMO_MODE=false` como configuração, mas não foi testado ponta a ponta contra uma API com banco real.
- npm audit ainda reporta 4 vulnerabilidades transitivas; resolver exige upgrade breaking de Vitest/Next.
- O preço de investimentos é informado manualmente; não há cotação externa.
- Exportação obrigatória é CSV; Excel/PDF não fazem parte do núcleo.
- O preview de importação CSV existe; confirmação/persistência completa das linhas ainda não está implementada como fluxo completo.
- Calendário e configurações têm telas funcionais/parcialmente conectadas, mas ainda precisam de validação real de todas as interações.
- Swagger fica habilitado em Development; avaliar proteção explícita ou desativação em produção.
- Não houve deploy real.
- Não houve ação no GitHub.

## 12. Instruções para a próxima sessão

Para continuar:
- não recrie o projeto;
- não volte ao planejamento;
- leia este arquivo primeiro;
- execute git status e git log;
- inspecione os arquivos existentes;
- continue apenas pelas pendências;
- preserve trabalho válido;
- corrija erros encontrados;
- valide tudo que for possível;
- não faça nenhuma ação relacionada ao GitHub.
