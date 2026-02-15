from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_BACKEND_ROOT / ".env"), str(_REPO_ROOT / ".env"), ".env"),
        extra="ignore",
    )

    env: str = "dev"
    app_name: str = "study-leveling"
    api_version: str = "1.0.0"

    # Database
    database_url: str = "sqlite:///./study_leveling.db"
    db_pool_size: int = 5       # SQLAlchemy pool_size for Postgres (ignored for SQLite)
    db_max_overflow: int = 10   # SQLAlchemy max_overflow for Postgres
    auto_create_db: bool = True  # recommended only for dev/tests (use Alembic in prod)
    seed_dev_data: bool = False  # optional demo data in dev/tests

    # CORS
    # IMPORTANT: keep empty by default. In prod/staging you MUST set an explicit allow-list.
    # Example: "https://app.example.com,https://www.example.com"
    cors_origins: str = ""

    # Cookies
    # - cookie_secure: if unset, derives from ENV (secure in prod/staging)
    # - cookie_domain: optional (e.g. ".example.com"). Leave empty for host-only cookies.
    cookie_domain: str = ""
    cookie_secure: bool | None = None
    cookie_samesite: str = "lax"  # "lax" | "strict" | "none"
    cookie_path: str = "/"

    # Security
    jwt_secret: str = "change-me"
    access_token_expire_min: int = 30
    refresh_token_expire_days: int = 30

    # Security headers (recommended in prod)
    security_headers_enabled: bool = True
    # Conservative CSP baseline. Tune per deployment if you need extra third-party resources.
    content_security_policy: str = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    # CSRF (double-submit cookie)
    csrf_enabled: bool = True
    csrf_cookie_name: str = "csrf_token"
    csrf_header_name: str = "X-CSRF-Token"
    csrf_cookie_max_age_sec: int = 60 * 60 * 24 * 30

    # Optional: persist refresh tokens for revocation/rotation + cleanup job
    persist_refresh_tokens: bool = False

    # App behavior
    tz: str = "America/Sao_Paulo"
    serve_frontend: bool = False
    frontend_dist_path: str = "dist/public"

    # Admin (comma-separated emails). Admins can manage drills.
    admin_emails: str = ""

    # Logging
    log_level: str = "INFO"

    # Observability
    metrics_enabled: bool = True
    # Shared secret to protect /metrics endpoint.
    # Requests must send either:
    # - Authorization: Bearer <token>
    # - X-Metrics-Token: <token>
    metrics_token: str = ""
    # Optional IP allow-list for /metrics. Leave empty to allow any IP with valid token.
    metrics_allowed_ips: str = ""
    sentry_dsn: str = ""  # set to enable Sentry
    sentry_traces_sample_rate: float = 0.0
    audit_enabled: bool = True

    # AI provider (server-side only)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash-preview-09-2025"
    gemini_model_chain: str = ""
    ai_guest_daily_max: int = 10
    ai_guest_daily_window_sec: int = 60 * 60 * 24
    ai_history_max_messages: int = 200
    ai_rate_limit_max: int = 30
    ai_rate_limit_window_sec: int = 60
    ai_hunter_retry_max: int = 2
    ai_hunter_retry_base_ms: int = 1200
    ai_hunter_retry_max_ms: int = 8000
    ai_hunter_retry_jitter_ms: int = 250
    ai_hunter_quota_retry_max_sec: int = 8
    ai_mission_regen_cooldown_sec: int = 60 * 60
    xp_ruleset_version: int = 1
    ff_ledger_write: bool = True
    ff_enforce_idempotency: bool = False

    # Webhook secret encryption (Fernet-compatible key, urlsafe base64-encoded 32-byte key)
    webhook_secret_enc_key: str = ""
    webhook_secret_key_id: str = "v1"
    webhook_outbox_enabled: bool = False
    webhook_outbox_send_enabled: bool = False
    webhook_worker_batch_size: int = 50
    webhook_worker_poll_interval_ms: int = 1000
    webhook_worker_lock_ttl_sec: int = 60
    webhook_worker_max_attempts: int = 8
    webhook_worker_backoff_base_sec: int = 5
    webhook_worker_backoff_max_sec: int = 900
    webhook_worker_backoff_jitter_sec: int = 2
    webhook_delivery_timeout_sec: float = 3.0

    # Rate limiting (in-memory, single-instance)
    rate_limit_default_max: int = 120
    rate_limit_default_window_sec: int = 60
    rate_limit_auth_max: int = 10
    rate_limit_auth_window_sec: int = 60

    # Shared rate limiting backend (Redis) for production multi-instance.
    redis_url: str = ""  # e.g. redis://localhost:6379/0
    # Trust X-Forwarded-For only when the direct peer is in this allow-list.
    trusted_proxy_ips: str = ""

    @model_validator(mode="after")
    def _validate_security_config(self) -> "Settings":
        for origin in self.cors_origins_list:
            if origin == "*":
                raise ValueError("CORS_ORIGINS cannot contain '*'. Use explicit origins.")
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"CORS origin invalida: {origin!r}. Use http(s)://host[:port].")
            if parsed.path not in ("", "/") or parsed.params or parsed.query or parsed.fragment:
                raise ValueError(
                    f"CORS origin invalida: {origin!r}. Nao inclua path/query/fragment."
                )

        if int(self.webhook_worker_batch_size) < 1:
            raise ValueError("WEBHOOK_WORKER_BATCH_SIZE must be >= 1.")
        if int(self.webhook_worker_poll_interval_ms) < 100:
            raise ValueError("WEBHOOK_WORKER_POLL_INTERVAL_MS must be >= 100.")
        if int(self.webhook_worker_max_attempts) < 1:
            raise ValueError("WEBHOOK_WORKER_MAX_ATTEMPTS must be >= 1.")
        if int(self.webhook_worker_backoff_base_sec) < 1:
            raise ValueError("WEBHOOK_WORKER_BACKOFF_BASE_SEC must be >= 1.")
        if int(self.webhook_worker_backoff_max_sec) < int(self.webhook_worker_backoff_base_sec):
            raise ValueError("WEBHOOK_WORKER_BACKOFF_MAX_SEC must be >= base.")
        if int(self.webhook_worker_lock_ttl_sec) < 10:
            raise ValueError("WEBHOOK_WORKER_LOCK_TTL_SEC must be >= 10.")

        # Fail fast in non-dev environments if secrets are unsafe.
        if self.env not in ("dev", "test"):
            if self.jwt_secret.strip() == "change-me" or len(self.jwt_secret.strip()) < 32:
                raise ValueError(
                    "JWT_SECRET invalido: defina um valor forte (>=32 chars) em producao/staging."
                )
            if self.auto_create_db:
                raise ValueError("AUTO_CREATE_DB must be false in production/staging.")
            if self.seed_dev_data:
                raise ValueError("SEED_DEV_DATA must be false in production/staging.")
            if not self.persist_refresh_tokens:
                raise ValueError("PERSIST_REFRESH_TOKENS must be true in production/staging.")
            # SameSite=None requires Secure cookies in browsers
            if self.cookie_samesite.lower() == "none" and not self.cookie_secure_effective:
                raise ValueError(
                    "cookie_samesite='none' requer cookie_secure=true (cookies Secure)."
                )
            if self.metrics_enabled and not self.metrics_token.strip():
                raise ValueError(
                    "METRICS_TOKEN is required when METRICS_ENABLED=true in prod/staging."
                )
            if not self.webhook_secret_enc_key.strip():
                raise ValueError("WEBHOOK_SECRET_ENC_KEY is required in prod/staging.")
            if self.serve_frontend and not self.frontend_index_file.exists():
                raise ValueError(
                    "SERVE_FRONTEND=true requer FRONTEND_DIST_PATH válido contendo index.html."
                )
        else:
            # Keep dev/test less strict by default.
            self.rate_limit_auth_max = max(60, int(self.rate_limit_auth_max))
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cookie_domain_or_none(self) -> str | None:
        v = self.cookie_domain.strip()
        return v or None

    @property
    def cookie_secure_effective(self) -> bool:
        if self.cookie_secure is not None:
            return bool(self.cookie_secure)
        return self.env not in ("dev", "test")

    @property
    def admin_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.admin_emails.split(",") if e.strip()]

    @property
    def trusted_proxy_ips_list(self) -> list[str]:
        return [ip.strip() for ip in self.trusted_proxy_ips.split(",") if ip.strip()]

    @property
    def metrics_allowed_ips_list(self) -> list[str]:
        return [ip.strip() for ip in self.metrics_allowed_ips.split(",") if ip.strip()]

    @property
    def frontend_dist_dir(self) -> Path:
        raw = Path(self.frontend_dist_path.strip() or "dist/public")
        if raw.is_absolute():
            return raw

        candidates = [
            Path.cwd() / raw,
            _REPO_ROOT / raw,
            _BACKEND_ROOT / raw,
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate.resolve()
        return (Path.cwd() / raw).resolve()

    @property
    def frontend_index_file(self) -> Path:
        return self.frontend_dist_dir / "index.html"


settings = Settings()
