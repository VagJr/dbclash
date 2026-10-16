$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 03 - ACCOUNT ECONOMY COLLECTION ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-03.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-03.mjs ao lado deste arquivo."
}
if (-not (Test-Path ".\scripts\test-release-content.mjs")) {
    throw "Release Fix 02 nao foi detectado."
}

Write-Host ""
Write-Host "=== APLICANDO PATCH ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar o Release Fix 03."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "server.js",
    "server\auth-session.js",
    "server\user-model.js",
    "js\economy-rules.js",
    "js\auth-manager.js",
    "js\auth-database.js",
    "js\deck-builder.js",
    "js\pack-opener.js",
    "js\character-unlocks.js",
    "js\ui-manager.js",
    "scripts\test-release-core.mjs",
    "scripts\test-release-content.mjs",
    "scripts\test-release-account.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== SUITE COMPLETA ATE O FIX 03 ===" -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    throw "Os testes falharam. Nao continue para o Fix 04."
}

Write-Host ""
Write-Host "=== RELEASE FIX 03 VALIDADO ===" -ForegroundColor Green
Write-Host "IMPORTANTE PARA DEPLOY: configure AUTH_SECRET no ambiente de producao."
Write-Host "Proximo ciclo: multiplayer autenticado, ranked, reconexao e leaderboard."
