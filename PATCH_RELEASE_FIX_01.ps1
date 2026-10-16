$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 01 - CORE STATE MACHINE ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-01.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-01.mjs ao lado deste arquivo."
}

node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar o patch Node."
}

Write-Host ""
Write-Host "=== TESTES DE REGRESSAO ===" -ForegroundColor Yellow

npm run test:core
if ($LASTEXITCODE -ne 0) {
    throw "Os testes falharam. Nao continue para o proximo patch."
}

Write-Host ""
Write-Host "=== RELEASE FIX 01 CONCLUIDO ===" -ForegroundColor Green
Write-Host "Backups .release-fix-01.bak foram preservados."
Write-Host "Envie a saida completa do terminal para validar o Release Fix 01."
