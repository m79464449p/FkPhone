from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FkPhone Backend"
    api_prefix: str = "/api"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/fkphone"
    redis_url: str = ""
    crawler_command: str = "scrapy"
    crawler_workdir: str = "../crawler"
    crawler_default_pages: int = 1
    crawler_timeout_seconds: int = 180

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")


settings = Settings()
