$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$api = Start-Process dotnet -ArgumentList 'run --project backend/src/Financeiro.Api --urls http://localhost:8080' -WorkingDirectory $root -PassThru
try {
  Push-Location frontend
  npm run dev
} finally {
  Pop-Location
  if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id }
}
