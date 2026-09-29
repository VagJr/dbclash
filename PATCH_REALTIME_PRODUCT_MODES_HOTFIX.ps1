$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH REALTIME PRODUCT MODES HOTFIX ===" -ForegroundColor Cyan
Write-Host "Nao rode novamente o PATCH_REALTIME_SQUAD_RAID.ps1." -ForegroundColor DarkYellow

$patcher = Join-Path $PSScriptRoot "fix-realtime-product-modes-tail.mjs"
if (-not (Test-Path $patcher)) { throw "fix-realtime-product-modes-tail.mjs nao encontrado." }
if (-not (Test-Path ".\server\product-modes.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== REPARANDO startTeamRoom ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao reparar server/product-modes.js." }

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE DO CICLO ===" -ForegroundColor Yellow
$files = @(
  "server\squad-battle-engine.js",
  "server\realtime-bot-controllers.js",
  "server\raid-room-engine.js",
  "server\product-modes.js",
  "server.js",
  "js\raid-rules.js",
  "js\raid-engine.js",
  "js\team-ui.js",
  "js\multiplayer-manager.js",
  "scripts\test-release-raid.mjs",
  "scripts\test-release-social.mjs",
  "scripts\test-release-bot-ai.mjs"
)
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe: $file" }
  Write-Host "[OK] $file"
}

Write-Host ""
Write-Host "=== TESTE RAID ===" -ForegroundColor Yellow
npm run test:raid
if ($LASTEXITCODE -ne 0) { throw "Teste Raid falhou." }

Write-Host ""
Write-Host "=== TESTE 2v2 / SOCIAL ===" -ForegroundColor Yellow
npm run test:social
if ($LASTEXITCODE -ne 0) { throw "Teste Social/2v2 falhou." }

Write-Host ""
Write-Host "=== TESTE BOT AI ===" -ForegroundColor Yellow
npm run test:bot-ai
if ($LASTEXITCODE -ne 0) { throw "Teste Bot AI falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Depois reinicie npm start e teste primeiro o Raid solo por 15 segundos."
