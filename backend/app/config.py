import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FkPhone Backend"
    api_prefix: str = "/api"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/fkphone"
    redis_url: str = ""
    crawler_command: str = "scrapy"
    crawler_workdir: str = "../crawler"
    crawler_default_pages: int = 1
    crawler_timeout_seconds: int = 300
    goofish_profile_dir: str = "../.goofish-profile"
    goofish_cookie_file: str = "../.goofish-cookies.json"
    goofish_headless: bool = False
    goofish_search_headless: bool = True
    goofish_login_timeout_seconds: int = 600

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")


env_file = os.getenv("FKPHONE_ENV_FILE")
settings = Settings(_env_file=env_file if env_file else ("../.env", ".env"))
