$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RC1 AUTH HOTFIX ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-rc1-auth-hotfix.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-rc1-auth-hotfix.mjs."
}

if (-not (Test-Path ".\scripts\rc-verify.mjs")) {
    throw "RC1 nao foi detectado. Execute este hotfix sobre 1.0.0-rc.1."
}

Write-Host ""
Write-Host "=== APLICANDO HOTFIX ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar RC1 Auth Hotfix."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "js\auth-manager.js",
    "js\socket-config.js",
    "js\ui-manager.js",
    "sw.js",
    "server.js",
    "scripts\test-rc-auth.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== TESTE ESPECIFICO AUTH ===" -ForegroundColor Yellow
npm run test:rc-auth
if ($LASTEXITCODE -ne 0) {
    throw "Teste RC Auth falhou."
}

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) {
    throw "RC Check falhou."
}

Write-Host ""
Write-Host "=== RC1 AUTH HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Reinicie backend e frontend, limpe/recarregue o Service Worker e teste cadastro/login."
