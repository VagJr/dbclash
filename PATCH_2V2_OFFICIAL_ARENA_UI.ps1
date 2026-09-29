$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH 2v2 OFFICIAL ARENA UI ===" -ForegroundColor Cyan
Write-Host "Mantem o motor realtime; troca apenas a apresentacao para a arena oficial." -ForegroundColor DarkYellow

$patcher = Join-Path $PSScriptRoot "apply-team-official-arena.mjs"
if (-not (Test-Path $patcher)) { throw "apply-team-official-arena.mjs nao encontrado." }
if (-not (Test-Path ".\js\team-ui.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== APLICANDO ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao integrar 2v2 na arena oficial." }

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
$files = @(
  "js\team-ui.js",
  "js\multiplayer-manager.js",
  "scripts\test-release-team-arena-ui.mjs"
)
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe: $file" }
  Write-Host "[OK] $file"
}

Write-Host ""
Write-Host "=== TESTE UI 2v2 ===" -ForegroundColor Yellow
npm run test:team-ui
if ($LASTEXITCODE -ne 0) { throw "Teste da arena 2v2 falhou." }

Write-Host ""
Write-Host "=== TESTE SOCIAL / 2v2 ===" -ForegroundColor Yellow
npm run test:social
if ($LASTEXITCODE -ne 0) { throw "Teste Social/2v2 falhou." }

Write-Host ""
Write-Host "=== TESTE POLISH ===" -ForegroundColor Yellow
npm run test:polish
if ($LASTEXITCODE -ne 0) { throw "Teste Polish falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== 2v2 OFFICIAL ARENA UI VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie o frontend e teste 2v2: agora deve usar a arena, mao, HUD e botoes oficiais."
