from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from .config import Settings, get_settings
from .routes import router

app = FastAPI(title="Personalized Travel Itinerary Planner", version="1.1.0")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/api/health")
def health(settings: Settings = Depends(get_settings)):
    """Tells the front end which integrations are live."""
    return {
        "status": "ok",
        "ai": settings.anthropic_model if settings.anthropic_api_key else "offline-template",
        "storage": "supabase" if settings.use_supabase else "local-file",
        "auth": settings.auth_enabled,
    }
