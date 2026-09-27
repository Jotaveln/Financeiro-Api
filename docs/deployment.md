# Deploy

## Banco PostgreSQL

Crie uma instância em Neon, Supabase ou outro PostgreSQL gerenciado com TLS. Configure `ConnectionStrings__Postgres` no backend. Execute migrations como etapa controlada de release, nunca a cada request.

## Backend em container

O `backend/Dockerfile` publica `Financeiro.Api` em imagem ASP.NET 10 na porta 8080. Configure no provedor:

- `ASPNETCORE_URLS=http://+:8080`
- `ConnectionStrings__Postgres`
- `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`
- `Cors__Origins__0=https://seu-frontend.vercel.app`
- `Frontend__Url=https://seu-frontend.vercel.app`
- `Seed__Enabled=false` em produção
- `Email__WebhookUrl` ou integração SMTP segura

### Render

Crie Web Service tipo Docker, contexto do repositório na raiz e Dockerfile `backend/Dockerfile`. Adicione health check `/health/ready`, variáveis acima e a URL pública da API.

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
4. Configure `NEXT_PUBLIC_API_URL=https://api.exemplo.com/api/v1` e `NEXT_PUBLIC_DEMO_MODE=false`.
5. Adicione o domínio Vercel em `Cors__Origins__0` do backend.

Cookies de refresh precisam de HTTPS e política compatível com o domínio de API. Se frontend e API forem domínios diferentes, valide `SameSite`, CORS e `AllowCredentials` no ambiente de produção.

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
