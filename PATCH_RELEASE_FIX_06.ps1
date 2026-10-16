$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 06 - 2V2 PRIVATE DOJOS QUESTS ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-06.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-06.mjs ao lado deste arquivo."
}
if (-not (Test-Path ".\scripts\test-release-raid.mjs")) {
    throw "Release Fix 05 nao foi detectado."
}

Write-Host ""
Write-Host "=== APLICANDO PATCH ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar o Release Fix 06."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "server.js",
    "server\user-model.js",
    "server\dojo-model.js",
    "server\tag-team-engine.js",
    "server\product-modes.js",
    "js\daily-quest-rules.js",
    "js\team-ui.js",
    "js\social-manager.js",
    "js\chat-manager.js",
    "js\multiplayer-manager.js",
    "js\auth-manager.js",
    "js\ui-manager.js",
    "scripts\test-release-core.mjs",
    "scripts\test-release-content.mjs",
    "scripts\test-release-account.mjs",
    "scripts\test-release-multiplayer.mjs",
    "scripts\test-release-raid.mjs",
    "scripts\test-release-social.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== SUITE COMPLETA ATE O FIX 06 ===" -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    throw "Os testes falharam. Nao continue para o Fix 07."
}

Write-Host ""
Write-Host "=== RELEASE FIX 06 VALIDADO ===" -ForegroundColor Green
Write-Host "Proximo ciclo: seguranca, performance, QoL, PWA/cache, dead code e polish."
