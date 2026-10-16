$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE CANDIDATE 01 ===" -ForegroundColor Cyan

$patcher = Join-Path $PSScriptRoot "apply-release-candidate-01.mjs"

if (-not (Test-Path $patcher)) {
    throw "Nao encontrei apply-release-candidate-01.mjs."
}

Write-Host ""
Write-Host "=== PREPARANDO RC1 ===" -ForegroundColor Yellow
node $patcher
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao preparar o Release Candidate."
}

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "scripts\rc-verify.mjs",
    "scripts\rc-report.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) {
    throw "RC Check falhou. Nao promova para versao final."
}

Write-Host ""
Write-Host "=== RELEASE CANDIDATE 1 VALIDADO AUTOMATICAMENTE ===" -ForegroundColor Green
Write-Host "Versao: 1.0.0-rc.1"
Write-Host "Agora execute RELEASE_CANDIDATE_SMOKE_TESTS.md."
Write-Host "Quando todos P0/P1 estiverem verdes, o projeto pode ser promovido a 1.0.0."
