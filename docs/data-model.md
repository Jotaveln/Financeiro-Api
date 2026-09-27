# Modelo de dados

O schema padrão é `financeiro`. Identity mantém usuários e tabelas auxiliares; entidades de negócio possuem `Guid`, timestamps e `UserId`.

- `ApplicationUser` → `UserSettings`, `RefreshToken` e todos os registros do usuário.
- `Account` → `Transaction`; saldo = saldo inicial + transações pagas.
- `Category` → categoria pai opcional, `Transaction` e `Budget`.
- `Transfer` → duas `Transaction` vinculadas (débito/crédito).
- `CreditCard` → `CreditCardInvoice` → `Installment`; `CreditCardPurchase` possui várias parcelas.
- `FinancialGoal` → `GoalContribution`.
- `Debt` → `DebtInstallment`.
- `Investment`, `Subscription`, `Notification` e `UserSettings` são diretamente associados ao usuário.

Índices cobrem `UserId`, datas/status, fatura por cartão/mês/ano, orçamento por usuário/categoria/mês/ano, notification unique key e hash de refresh token. FKs usam restrição ou desassociação onde histórico não pode ser apagado.

Valores monetários são `decimal(18,2)`. Quantidade/preço de investimentos pode exigir precisão adicional em uma migration de produção. Datas financeiras são `DateOnly`; timestamps de auditoria são UTC.

O isolamento também é reforçado por query filters no `FinanceiroDbContext`. Operações administrativas/migrations devem usar `IgnoreQueryFilters` somente para o mecanismo de tokens/seed controlado.
