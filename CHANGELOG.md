# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] — 2026-02-14

### Security
- **Fernet encryption for `gemini_api_key`** — API keys stored encrypted at rest using the same Fernet system as webhook secrets (`secrets.py`)
- **API key masking in responses** — `/me/state` and `PATCH /me/settings` now return masked keys (e.g. `AIza****abcd`) instead of plaintext

### Added
- **Web Vitals reporting** — frontend collects CLS/INP/LCP via `web-vitals` library and sends to `/api/v1/reports/web-vitals` using `sendBeacon`
- **Themed 404 page** — "Portal Corrompido" page for unknown routes instead of silent redirect
- **Skip-to-content link** — keyboard-accessible skip navigation in `AppShell`
- **Schema.org JSON-LD** — structured data (`WebApplication`) in `index.html`
- **PWA manifest** — `manifest.webmanifest` with app metadata and icons
- **SEO files** — `robots.txt`, `sitemap.xml`, canonical URL, `og:image`, Twitter Card meta tags
- **Bundle size analysis** — `rollup-plugin-visualizer` (run with `$env:ANALYZE="true"; pnpm build:client`)
- **Enhanced health check** — `/api/v1/health` now verifies DB and Redis connectivity, returns `503` on failure

### Changed
- **SDK migration** — `google-generativeai` → `google-genai` (`Client`-based API) in `ai.py`, `mission_generator.py`, `generate_mission_pool.py`
- **Toast notifications** — replaced native `alert()` with `useToast()` in `SettingsPage`
- **Google Fonts** — added CSS link with `display=swap` to prevent FOIT

### Improved
- **Accessibility** — ARIA attributes on toggles (`role="switch"`, `aria-checked`), global `focus-visible` ring, minimum font-size increased to 11px
- **`requirements.txt`** — updated to `google-genai>=1.0.0`
