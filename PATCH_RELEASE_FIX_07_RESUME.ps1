$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 07 - RESUME HOTFIX ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-fix-07-resume.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-fix-07-resume.mjs."
}

Write-Host ""
Write-Host "=== RETOMANDO DO PONTO DE FALHA ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao continuar o Release Fix 07."
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
    throw "O Release Check falhou. Envie a saida completa."
}

Write-Host ""
Write-Host "=== RELEASE FIX 07 VALIDADO ===" -ForegroundColor Green
Write-Host "Produto pronto para o ciclo RELEASE CANDIDATE."
