$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Criado .env a partir de .env.example. Revise as chaves antes de executar.'
}

Write-Host 'Restaurando solução .NET...'
dotnet restore 'Financeiro-Api.sln'

Write-Host 'Instalando dependências do frontend...'
Push-Location 'frontend'
npm install
Pop-Location

Write-Host 'Setup concluído. Configure ConnectionStrings__Postgres e Jwt__Key no ambiente.'
