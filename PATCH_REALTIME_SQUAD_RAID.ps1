$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH REALTIME SQUAD 2v2 + RAID ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-realtime-squad-raid.mjs"
if (-not (Test-Path $patcher)) { throw "apply-realtime-squad-raid.mjs nao encontrado." }
if (-not (Test-Path ".\server.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== APLICANDO ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar Realtime Squad/Raid." }

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
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
Write-Host "=== TESTES RAID / 2v2 / BOT ===" -ForegroundColor Yellow
npm run test:raid
if ($LASTEXITCODE -ne 0) { throw "Teste Raid falhou." }
npm run test:social
if ($LASTEXITCODE -ne 0) { throw "Teste Social/2v2 falhou." }
npm run test:bot-ai
if ($LASTEXITCODE -ne 0) { throw "Teste Bot AI falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== REALTIME SQUAD + RAID VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie npm start e teste Raid solo e 2v2 com CPUs." 
