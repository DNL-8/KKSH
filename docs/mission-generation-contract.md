# Mission Generation Contract (`CMD8`)

## Campo por missao
- `subject` (string, 1..80)
- `title` (string, 1..120)
- `description` (string, 1..280)
- `targetMinutes` (int)
- `rank` (`F|E|D|C|B|A|S`)
- `difficulty` (`easy|medium|hard|elite`)
- `objective` (string, 1..180)
- `tags` (array string, max 8 na entrada, max 6 apos saneamento)

## Envelope
```json
{
  "daily": ["... 5 itens ..."],
  "weekly": ["... 5 itens ..."]
}
```

## Exemplo valido
```json
{
  "daily": [
    {
      "subject": "SQL",
      "title": "[E] Protocolo Diario - SQL",
      "description": "Consolidar consultas de analise para a sprint atual.",
      "targetMinutes": 40,
      "rank": "E",
      "difficulty": "medium",
      "objective": "Concluir 40 minutos de SQL hoje.",
      "tags": ["sql", "daily", "medium"]
    }
  ],
  "weekly": [
    {
      "subject": "Python",
      "title": "[C] Campanha Semanal - Python",
      "description": "Evoluir scripts e automacao com foco em robustez.",
      "targetMinutes": 240,
      "rank": "C",
      "difficulty": "hard",
      "objective": "Acumular 240 minutos de Python na semana.",
      "tags": ["python", "weekly", "hard"]
    }
  ]
}
```

## Exemplo invalido (motivos)
```json
{
  "daily": [
    {
      "subject": "SQL",
      "title": "",
      "description": "ok",
      "targetMinutes": -5,
      "rank": "Z",
      "difficulty": "normal",
      "objective": "ok",
      "tags": ["sql"]
    }
  ],
  "weekly": []
}
```
Motivos:
- `title` vazio
- `targetMinutes` negativo
- `rank` fora da lista permitida
- `difficulty` fora da lista permitida
- contagem insuficiente de itens por ciclo

## Regras de saneamento
1. Texto normalizado (trim), limite de tamanho aplicado.
2. `rank` invalido cai para fallback por heuristica.
3. `difficulty` invalido e derivado a partir de `rank`.
4. `tags` recebem slug e deduplicacao.
5. Dados faltantes sao preenchidos por fallback local.

## Estrategia de merge com base existente
1. Mapear quest antiga para nova por score de similaridade de assunto.
2. Somar `progressMinutes` no destino mapeado.
3. `claimed` propagado para destino.
4. Cap em `targetMinutes`.

## Estados de origem (`source`)
- `gemini`
- `fallback`
- `mixed`
