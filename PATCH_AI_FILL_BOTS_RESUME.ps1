$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH AI FILL & BOT RUNTIME - RESUME ===" -ForegroundColor Cyan
Write-Host "Nao execute o patch anterior novamente." -ForegroundColor DarkYellow

$patcher = Join-Path $PSScriptRoot "resume-ai-fill-bots.mjs"
if (-not (Test-Path $patcher)) { throw "resume-ai-fill-bots.mjs nao encontrado." }
if (-not (Test-Path ".\server.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== CONTINUANDO APLICACAO ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha no resume AI Fill." }

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow
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
Write-Host "=== RESUME AI FILL VALIDADO ===" -ForegroundColor Green
Write-Host "Agora reinicie npm start e teste Ranked 1x1 aguardando 15 segundos."
