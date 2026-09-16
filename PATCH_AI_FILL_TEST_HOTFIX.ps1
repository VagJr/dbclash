$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH AI FILL - TEST HOTFIX ===" -ForegroundColor Cyan
Write-Host "Este hotfix altera apenas o teste estatico do ciclo Bot AI." -ForegroundColor DarkYellow

$src = Join-Path $PSScriptRoot "test-release-bot-ai-hotfix.mjs"
$dst = ".\scripts\test-release-bot-ai.mjs"

if (-not (Test-Path $src)) { throw "test-release-bot-ai-hotfix.mjs nao encontrado." }
if (-not (Test-Path $dst)) { throw "Execute na raiz C:\dbclash." }

Copy-Item $dst "$dst.ai-fill-test-hotfix.bak" -Force
Copy-Item $src $dst -Force

Write-Host "[OK] scripts\test-release-bot-ai.mjs atualizado"

Write-Host ""
Write-Host "=== SINTAXE DO TESTE ===" -ForegroundColor Yellow
node --check $dst
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe no teste." }

Write-Host ""
Write-Host "=== TESTE BOT AI ===" -ForegroundColor Yellow
npm run test:bot-ai
if ($LASTEXITCODE -ne 0) { throw "Teste Bot AI ainda falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== AI FILL TEST HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Agora execute smoke test real: Ranked 1x1 sozinho por 15 segundos."
