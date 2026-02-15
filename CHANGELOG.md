# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-02-15

### Security
- **Fernet encryption for `gemini_api_key`** - API keys stored encrypted at rest using the same Fernet system as webhook secrets (`secrets.py`)
- **API key masking in responses** - `/me/state` and `PATCH /me/settings` now return masked keys (e.g. `AIza****abcd`) instead of plaintext
- **AI abuse controls hardened** - authenticated users now have dedicated burst + daily quota limits in addition to existing guest/IP controls

### Added
- **Web Vitals reporting** - frontend collects CLS/INP/LCP via `web-vitals` library and sends to `/api/v1/reports/web-vitals` using `sendBeacon`
- **Themed 404 page** - "Portal Corrompido" page for unknown routes instead of silent redirect
- **Skip-to-content link** - keyboard-accessible skip navigation in `AppShell`
- **Schema.org JSON-LD** - structured data (`WebApplication`) in `index.html`
- **PWA manifest** - `manifest.webmanifest` with app metadata and icons
- **SEO files** - `robots.txt`, `sitemap.xml`, canonical URL, `og:image`, Twitter Card meta tags
- **Bundle size analysis** - `rollup-plugin-visualizer` (run with `$env:ANALYZE="true"; pnpm build:client`)
- **Enhanced health check** - `/api/v1/health` now verifies DB and Redis connectivity, returns `503` on failure
- **Stable video completion references (v2)** - files page now resolves a stable dedupe id (`v2:sha256` with metadata fallback) before granting XP
- **Server-side dedupe guard for `video_lesson`** - duplicate `video_completion::` refs return `200` with `xpEarned=0` and `goldEarned=0`
- **Tests for AI user limits** - added coverage for per-user daily quota and per-user burst throttling

### Changed
- **SDK migration** - `google-generativeai` to `google-genai` (`Client`-based API) in `ai.py`, `mission_generator.py`, `generate_mission_pool.py`
- **Toast notifications** - replaced native `alert()` with `useToast()` in `SettingsPage`
- **Google Fonts** - added CSS link with `display=swap` to prevent FOIT
- **AI quota config surface** - introduced `AI_USER_DAILY_MAX` and `AI_USER_DAILY_WINDOW_SEC` for authenticated-user quotas

### Improved
- **Accessibility** - ARIA attributes on toggles (`role="switch"`, `aria-checked`), global `focus-visible` ring, minimum font-size increased to 11px
- **`requirements.txt`** - updated to `google-genai>=1.0.0`
