# Fitness RPG — TODO

## Branding & Configuração
- [x] Gerar logo do app (ícone RPG de treino)
- [x] Configurar tema de cores RPG (escuro + laranja/dourado)
- [x] Atualizar app.config.ts com nome e branding
- [x] Configurar ícones da tab bar

## Estrutura Base
- [x] Configurar store de dados com AsyncStorage (GameStore)
- [x] Criar tipos e interfaces do sistema RPG
- [x] Criar dados de exercícios e treinos
- [x] Configurar navegação com 5 tabs

## Onboarding
- [x] Tela de splash/intro com animação
- [x] Slides de onboarding (3 telas)
- [x] Tela de criação do herói (nome, objetivo, nível)
- [x] Lógica de primeiro acesso vs retorno

## Home (Dashboard do Herói)
- [x] Header com avatar, nome, nível e classe
- [x] Componente XPBar animado
- [x] Componente StreakBadge com chama
- [x] Card "Missão do Dia"
- [x] Botão CTA "INICIAR MISSÃO"
- [x] Resumo semanal de treinos

## Treino (Missão)
- [x] Tela de treino com lista de exercícios
- [x] Timer de treino (cronômetro)
- [x] Checkbox de conclusão por exercício
- [x] Barra de progresso da missão
- [x] Tela de detalhe do exercício
- [x] Animação de XP ganho ao concluir
- [x] Modal de Level Up

## Progresso
- [x] Calendário de check-ins (heatmap)
- [x] Gráfico de treinos por semana
- [x] Estatísticas gerais (total treinos, XP, streak máx)
- [x] Grid de conquistas (achievements)

## Coach IA
- [x] Interface de chat estilizada
- [x] Integração com LLM do servidor
- [x] Sugestões proativas baseadas no histórico
- [x] Perguntas rápidas pré-definidas

## Perfil
- [x] Ficha do herói (avatar, atributos)
- [x] Grid de conquistas desbloqueadas
- [x] Configurações do app
- [x] Histórico de treinos

## Sistema RPG
- [x] Lógica de XP e níveis
- [x] Sistema de streaks (ganhar/perder)
- [x] Sistema de conquistas (achievements)
- [x] Proteção de streak
- [ ] Notificações de lembrete de treino

## Polish & UX
- [x] Animações de transição entre telas
- [x] Haptic feedback nos botões principais
- [x] Animação de partículas ao ganhar XP
- [ ] Sons de feedback (opcional)

## Testes
- [x] Testes unitários do game-store (20 testes passando)
