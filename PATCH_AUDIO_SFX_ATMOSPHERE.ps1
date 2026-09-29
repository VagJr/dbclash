$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH AUDIO + SFX + ATMOSPHERE ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-audio-atmosphere-cycle.mjs"
if (-not (Test-Path $patcher)) { throw "apply-audio-atmosphere-cycle.mjs nao encontrado." }
if (-not (Test-Path ".\js\audio.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== APLICANDO ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar Audio Cycle." }

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow
$files = @(
  "js\audio.js",
  "js\ui-manager.js",
  "js\scene-manager.js",
  "sw.js",
  "scripts\test-release-audio.mjs"
)
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe: $file" }
  Write-Host "[OK] $file"
}

Write-Host ""
Write-Host "=== TESTE DE AUDIO ===" -ForegroundColor Yellow
npm run test:audio
if ($LASTEXITCODE -ne 0) { throw "Teste de audio falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== AUDIO CYCLE VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie o servidor estatico e faca Unregister do Service Worker uma vez."
