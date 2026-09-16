$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RC1 RANKED 1V1 RUNTIME HOTFIX ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-rc1-ranked-1v1-runtime-hotfix.mjs"
if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-rc1-ranked-1v1-runtime-hotfix.mjs."
}
if (-not (Test-Path ".\server.js")) {
    throw "Execute este hotfix na raiz C:\dbclash."
}

Write-Host ""
Write-Host "=== APLICANDO ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) { throw "Falha ao aplicar hotfix Ranked 1v1." }

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
node --check server.js
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe em server.js." }

node --check scripts\test-rc-ranked-runtime.mjs
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe no teste Ranked." }

Write-Host ""
Write-Host "=== TESTE ESPECIFICO ===" -ForegroundColor Yellow
npm run test:rc-ranked-runtime
if ($LASTEXITCODE -ne 0) { throw "Teste Ranked Runtime falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC Check falhou." }

Write-Host ""
Write-Host "=== HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie npm start e teste a fila 1x1 com duas contas."
