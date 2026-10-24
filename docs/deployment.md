# Deploy

## Banco PostgreSQL

Crie uma instância PostgreSQL gerenciada com TLS (Render PostgreSQL, Neon, Supabase ou equivalente). Configure `ConnectionStrings__Postgres` no backend. A migration existente (`20260927030932_InitialCreate`) cria o schema `financeiro`, ASP.NET Identity (`AspNetUsers`, `AspNetRoles`, claims/logins/tokens), `RefreshTokens` e as entidades financeiras; não use `EnsureCreated`.

### Aplicação controlada da migration

A API aplica migrations somente quando `Database__ApplyMigrations=true`. No primeiro release do Render, configure temporariamente essa variável como `true`, faça o deploy e aguarde `/health/ready`. O processo executa `Database.MigrateAsync()` antes de aceitar requests; se falhar, o serviço não deve ser considerado saudável. Depois de confirmar o release, altere para `false` para que novas migrations sejam executadas por uma etapa de release controlada, e não em cada inicialização. Nunca habilite seed em produção.

## Backend em container

O `backend/Dockerfile` publica `Financeiro.Api` em imagem ASP.NET 10 na porta 8080. Configure no provedor:

- `ASPNETCORE_ENVIRONMENT=Production`
- `PORT` (fornecida pelo Render; o container usa `8080` quando ausente)
- `ConnectionStrings__Postgres`
- `Jwt__Key` (segredo aleatório com pelo menos 32 caracteres), `Jwt__Issuer`, `Jwt__Audience`
- `Cors__Origins__0=https://seu-frontend.vercel.app` (origem exata, sem `/` final)
- `Frontend__Url=https://seu-frontend.vercel.app`
- `Auth__CookieSameSite=None` (frontend e API em domínios HTTPS diferentes)
- `Database__ApplyMigrations=true` apenas durante o release controlado que aplica a migration; depois `false`
- `Seed__Enabled=false` em produção
- `Email__WebhookUrl` ou integração SMTP segura

### Render

Crie Web Service tipo Docker, contexto do repositório na raiz e Dockerfile `backend/Dockerfile`. O container escuta a variável `PORT` fornecida pelo Render e usa `8080` localmente. Adicione health check `/health/ready`, variáveis acima e a URL pública da API. O `/health/live` pode ser usado como probe de liveness. O backend processa `X-Forwarded-Proto` para que HTTPS terminado no proxy do Render continue correto.

### Railway

Crie um serviço a partir do repositório, use o Dockerfile e associe PostgreSQL/Railway ou URL gerenciada. Defina a porta e health check nas configurações.

### Azure

Publique a imagem em Container Apps ou use App Service Linux. Configure secrets e CORS no Configuration, habilite HTTPS e defina `/health/ready` como probe.

### Fly.io

Faça build/push da imagem e configure secrets com `fly secrets set`; exponha 8080 e defina health check HTTP. Use PostgreSQL gerenciado fora da imagem.

ASP.NET Core não é hospedado diretamente na Vercel neste projeto.

## Frontend na Vercel

1. Importe o repositório.
2. Defina Root Directory como `frontend`.
3. Build: `npm run build`; Install: `npm install`.
4. Configure `NEXT_PUBLIC_API_URL=https://financeiro-api-s3s7.onrender.com/api/v1` e `NEXT_PUBLIC_DEMO_MODE=false` (ou a URL HTTPS final do serviço Render, se ela mudar).
5. Adicione o domínio Vercel em `Cors__Origins__0` do backend.

Cookies de refresh são HttpOnly e precisam de HTTPS. Como frontend e API ficam em domínios diferentes, use `Auth__CookieSameSite=None`, CORS com a origem exata da Vercel e `AllowCredentials`; não configure um domínio amplo no cookie. O cookie de refresh é emitido pela API em `/api/v1/auth` e o frontend envia `credentials: include`. O marcador `financeiro_session` do frontend é apenas um guard de navegação e não contém credenciais.

## Backup e recuperação

Antes de produção, configure backup automatizado do PostgreSQL, retenção e um teste periódico de restore. Os comandos e o procedimento mínimo estão em `docs/backup-recovery.md`.

## Checklist

- [ ] PostgreSQL com backup/TLS.
- [ ] JWT e credenciais fora do Git.
- [ ] Seed desativado.
- [ ] Migrations aplicadas.
- [ ] CORS restrito.
- [ ] Health checks verdes.
- [ ] Swagger desativado ou protegido fora de Development.
- [ ] Logs sem tokens/PII desnecessária.
- [ ] URL HTTPS da API definida na Vercel.
