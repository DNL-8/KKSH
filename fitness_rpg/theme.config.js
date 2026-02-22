/** @type {const} */
const themeColors = {
  primary:    { light: '#FF6B35', dark: '#FF6B35' },   // Laranja vibrante — botões CTA, destaque
  secondary:  { light: '#FFD700', dark: '#FFD700' },   // Dourado — nível, moedas, XP
  background: { light: 'rgba(255,255,255,0.85)', dark: '#0F0F1A' },   // Fundo Liquid Glass (translúcido)
  surface:    { light: 'rgba(255,255,255,0.65)', dark: '#1A1A2E' },   // Cards e modais Liquid Glass
  surface2:   { light: 'rgba(240,240,246,0.55)', dark: '#16213E' },   // Cards secundários Liquid Glass
  foreground: { light: '#222222', dark: '#FFFFFF' },   // Texto principal (escuro no iOS)
  muted:      { light: '#A0A4AE', dark: '#8892A4' },   // Texto secundário (cinza suave)
  border:     { light: 'rgba(200,200,220,0.4)', dark: '#2A2A4A' },   // Bordas Liquid Glass
  success:    { light: '#4ADE80', dark: '#4ADE80' },   // Missão completa, streak
  warning:    { light: '#FBBF24', dark: '#FBBF24' },   // Alertas, bônus
  error:      { light: '#F87171', dark: '#F87171' },   // Erros
  xp:         { light: '#A855F7', dark: '#A855F7' },   // Barra de XP, magia
  tint:       { light: '#FF6B35', dark: '#FF6B35' },   // Tab bar ativo
};

module.exports = { themeColors };
