# Rotacao de Chaves (Fernet)

Este projeto usa `WEBHOOK_SECRET_ENC_KEY` para criptografar:

- `user_settings.gemini_api_key`
- `user_webhooks.secret_encrypted`

## Variaveis

- `WEBHOOK_SECRET_ENC_KEY`: chave ativa (usada para novas criptografias)
- `WEBHOOK_SECRET_KEY_ID`: identificador da chave ativa (metadado)
- `WEBHOOK_SECRET_ENC_KEY_PREV`: lista CSV de chaves antigas aceitas apenas para decriptacao temporaria

## Fluxo recomendado (zero downtime)

1. Defina nova chave em `WEBHOOK_SECRET_ENC_KEY`.
2. Mova chave anterior para `WEBHOOK_SECRET_ENC_KEY_PREV`.
3. Mantenha a aplicacao rodando com ambas por um periodo curto.
4. Rode re-encriptacao:
   - Dry-run: `PYTHONPATH=. python backend/scripts/reencrypt_secrets.py`
   - Aplicar: `PYTHONPATH=. python backend/scripts/reencrypt_secrets.py --apply`
5. Valide leitura/escrita de segredos e endpoints dependentes.
6. Remova a chave antiga de `WEBHOOK_SECRET_ENC_KEY_PREV`.

## Observacoes

- O script de re-encriptacao tambem migra `user_webhooks.secret` legado para `secret_encrypted`.
- `webhooks_skipped` no output indica itens que nao puderam ser decriptados com o keyring atual.
- Execute backup antes da fase `--apply`.
