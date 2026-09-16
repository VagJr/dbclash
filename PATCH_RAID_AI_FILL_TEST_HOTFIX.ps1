$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RAID AI FILL - TEST SUITE HOTFIX ===" -ForegroundColor Cyan
Write-Host "Este hotfix atualiza apenas a suite de testes de Raid para a nova regra de 15s + bots." -ForegroundColor DarkYellow

$src = Join-Path $PSScriptRoot "test-release-raid-ai-fill-hotfix.mjs"
$dst = ".\scripts\test-release-raid.mjs"

if (-not (Test-Path $src)) { throw "test-release-raid-ai-fill-hotfix.mjs nao encontrado." }
if (-not (Test-Path $dst)) { throw "Execute na raiz C:\dbclash." }

Copy-Item $dst "$dst.raid-ai-fill-test-hotfix.bak" -Force
Copy-Item $src $dst -Force
Write-Host "[OK] scripts\test-release-raid.mjs atualizado"

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
node --check $dst
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe na suite Raid." }

Write-Host ""
Write-Host "=== TESTE RAID ===" -ForegroundColor Yellow
npm run test:raid
if ($LASTEXITCODE -ne 0) { throw "Teste Raid falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== RAID AI FILL TEST HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Se tudo estiver verde, proximo passo: smoke test real de fila 1x1 e Raid."
