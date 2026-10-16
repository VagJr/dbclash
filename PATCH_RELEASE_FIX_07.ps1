$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 07 - FINAL PRODUCT POLISH ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-07.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-07.mjs ao lado deste arquivo."
}
if (-not (Test-Path ".\scripts\test-release-social.mjs")) {
    throw "Release Fix 06 nao foi detectado."
}

Write-Host ""
Write-Host "=== APLICANDO PATCH ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao aplicar o Release Fix 07."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "server.js",
    "server\server-engine.js",
    "server\security-middleware.js",
    "js\game-engine.js",
    "js\ui-manager.js",
    "js\raid-engine.js",
    "js\team-ui.js",
    "js\safe-dom.js",
    "js\runtime-guard.js",
    "sw.js",
    "scripts\test-release-polish.mjs",
    "scripts\release-static-audit.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== RELEASE CHECK COMPLETO ===" -ForegroundColor Yellow
npm run release:check
if ($LASTEXITCODE -ne 0) {
    throw "O Release Check falhou. Nao prossiga ao Release Candidate."
}

Write-Host ""
Write-Host "=== RELEASE FIX 07 VALIDADO ===" -ForegroundColor Green
Write-Host "Produto pronto para o ciclo RELEASE CANDIDATE."
Write-Host ""
Write-Host "PRODUCAO: configure NODE_ENV=production, MONGODB_URI, AUTH_SECRET (32+ chars)"
Write-Host "e CLIENT_URL ou ALLOWED_ORIGINS antes do deploy."
