$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH AI FILL - CAPTURE MARKER HOTFIX ===" -ForegroundColor Cyan
Write-Host "Nao rode os patches AI anteriores novamente." -ForegroundColor DarkYellow

$patcher = Join-Path $PSScriptRoot "fix-ai-fill-capture-markers.mjs"
if (-not (Test-Path $patcher)) { throw "fix-ai-fill-capture-markers.mjs nao encontrado." }
if (-not (Test-Path ".\server\tag-team-engine.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== REPARANDO ARQUIVOS ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao reparar capture markers." }

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE COMPLETA ===" -ForegroundColor Yellow
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
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie npm start e teste Ranked 1x1 aguardando 15 segundos."
