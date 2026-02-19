# Roadmap /arquivos - Proxima Iteracao

Objetivo: reduzir tempo de operacao da pagina `/arquivos`, manter estabilidade com bibliotecas grandes e diminuir risco de regressao nos fluxos locais/bridge.

## 1) UX (alto impacto)

### 1.1 Acoes em lote na trilha
- Adicionar selecao multipla (checkbox por aula + selecionar tudo da pasta atual).
- Acoes iniciais: remover da trilha, marcar como concluida, mover para pasta-alvo.
- Critério de aceite: usuario executa acoes em lote sem sair da trilha e sem queda perceptivel de FPS.

### 1.2 Atalhos de teclado no player
- Espaco: play/pause.
- Setas: avancar/retroceder 5s.
- `J/K/L`: retroceder/pause-play/avancar 10s.
- Critério de aceite: atalhos ativos apenas quando foco nao estiver em campos de texto.

### 1.3 Feedback de importacao
- Exibir resumo persistente da ultima importacao (importados, ignorados, rejeitados, tempo total).
- Adicionar CTA de reprocessar apenas rejeitados.
- Critério de aceite: usuario entende motivo de rejeicao sem abrir DevTools.

## 2) Performance (alto impacto)

### 2.1 Indexacao de busca local incremental
- Criar indice leve em memoria para `name` e `relativePath` com atualizacao incremental por delta.
- Evitar re-scan completo em cada digitacao.
- Critério de aceite: busca permanece fluida com 20k videos em hardware mediano.

### 2.2 Pipeline de ordenacao memoizado por chave
- Memoizar ordenacao por combinacao `orderMode + sourceVersion`.
- Reusar resultado entre abas quando o dataset nao mudou.
- Critério de aceite: trocar aba/ordem sem travadas visiveis.

### 2.3 Lazy open do Bridge Browser
- Carregar dados de bridge somente ao abrir modal e cachear snapshot por TTL curto.
- Critério de aceite: primeira abertura < 1.5s em pastas grandes; reabertura instantanea dentro do TTL.

## 3) Confiabilidade e observabilidade

### 3.1 Telemetria funcional minima
- Eventos: import start/success/error, backup export/import, bridge play success/error.
- Campos: contagens, origem (`local`/`bridge`), erro normalizado, duracao.
- Critério de aceite: incidentes reproduziveis por log sem depender de relato subjetivo.

### 3.2 Endurecimento E2E de /arquivos
- Manter testes por papel/texto/atributos acessiveis; evitar seletores acoplados a virtualizacao.
- Adicionar suite noturna com `--repeat-each=3` para detectar flake cedo.
- Critério de aceite: zero falhas intermitentes em 3 repeticoes consecutivas.

## 4) Sequenciamento recomendado

1. UX 1.3 + Telemetria 3.1 (ganho rapido de suporte).
2. Performance 2.1 + 2.2 (escala para bibliotecas grandes).
3. UX 1.1 + 1.2 (produtividade do usuario avancado).
4. Confiabilidade 3.2 e ajuste fino final.