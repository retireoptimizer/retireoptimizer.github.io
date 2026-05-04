from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")

    supabase_url: str = ""
    supabase_jwks_url: str = ""
    supabase_service_role_key: str = ""
    sentry_dsn: str = ""
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"
    app_version: str = "0.1.0"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
