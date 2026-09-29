$ErrorActionPreference = "Stop"

Write-Host "=== DBCLASH AUDIO TEST OPTIONAL CALL HOTFIX ===" -ForegroundColor Cyan
Write-Host "Este hotfix altera somente a suite de testes de audio." -ForegroundColor DarkYellow

$src = Join-Path $PSScriptRoot "test-release-audio-optional-call-hotfix.mjs"
$dst = ".\scripts\test-release-audio.mjs"

if (-not (Test-Path $src)) { throw "test-release-audio-optional-call-hotfix.mjs nao encontrado." }
if (-not (Test-Path $dst)) { throw "Execute na raiz C:\dbclash." }

Copy-Item $dst "$dst.optional-call-hotfix.bak" -Force
Copy-Item $src $dst -Force
Write-Host "[OK] scripts\test-release-audio.mjs atualizado"

Write-Host ""
Write-Host "=== SINTAXE ===" -ForegroundColor Yellow
node --check $dst
if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe no teste de audio." }

Write-Host ""
Write-Host "=== TESTE DE AUDIO ===" -ForegroundColor Yellow
npm run test:audio
if ($LASTEXITCODE -ne 0) { throw "Teste de audio ainda falhou." }

Write-Host ""
Write-Host "=== RC CHECK COMPLETO ===" -ForegroundColor Yellow
npm run rc:check
if ($LASTEXITCODE -ne 0) { throw "RC check falhou." }

Write-Host ""
Write-Host "=== AUDIO TEST HOTFIX VALIDADO ===" -ForegroundColor Green
Write-Host "Se tudo estiver verde, faca o smoke test real de musica/SFX no navegador."
