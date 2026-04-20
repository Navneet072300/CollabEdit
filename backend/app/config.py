from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/collab_editor"
    redis_url: str = "redis://localhost:6379"
    cors_origins: list[str] = ["http://localhost:3000"]
    max_ops_per_room: int = 1000  # Prune older ops beyond this

    class Config:
        env_file = ".env"


settings = Settings()
