# Design — Fitness RPG: App de Treino Gamificado

## Conceito Visual
Tema RPG escuro com acentos em dourado/laranja vibrante e verde neon para progresso. Estética de "jogo de aventura" com elementos medievais modernos — barras de XP, ícones de missão, escudos de conquista.

---

## Paleta de Cores

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `primary` | `#FF6B35` | `#FF6B35` | Botões CTA, XP bar, destaque |
| `secondary` | `#FFD700` | `#FFD700` | Ouro, moedas, nível |
| `background` | `#0F0F1A` | `#0F0F1A` | Fundo principal (sempre escuro) |
| `surface` | `#1A1A2E` | `#1A1A2E` | Cards, modais |
| `surface2` | `#16213E` | `#16213E` | Cards secundários |
| `foreground` | `#FFFFFF` | `#FFFFFF` | Texto principal |
| `muted` | `#8892A4` | `#8892A4` | Texto secundário |
| `success` | `#4ADE80` | `#4ADE80` | Missão completa, streak |
| `warning` | `#FBBF24` | `#FBBF24` | Alertas, bônus |
| `error` | `#F87171` | `#F87171` | Erros, vida baixa |
| `border` | `#2A2A4A` | `#2A2A4A` | Bordas |
| `xp` | `#A855F7` | `#A855F7` | Barra de XP, magia |

---

## Telas

### 1. Onboarding (3 slides)
- **Slide 1**: Apresentação do conceito RPG — "Transforme seus treinos em missões épicas"
- **Slide 2**: Escolha de objetivo (Emagrecer / Condicionamento / Ambos)
- **Slide 3**: Criação do Herói — nome, nível de experiência (Iniciante/Intermediário/Avançado)

### 2. Home (Dashboard do Herói)
- Header: Avatar do herói + Nome + Nível + Classe
- Barra de XP com progresso para próximo nível
- Streak atual (chama de fogo animada)
- Card "Missão do Dia" — treino recomendado com XP estimado
- Cards de missões secundárias (hidratação, descanso)
- Botão CTA grande: "INICIAR MISSÃO"
- Resumo semanal (mini gráfico de barras)

### 3. Treino (Missão em Andamento)
- Cabeçalho: Nome da missão + XP a ganhar
- Timer do treino (cronômetro)
- Lista de exercícios com sets/reps/duração
- Cada exercício: checkbox de conclusão + animação de check
- Barra de progresso da missão (exercícios completados / total)
- Botão "Concluir Missão" — dispara animação de XP ganho
- Opção de pausar/abandonar

### 4. Exercício (Detalhe)
- Nome e GIF/ícone do exercício
- Instruções de execução (3-4 passos)
- Sets e reps configuráveis
- Timer por série (opcional)
- Botão "Série Concluída"

### 5. Progresso (Mapa de Aventura)
- Gráfico de treinos por semana (barras)
- Calendário de check-ins (heatmap)
- Estatísticas: Total de treinos, XP total, Streak máximo
- Evolução de nível (linha do tempo)
- Conquistas desbloqueadas

### 6. Coach IA (Oráculo)
- Interface de chat estilizada como "oráculo"
- Sugestões proativas baseadas no histórico
- Perguntas rápidas pré-definidas
- Análise de pontos fracos e recomendações

### 7. Perfil (Ficha do Herói)
- Avatar + Nome + Classe + Nível
- Atributos: Força, Resistência, Agilidade, Disciplina
- Conquistas (badges) — grid de troféus
- Configurações do app
- Histórico de treinos

---

## Navegação (Tab Bar)

```
[🏠 Início]  [⚔️ Treinar]  [📊 Progresso]  [🤖 Coach]  [👤 Perfil]
```

---

## Fluxos Principais

### Fluxo 1: Primeiro Uso
`Splash → Onboarding (3 slides) → Criação do Herói → Home`

### Fluxo 2: Treino Diário
`Home → Tap "INICIAR MISSÃO" → Tela de Treino → Exercício em detalhe → Concluir → Animação XP → Home (atualizado)`

### Fluxo 3: Verificar Progresso
`Home → Tab Progresso → Ver calendário/gráficos → Ver conquistas`

### Fluxo 4: Consultar Coach
`Tab Coach → Ver sugestão proativa → Fazer pergunta → Receber resposta personalizada`

---

## Sistema RPG

### Níveis e XP
- Nível 1–5: Recruta → Guerreiro → Cavaleiro → Campeão → Lendário
- XP por treino: 50–200 XP (baseado em duração e intensidade)
- XP bônus: +50 por streak de 3 dias, +100 por streak de 7 dias

### Streaks
- Ícone de chama que cresce com o streak
- Streak quebrado = animação de chama apagando
- Proteção de streak (1 por semana)

### Conquistas
- "Primeiro Sangue" — 1º treino completo
- "Guerreiro Consistente" — 7 dias seguidos
- "Mestre do Mês" — 30 dias seguidos
- "Queimador de Gordura" — 10 treinos cardio
- "Força Bruta" — 10 treinos de força
- "Lendário" — Nível máximo atingido

---

## Tipografia
- Títulos: Bold, 24-32px, cor foreground
- Subtítulos: SemiBold, 18-20px
- Corpo: Regular, 14-16px, cor muted
- XP/Números: Bold, cor primary ou secondary

---

## Componentes Chave
- `XPBar` — barra de progresso animada com gradiente
- `StreakBadge` — ícone de chama com contador
- `MissionCard` — card de missão com XP, dificuldade e tipo
- `ExerciseItem` — item de exercício com checkbox e timer
- `AchievementBadge` — badge de conquista com estado locked/unlocked
- `LevelUpModal` — modal animado de subida de nível
- `XPGainAnimation` — partículas de XP ao completar exercício
