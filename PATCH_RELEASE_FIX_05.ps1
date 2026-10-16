$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 05 - RAID COOP ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-05.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-05.mjs ao lado deste arquivo."
}
if (-not (Test-Path ".\scripts\test-release-multiplayer.mjs")) {
    throw "Release Fix 04 nao foi detectado."
}

Write-Host ""
Write-Host "=== APLICANDO PATCH ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar o Release Fix 05."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "server.js",
    "server\raid-room-engine.js",
    "js\raid-rules.js",
    "js\raid-engine.js",
    "js\multiplayer-manager.js",
    "scripts\test-release-core.mjs",
    "scripts\test-release-content.mjs",
    "scripts\test-release-account.mjs",
    "scripts\test-release-multiplayer.mjs",
    "scripts\test-release-raid.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== SUITE COMPLETA ATE O FIX 05 ===" -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    throw "Os testes falharam. Nao continue para o Fix 06."
}

Write-Host ""
Write-Host "=== RELEASE FIX 05 VALIDADO ===" -ForegroundColor Green
Write-Host "Proximo ciclo: salas privadas, 2v2, Dojos e Missoes."
