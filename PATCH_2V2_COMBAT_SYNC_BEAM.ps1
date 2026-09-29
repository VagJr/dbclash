$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH 2v2 COMBAT PRESENTATION + SYNC + BEAM CLASH ===" -ForegroundColor Cyan
Write-Host "Nao rode novamente os patches grandes anteriores." -ForegroundColor DarkYellow

$patcher = Join-Path $PSScriptRoot "apply-team-combat-sync.mjs"
if (-not (Test-Path $patcher)) { throw "apply-team-combat-sync.mjs nao encontrado." }
if (-not (Test-Path ".\server\squad-battle-engine.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== APLICANDO ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar ciclo 2v2 Combat Sync." }

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
$files = @(
  "server\squad-battle-engine.js",
  "server\realtime-bot-controllers.js",
  "server\product-modes.js",
  "js\team-ui.js",
  "js\multiplayer-manager.js",
  "scripts\test-release-team-combat-sync.mjs",
  "scripts\test-release-team-arena-ui.mjs"
)
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe: $file" }
  Write-Host "[OK] $file"
}

Write-Host ""
Write-Host "=== TESTE 2v2 COMBAT SYNC ===" -ForegroundColor Yellow
npm run test:team-sync
if ($LASTEXITCODE -ne 0) { throw "Teste 2v2 Combat Sync falhou." }

Write-Host ""
Write-Host "=== TESTE UI 2v2 ===" -ForegroundColor Yellow
npm run test:team-ui
if ($LASTEXITCODE -ne 0) { throw "Teste UI 2v2 falhou." }

Write-Host ""
Write-Host "=== TESTE SOCIAL / 2v2 ===" -ForegroundColor Yellow
npm run test:social
if ($LASTEXITCODE -ne 0) { throw "Teste Social/2v2 falhou." }

Write-Host ""
Write-Host "=== TESTE BOT AI ===" -ForegroundColor Yellow
npm run test:bot-ai
if ($LASTEXITCODE -ne 0) { throw "Teste Bot AI falhou." }

Write-Host ""
Write-Host "=== TESTE POLISH ===" -ForegroundColor Yellow
npm run test:polish
if ($LASTEXITCODE -ne 0) { throw "Teste Polish falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== 2v2 COMBAT SYNC VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie servidor/frontend e teste com duas telas abertas."
