$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH AUDIO IMPACT HOTFIX ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "fix-audio-impact-fallback.mjs"
if (-not (Test-Path $patcher)) { throw "fix-audio-impact-fallback.mjs nao encontrado." }
if (-not (Test-Path ".\js\ui-manager.js")) { throw "Execute na raiz C:\dbclash." }

Write-Host ""
Write-Host "=== CORRIGINDO IMPACT ROUTING ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha no Audio Impact Hotfix." }

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
node --check js\ui-manager.js
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe em js/ui-manager.js." }

Write-Host ""
Write-Host "=== TESTE DE AUDIO ===" -ForegroundColor Yellow
npm run test:audio
if ($LASTEXITCODE -ne 0) { throw "Teste de audio ainda falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== AUDIO IMPACT HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Se tudo estiver verde, reinicie frontend e limpe o Service Worker uma vez."
