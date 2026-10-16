$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 04 - MULTIPLAYER RANKED RECONNECT ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-04.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-04.mjs ao lado deste arquivo."
}
if (-not (Test-Path ".\scripts\test-release-account.mjs")) {
    throw "Release Fix 03 nao foi detectado."
}

Write-Host ""
Write-Host "=== APLICANDO PATCH ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar o Release Fix 04."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "server.js",
    "js\ranked-rules.js",
    "js\socket-config.js",
    "js\multiplayer-manager.js",
    "js\leaderboard-manager.js",
    "js\auth-manager.js",
    "scripts\test-release-core.mjs",
    "scripts\test-release-content.mjs",
    "scripts\test-release-account.mjs",
    "scripts\test-release-multiplayer.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== SUITE COMPLETA ATE O FIX 04 ===" -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    throw "Os testes falharam. Nao continue para o Fix 05."
}

Write-Host ""
Write-Host "=== RELEASE FIX 04 VALIDADO ===" -ForegroundColor Green
Write-Host "Proximo ciclo: Raid/co-op como modo completo."
