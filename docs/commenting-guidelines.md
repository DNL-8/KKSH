# Diretrizes de Comentários e Docstrings

Propósito: manter comentários de código úteis, curtos e consistentes entre frontend/backend.

Regras:
- Prefira código autoexplicativo a comentários sempre que possível.
- Adicione comentários apenas quando a intenção do código não for óbvia pelos nomes/estrutura.
- Descreva o *porquê* e restrições/compensações (tradeoffs), não declarações óbvias de *o quê*.
- Mantenha comentários em Inglês para consistência em times multilíngues (exceto documentação externa se solicitado).
- Mantenha comentários próximos ao bloco relevante e atualize/remova comentários obsoletos rapidamente.

Docstrings Python:
- Use resumo conciso de uma linha primeiro.
- Adicione Args/Returns apenas quando o comportamento não for óbvio.
- Documente efeitos colaterais e modos de falha para funções de serviço.

Comentários TypeScript/React:
- Evite ruído inline para atribuições triviais.
- Para hooks/efeitos, comente apenas quando as escolhas de dependência não forem óbvias.
- Para comportamento de acessibilidade, documente a lógica ARIA/teclado uma vez por componente.

Checklist de revisão:
- O comentário explica intenção/restrição?
- Ainda é verdadeiro após esta mudança?
- O código pode ser renomeado/refatorado para remover o comentário?

