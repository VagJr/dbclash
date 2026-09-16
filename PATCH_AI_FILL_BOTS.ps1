$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH AI FILL & BOT RUNTIME ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-bot-ai.mjs"
if (-not (Test-Path $patcher)) { throw "apply-release-bot-ai.mjs nao encontrado." }
if (-not (Test-Path ".\server.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== APLICANDO ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar ciclo AI Fill." }

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
$files = @(
  "server\bot-ai.js",
  "server\server-engine.js",
  "server\tag-team-engine.js",
  "server\raid-room-engine.js",
  "server\product-modes.js",
  "server.js",
  "scripts\test-release-bot-ai.mjs"
)
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe: $file" }
  Write-Host "[OK] $file"
}

Write-Host ""
Write-Host "=== TESTE BOT AI ===" -ForegroundColor Yellow
npm run test:bot-ai
if ($LASTEXITCODE -ne 0) { throw "Teste Bot AI falhou." }

Write-Host ""
Write-Host "=== RELEASE CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== AI FILL & BOT RUNTIME VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie npm start e execute os smoke tests descritos no LEIA-ME."
