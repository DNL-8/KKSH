# Fitness RPG — App de Treino Gamificado

Aplicativo móvel React Native (Expo) que transforma treinos em casa em missões RPG épicas.

## Stack
- **Framework**: React Native + Expo SDK 54
- **Navegação**: Expo Router 6
- **Estilização**: NativeWind 4 (Tailwind CSS)
- **Estado**: AsyncStorage (local)
- **Backend/IA**: tRPC + LLM integrado
- **Linguagem**: TypeScript 5.9

## Funcionalidades
- Sistema RPG: XP, níveis (1-5), streaks e conquistas
- Missão do Dia personalizada por objetivo e nível
- 5 treinos completos com exercícios detalhados
- Coach de IA (Oráculo) com chat personalizado
- Heatmap de check-ins dos últimos 28 dias
- Onboarding com criação de herói (nome, classe, objetivo)
- Dashboard com atributos derivados do progresso

## Telas
1. **Home** — Dashboard do herói com XP, streak e missão do dia
2. **Treinar** — Lista de missões disponíveis
3. **Progresso** — Heatmap, gráficos, conquistas e histórico
4. **Coach IA** — Chat com o Oráculo (IA personalizada)
5. **Perfil** — Ficha do herói, atributos e configurações

## Como Executar
```bash
pnpm install
pnpm dev
```

## Testes
```bash
pnpm test
```
