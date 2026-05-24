from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Vapi (all-in-one Voice AI platform) ───────────────────────────────
    # Private key — server-side only (for phone calls)
    VAPI_PRIVATE_KEY: str = ""
    VAPI_PHONE_NUMBER_ID: str = ""
    # Public key — sent to browser for Web SDK calls
    VAPI_PUBLIC_KEY: str = ""

    # ── App ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    BASE_URL: str = "http://localhost:8000"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
