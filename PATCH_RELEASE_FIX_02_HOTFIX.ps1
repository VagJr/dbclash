$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH RELEASE FIX 02 - HOTFIX TEST FILE ===" -ForegroundColor Cyan

$testFile = Join-Path (Get-Location).Path "scripts\test-release-content.mjs"

if (-not (Test-Path $testFile)) {
    throw "Nao encontrei scripts\test-release-content.mjs. Execute este hotfix na raiz do dbclash."
}

$raw = [System.IO.File]::ReadAllText($testFile)

$pattern = "console\.log\('\s*CONTENT RELEASE TESTS:\s*' \+ passed \+ ' PASS / 0 FAIL'\);"
$replacement = "console.log('CONTENT RELEASE TESTS: ' + passed + ' PASS / 0 FAIL');"

$fixed = [System.Text.RegularExpressions.Regex]::Replace(
    $raw,
    $pattern,
    $replacement,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($fixed -eq $raw) {
    throw "Nao encontrei a linha quebrada CONTENT RELEASE TESTS. Envie o trecho final do arquivo para ajuste."
}

[System.IO.File]::WriteAllText(
    $testFile,
    $fixed,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "[OK] scripts/test-release-content.mjs corrigido" -ForegroundColor Green

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
Write-Host "=== SUITE COMPLETA ATE O FIX 02 ===" -ForegroundColor Yellow

npm test
if ($LASTEXITCODE -ne 0) {
    throw "Os testes falharam. Envie a saida completa; nao continue para o Fix 03."
}

Write-Host ""
Write-Host "=== RELEASE FIX 02 VALIDADO ===" -ForegroundColor Green
