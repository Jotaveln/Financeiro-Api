# Security — Financeiro-Api

Status: Fase 1 — auditoria e hardening local. Este documento descreve os controles verificados no código e não substitui a validação do ambiente publicado.

## Invariante de isolamento

Cada recurso financeiro é um `UserEntity` com `UserId`. O `FinanceiroDbContext` aplica filtros globais para o usuário autenticado em contas, categorias, transações, transferências, cartões, faturas, compras, parcelas, orçamentos, metas, contribuições, investimentos, dívidas, parcelas de dívidas, assinaturas, notificações e configurações. Os controllers obtêm o usuário exclusivamente do claim JWT por `ICurrentUser`; `UserId` não é aceito no payload.

Os endpoints por ID usam DbSets filtrados e retornam `404` quando o registro não pertence ao usuário atual. Operações que recebem chaves estrangeiras validam a entidade relacionada no DbSet filtrado antes da gravação. Isso cobre transações, transferências, orçamentos, categorias-pai, compras de cartão, pagamentos de fatura e assinaturas. Dashboard, reports, search e exportação também consultam DbSets filtrados.

Essa é uma defesa em profundidade de aplicação. PostgreSQL RLS não está habilitado: adicionar RLS sem uma estratégia segura de variável de sessão por transação seria incompatível com o pool de conexões atual. A cobertura User A/User B deve permanecer obrigatória na suíte de integração.

## Autenticação e sessões

- Access tokens JWT têm issuer, audience, assinatura e expiração validados.
- Refresh tokens são aleatórios, opacos para o cliente, armazenados somente como hash SHA-256, rotacionados por família e revogados quando reutilizados.
- Refresh cookie é HttpOnly, Secure em produção, com SameSite configurável e escopo `/api/v1/auth`.
- Logout exige o usuário do JWT para revogar o token; um token de outro usuário não pode ser revogado pela sessão atual.
- Troca de senha revoga os refresh tokens ativos do usuário; a interface informa esse resultado ao usuário. Reset de senha deve receber o mesmo tratamento antes de ser considerado concluído em produção.
- Lockout do Identity limita tentativas consecutivas de senha. Rate limiting por IP é aplicado ao controller de autenticação; endpoints caros devem manter limites específicos antes do release.
- Respostas de recuperação de senha são genéricas para reduzir enumeração de contas. Tokens, senhas, cookies e cabeçalhos de autorização não devem ser registrados.
- Pagamentos de fatura e parcela usam transação serializável, revalidam o estado e retornam conflito quando o item já está pago. A proteção semântica existe nesta fase, mas a ausência de uma coluna de versão deixa conflitos extremos dependentes do isolamento/constraints do banco; `DebtInstallment` permanece sem `PaymentTransactionId`.

## CSRF, CORS e headers

CORS usa origens explícitas e credenciais; nunca deve usar `AllowAnyOrigin` junto com `AllowCredentials`. Requests de refresh/logout que usam o cookie exigem `Origin` correspondente a uma origem configurada. O frontend mantém o access token somente em memória.

A API envia `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP mínima com `frame-ancestors 'none'` e `Cache-Control: no-store` em `/api/v1`. HSTS permanece habilitado fora de Development.

## Dados sensíveis

O modelo de cartão contém somente metadados e valores financeiros necessários: não armazena CVV, PIN, senha ou PAN completo. Exportações devem conter apenas dados da própria sessão. CSVs de entrada devem ser tratados como dados não confiáveis, limitados por tamanho/linhas/campos e protegidos contra células que comecem por `=`, `+`, `-` ou `@` antes de serem abertas em planilhas.

## Erros, logs e configuração

Respostas de produção usam mensagens genéricas para erros internos e incluem somente um `traceId` para correlação. Detalhes ficam nos logs protegidos. Secrets devem ser fornecidos por ambiente; nenhum JWT key, webhook ou senha real deve entrar no repositório. `Database__ApplyMigrations=false` é o estado operacional padrão e o banco existente não deve ser recriado.

## Validação pendente do checkpoint

A suíte de integração PostgreSQL deve criar User A e User B e testar leitura, edição, exclusão, foreign keys, dashboard, reports, search, exportação, cartões/faturas, metas, dívidas, assinaturas, notificações e configurações. Também devem ser executados build/testes backend e frontend, `npm audit` e `dotnet list ... package --vulnerable --include-transitive`. Resultados não executados por ausência de Docker, PostgreSQL ou serviços externos devem ser reportados como bloqueados, nunca inferidos.

## Riscos restantes

A implementação ainda depende de testes de integração reais para confirmar todos os caminhos e constraints no PostgreSQL. A proteção CSRF por origem agora aceita uma origem configurada ou, quando Origin não é enviado, um Referer cuja autoridade corresponde exatamente a uma origem configurada; requisições com cookie sem ambos são rejeitadas. A lista de origens de produção deve ser HTTPS e conter exatamente a origem pública da Vercel.

Preview CSV é limitado a 5 MiB, 100 registros, 50 campos por registro e 4096 caracteres por campo; conteúdo malformado e tipos não CSV são rejeitados. O preview não persiste transações e não há confirmação de importação nesta fase. Search, CSV, dashboard e reports possuem políticas de rate limit separadas. A exportação ainda deve ser revisada para escapar campos iniciados por `=`, `+`, `-` e `@` antes de abrir em planilhas.

Preferências granulares de notificações não são persistidas porque `UserSettings` não possui campos correspondentes. A exportação CSV é uma rota protegida; o frontend envia Bearer, faz uma tentativa de refresh após `401` e baixa a resposta como `Blob`.

A migration `20260927030932_InitialCreate` existe no repositório e foi compilada, mas não foi aplicada nem verificada em um banco PostgreSQL nesta execução.

A suíte de integração PostgreSQL permanece bloqueada sem `TEST_CONNECTION_STRING` explicitamente autorizada e não produtiva. Não se deve substituir essa variável por uma conexão de produção, `ConnectionStrings__Postgres` ou outro banco. O caminho Testcontainers também depende de Docker operacional; não foi contornado nenhum bloqueio do executor.

A instalação frontend reportou vulnerabilidades transitivas no npm; não foi executado `npm audit fix --force`. Qualquer upgrade major deve ser tratado em rodada separada de compatibilidade. A integração PostgreSQL e a validação de produção não são inferidas a partir do build local.
