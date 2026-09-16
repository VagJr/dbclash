$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RC1 MONGOOSE 9 AUTH HOTFIX ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-rc1-mongoose9-auth-hotfix.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-rc1-mongoose9-auth-hotfix.mjs."
}

if (-not (Test-Path ".\server\user-model.js")) {
    throw "Execute este hotfix na raiz C:\dbclash."
}

Write-Host ""
Write-Host "=== APLICANDO HOTFIX ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar Mongoose 9 Auth Hotfix."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow
node --check server\user-model.js
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe em server/user-model.js" }

node --check scripts\test-rc-mongoose9-auth.mjs
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe no teste Mongoose 9" }

Write-Host ""
Write-Host "=== TESTE ESPECIFICO ===" -ForegroundColor Yellow
npm run test:rc-mongoose9-auth
if ($LASTEXITCODE -ne 0) {
    throw "Teste Mongoose 9 Auth falhou."
}

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) {
    throw "RC Check falhou."
}

Write-Host ""
Write-Host "=== RC1 MONGOOSE 9 AUTH HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie o backend e teste cadastro/login."
