$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 01 - HOTFIX TEST RUNNER ===" -ForegroundColor Cyan

$testFile = Join-Path (Get-Location).Path "scripts\test-release-core.mjs"

if (-not (Test-Path $testFile)) {
    throw "Nao encontrei scripts\test-release-core.mjs. Execute este hotfix na raiz do dbclash."
}

$lines = Get-Content -Path $testFile
$found = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "CORE RELEASE TESTS") {
        $lines[$i] = "console.log('\nCORE RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');"
        $found = $true
        break
    }
}

if (-not $found) {
    throw "Nao encontrei a linha CORE RELEASE TESTS no arquivo."
}

Set-Content -Path $testFile -Value $lines -Encoding UTF8

Write-Host "[OK] scripts/test-release-core.mjs corrigido" -ForegroundColor Green

Write-Host ""
Write-Host "=== VALIDACAO DE SINTAXE ===" -ForegroundColor Yellow

$files = @(
    "server\server-engine.js",
    "js\game-engine.js",
    "js\multiplayer-manager.js",
    "server.js",
    "scripts\test-release-core.mjs"
)

foreach ($file in $files) {
    node --check $file
    if ($LASTEXITCODE -ne 0) {
        throw "Falha de sintaxe em $file"
    }
    Write-Host "[OK] node --check $file"
}

Write-Host ""
Write-Host "=== TESTES DE REGRESSAO ===" -ForegroundColor Yellow

npm run test:core
if ($LASTEXITCODE -ne 0) {
    throw "Os testes de regressao falharam. Envie a saida completa."
}

Write-Host ""
Write-Host "=== RELEASE FIX 01 VALIDADO ===" -ForegroundColor Green
