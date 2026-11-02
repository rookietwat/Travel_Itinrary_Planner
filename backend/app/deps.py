from functools import lru_cache
from pathlib import Path

from .ai import ItineraryGenerator
from .config import get_settings
from .store import LocalJsonStore, SupabaseStore, TripStore

BACKEND_DIR = Path(__file__).resolve().parent.parent


@lru_cache
def get_store() -> TripStore:
    s = get_settings()
    if s.use_supabase:
        return SupabaseStore(s.supabase_url, s.supabase_service_key)
    # A relative DATA_FILE is anchored to the backend folder, whatever the working directory.
    return LocalJsonStore(str(BACKEND_DIR / s.data_file))


@lru_cache
def get_generator() -> ItineraryGenerator:
    return ItineraryGenerator(get_settings())
