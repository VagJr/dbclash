# Restaurar o backup de dbtcg

Este branch guarda código e artes da pasta `C:\dbtcg` em 16/10/2026.

```powershell
git clone --branch backup/codex-2026-10-16-dbtcg https://github.com/VagJr/dbclash.git
```

Configurações, senhas, chaves de assinatura e saves foram mantidos somente no PC, conforme solicitado. Preserve os itens `local_only` do MANIFEST.json antes de excluir a pasta original. Dependências instaladas, caches, ferramentas baixáveis, compilações e instaladores não foram incluídos. Instale dependências usando os manifests originais do projeto.

Os arquivos em `sanitized_files`, se houver, tiveram credenciais substituídas por marcadores somente nesta cópia da nuvem. Os arquivos originais no computador não foram modificados.

MANIFEST.json registra os arquivos e hashes Git para conferência. Este snapshot não altera a branch de produção nem substitui o histórico anterior do repositório.
