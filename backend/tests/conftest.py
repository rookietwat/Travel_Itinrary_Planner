import pytest
from fastapi.testclient import TestClient

from app.ai import ItineraryGenerator
from app.config import Settings, get_settings
from app.deps import get_generator, get_store
from app.main import app
from app.store import LocalJsonStore


@pytest.fixture
def settings(tmp_path):
    return Settings(_env_file=None, data_file=str(tmp_path / "trips.json"))


@pytest.fixture
def client(settings):
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_store] = lambda: LocalJsonStore(settings.data_file)
    app.dependency_overrides[get_generator] = lambda: ItineraryGenerator(settings)
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def prefs():
    return {
        "destination": "Lisbon",
        "start_date": "2026-12-04",
        "end_date": "2026-12-07",
        "budget": 1200,
        "currency": "eur",
        "travelers": 2,
        "travel_style": "couple",
        "pace": "balanced",
        "accommodation": "comfort",
        "interests": ["food", "history"],
    }
