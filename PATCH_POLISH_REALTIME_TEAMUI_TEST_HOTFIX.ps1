$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH POLISH REALTIME TEAM UI TEST HOTFIX ===" -ForegroundColor Cyan
Write-Host "Este hotfix altera apenas a suite polish, nao o runtime." -ForegroundColor DarkYellow

$patcher = Join-Path $PSScriptRoot "fix-polish-realtime-teamui-test.mjs"
if (-not (Test-Path $patcher)) { throw "fix-polish-realtime-teamui-test.mjs nao encontrado." }
if (-not (Test-Path ".\scripts\test-release-polish.mjs")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== ATUALIZANDO TESTE ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar teste polish." }

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
node --check scripts\test-release-polish.mjs
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe no teste polish." }

Write-Host ""
Write-Host "=== TESTE POLISH ===" -ForegroundColor Yellow
npm run test:polish
if ($LASTEXITCODE -ne 0) { throw "Teste polish ainda falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== POLISH TEST HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Se tudo ficar verde, o proximo passo e smoke test real de Raid solo e 2v2."
