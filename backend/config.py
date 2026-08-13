from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    cache_ttl_seconds: int = 86400
    max_reviews: int = 40
    backend_port: int = 8000
    allowed_origins: list[str] = ["chrome-extension://*", "http://localhost:3000", "http://localhost:5173"]

    model_config = SettingsConfigDict(env_file='.env', case_sensitive=False)

settings = Settings()
