# API v1

Base local: `http://localhost:8080/api/v1`. Swagger: `/swagger` em Development. JSON usa enums como strings.

## Autenticação

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cria conta e emite sessão |
| POST | `/auth/login` | Autentica usuário |
| POST | `/auth/refresh` | Rotaciona refresh token |
| POST | `/auth/logout` | Revoga refresh token |
| POST | `/auth/forgot-password` | Solicita e-mail genérico de recuperação |
| POST | `/auth/reset-password` | Confirma nova senha |
| GET/PUT | `/users/me` | Perfil |
| POST | `/users/change-password` | Alteração de senha |
| PUT | `/users/settings` | Moeda, locale, tema e limite de saldo |

Rotas privadas exigem `Authorization: Bearer <token>`. O refresh token é preferencialmente cookie `HttpOnly`.

## Recursos

- `/accounts`: contas, saldo calculado e ativação.
- `/categories`: categorias e subcategorias por tipo de transação.
- `/transactions`: CRUD, filtros `page`, `pageSize`, `search`, `type`, `status`, `from`, `to`, `sort`, `order`; recorrências/parcelas via request.
- `/transfers`: criação atômica entre contas e exclusão do vínculo.
- `/credit-cards`: cartões, compras parceladas e faturas; pagamento em `/credit-cards/invoices/{invoiceId}/pay`.
- `/budgets`: orçamento por categoria/mês/ano com gasto, disponível e percentual.
- `/goals`: metas e `POST /goals/{id}/contributions`.
- `/investments`: posições e rentabilidade calculada a partir do preço informado.
- `/debts`: dívida com cronograma de parcelas, pago/restante, progresso e próximo vencimento; pagamento de parcela em `/debts/{id}/installments/{installmentId}/pay` retorna o `transactionId`, mas a associação durável parcela → transação ainda não é persistida nesta fase.
- `/subscriptions`: recorrências semanais, mensais, trimestrais, semestrais e anuais; a próxima cobrança é derivada e não cria transações automaticamente.
- `/dashboard`: KPIs, fluxo de caixa, categorias, recentes e até 20 próximos eventos financeiros não pagos nos 30 dias seguintes: transações com vencimento, vencimentos de fatura, parcelas de dívida e próxima cobrança de assinatura. A ordenação é por data, tipo, título e ID de origem.
- `/reports/summary`: receita/despesa mensal, categorias e cartões em intervalo; aceita `accountId` opcional e valida ownership.
- `/calendar`: eventos derivados de transações, fechamento e vencimento de faturas, parcelas de dívidas e cobranças de assinaturas.
- `/search?q=`: busca global limitada.
- `/notifications`: listagem em envelope `{ items, page, pageSize, total, totalPages }`, geração idempotente por `UniqueKey` de avisos internos de fatura, parcela, assinatura, orçamento e meta, e marcação como lida.
- `/import-export/transactions.csv`: exportação CSV pt-BR.
- `/import-export/transactions/preview`: preview de upload CSV (limite 5 MB).

## Formato de erro

Erros de pipeline usam `ProblemDetails`/`ValidationProblemDetails`. Nunca envie senhas, tokens ou connection strings em logs ou respostas.

## Exemplos

```json
POST /api/v1/transactions
{
  "description": "Supermercado",
  "amount": 189.90,
  "type": "Expense",
  "status": "Paid",
  "date": "2026-09-26",
  "accountId": "00000000-0000-0000-0000-000000000000",
  "categoryId": null
}
```

```json
POST /api/v1/transfers
{
  "sourceAccountId": "00000000-0000-0000-0000-000000000000",
  "destinationAccountId": "11111111-1111-1111-1111-111111111111",
  "amount": 500,
  "date": "2026-09-26",
  "description": "Reserva"
}
```
