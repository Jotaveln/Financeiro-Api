# Backup e recuperação

## Backup lógico

Execute em uma máquina com `pg_dump` e acesso à instância PostgreSQL:

```powershell
$env:PGPASSWORD = '<senha-fornecida-pelo-secret-manager>'
pg_dump --format=custom --no-owner --file financeiro-$(Get-Date -Format yyyyMMdd-HHmmss).dump --dbname="host=<host> port=5432 dbname=financeiro user=<usuario> sslmode=require"
Remove-Item Env:PGPASSWORD
```

Não salve a senha no script, no repositório ou no histórico do shell. O arquivo `.dump` contém dados pessoais e deve ser armazenado criptografado, com acesso restrito.

## Restore

Teste o restore em um banco separado antes de substituir o banco ativo:

```powershell
$env:PGPASSWORD = '<senha-do-banco-de-teste>'
createdb --host=<host> --username=<usuario> --dbname=financeiro_restore --maintenance-db=postgres
pg_restore --clean --if-exists --no-owner --dbname="host=<host> port=5432 dbname=financeiro_restore user=<usuario> sslmode=require" financeiro-YYYYMMDD-HHMMSS.dump
Remove-Item Env:PGPASSWORD
```

Depois valide `dotnet ef migrations list` e os health checks. Aplique migrations pendentes somente após confirmar o backup e a compatibilidade.

## Retenção mínima recomendada

- Backup diário por 30 dias.
- Backup semanal por 12 semanas.
- Uma cópia fora do ambiente principal e, quando possível, em região separada.
- Teste de restauração mensal e registro do tempo de recuperação.
- Alertas quando o backup falhar ou estiver atrasado.

Neon, Supabase e outros provedores gerenciados normalmente oferecem snapshots e PITR; habilite-os conforme o plano contratado, sem substituir testes de restore.

## Exportação do usuário

A API oferece `GET /api/v1/import-export/transactions.csv` para exportação das transações do usuário autenticado. O CSV deve ser tratado como dado pessoal. Para uma exportação completa, combine esse endpoint com os recursos autenticados documentados em `docs/api.md` e mantenha os arquivos protegidos.

## Incidente

1. Pause gravações e registre o horário do incidente.
2. Preserve logs e identifique o último backup íntegro.
3. Restaure primeiro em ambiente isolado e valide schema, ownership e contagens.
4. Troque credenciais comprometidas e invalide refresh tokens se houver suspeita de acesso indevido.
5. Faça o cutover somente após validação e registre o procedimento.
