$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 07 - TEST HOTFIX ===" -ForegroundColor Cyan

$source = Join-Path $PSScriptRoot "test-release-polish-fix07-hotfix.mjs"
$target = Join-Path (Get-Location).Path "scripts\test-release-polish.mjs"

if (-not (Test-Path $source)) {
    throw "Nao encontrei test-release-polish-fix07-hotfix.mjs."
}

if (-not (Test-Path $target)) {
    throw "Nao encontrei scripts\test-release-polish.mjs. Execute na raiz C:\dbclash."
}

$backup = "$target.fix07-test-hotfix.bak"
if (-not (Test-Path $backup)) {
    Copy-Item $target $backup
}

Copy-Item $source $target -Force
Write-Host "[OK] scripts/test-release-polish.mjs corrigido" -ForegroundColor Green

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow
node --check scripts\test-release-polish.mjs
if ($LASTEXITCODE -ne 0) {
    throw "Falha de sintaxe no teste corrigido."
}

Write-Host ""
Write-Host "=== RELEASE CHECK COMPLETO ===" -ForegroundColor Yellow
npm run release:check
if ($LASTEXITCODE -ne 0) {
    throw "O Release Check ainda falhou. Envie a saida completa."
}

Write-Host ""
Write-Host "=== RELEASE FIX 07 VALIDADO ===" -ForegroundColor Green
Write-Host "Produto pronto para RELEASE CANDIDATE."
