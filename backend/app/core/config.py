from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://rpd_user:rpd_secret@db:5432/rpd_db"
    SECRET_KEY: str = "super-secret-dev-key-change-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    LLM_API_KEY: str = "demo"
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    STORAGE_BACKEND: str = "s3"
    S3_ENDPOINT: str = "minio:9000"
    S3_BUCKET: str = "rpd-files"
    S3_ACCESS_KEY: str = "rpd_minio"
    S3_SECRET_KEY: str = "rpd_minio_secret"
    S3_USE_SSL: bool = False
    S3_REGION: str = "us-east-1"

    class Config:
        env_file = ".env"

settings = Settings()
