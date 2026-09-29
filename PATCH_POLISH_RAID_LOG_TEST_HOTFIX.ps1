$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH POLISH RAID LOG TEST HOTFIX ===" -ForegroundColor Cyan
Write-Host "Este hotfix altera somente a suite de testes polish." -ForegroundColor DarkYellow

$patcher = Join-Path $PSScriptRoot "fix-polish-raid-log-test.mjs"
if (-not (Test-Path $patcher)) { throw "fix-polish-raid-log-test.mjs nao encontrado." }
if (-not (Test-Path ".\scripts\test-release-polish.mjs")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== ATUALIZANDO TESTE RAID ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar teste polish do Raid." }

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
Write-Host "=== POLISH RAID LOG HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Se tudo ficar verde, partimos para o smoke test real do Raid solo."
