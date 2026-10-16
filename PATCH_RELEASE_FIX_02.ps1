$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 02 - CONTENT RULES ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-02.mjs"
$rules = Join-Path $PSScriptRoot "content-rules-source.js"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-02.mjs ao lado deste arquivo."
}
if (-not (Test-Path $rules)) {
    throw "Nao encontrei content-rules-source.js ao lado deste arquivo."
}
if (-not (Test-Path ".\scripts\test-release-core.mjs")) {
    throw "Release Fix 01 nao foi detectado. Nao aplique o Fix 02 antes do Fix 01."
}

Write-Host ""
Write-Host "=== APLICANDO PATCH ===" -ForegroundColor Yellow

node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar o Release Fix 02."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "server\server-engine.js",
    "js\game-engine.js",
    "js\card-database.js",
    "js\content-rules.js",
    "js\ui-manager.js",
    "server.js",
    "scripts\test-release-core.mjs",
    "scripts\test-release-content.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== TESTE COMPLETO ATE O FIX 02 ===" -ForegroundColor Yellow

npm test
if ($LASTEXITCODE -ne 0) {
    throw "Os testes falharam. Nao continue para o Release Fix 03."
}

Write-Host ""
Write-Host "=== RELEASE FIX 02 VALIDADO ===" -ForegroundColor Green
Write-Host "Backups .release-fix-02.bak foram preservados."
Write-Host "Proximo ciclo: Auth, conta, economia, colecao e decks."
