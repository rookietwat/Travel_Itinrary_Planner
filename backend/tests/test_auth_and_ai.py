import time
from types import SimpleNamespace

import jwt
import pytest
from fastapi.testclient import TestClient

from app.ai import ItineraryGenerator
from app.config import Settings, get_settings
from app.deps import get_generator, get_store
from app.main import app
from app.schemas import TripPreferences
from app.store import LocalJsonStore

SECRET = "test-secret-test-secret-test-secret"


def token_for(user_id: str, secret: str = SECRET, exp_in: int = 3600) -> str:
    claims = {"sub": user_id, "aud": "authenticated", "exp": int(time.time()) + exp_in}
    return jwt.encode(claims, secret, algorithm="HS256")


@pytest.fixture
def secured(tmp_path):
    settings = Settings(_env_file=None, supabase_jwt_secret=SECRET, data_file=str(tmp_path / "t.json"))
    store = LocalJsonStore(settings.data_file)
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[get_generator] = lambda: ItineraryGenerator(settings)
    yield TestClient(app)
    app.dependency_overrides.clear()


def auth(user_id, **kw):
    return {"Authorization": f"Bearer {token_for(user_id, **kw)}"}


def test_requests_without_a_valid_token_are_rejected(secured):
    assert secured.get("/api/trips").status_code == 401
    assert secured.get("/api/trips", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert secured.get("/api/trips", headers=auth("u1", secret="x" * 40)).status_code == 401
    assert secured.get("/api/trips", headers=auth("u1", exp_in=-10)).status_code == 401


def test_users_cannot_see_or_change_each_others_trips(secured, prefs):
    mine = secured.post("/api/trips", json=prefs, headers=auth("alice")).json()
    assert secured.get("/api/trips", headers=auth("bob")).json() == []
    for method, path in [("get", ""), ("delete", ""), ("post", "/share"), ("post", "/regenerate")]:
        res = getattr(secured, method)(f"/api/trips/{mine['id']}{path}", headers=auth("bob"))
        assert res.status_code == 404, (method, path)
    assert secured.get(f"/api/trips/{mine['id']}", headers=auth("alice")).status_code == 200


class FakeClient:
    """Stands in for anthropic.Anthropic and returns a canned tool call."""

    def __init__(self, payload):
        self.payload = payload
        self.messages = SimpleNamespace(create=self._create)
        self.calls = []

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.payload, Exception):
            raise self.payload
        block = SimpleNamespace(type="tool_use", name=kwargs["tool_choice"]["name"], input=self.payload)
        return SimpleNamespace(content=[block])


def keyed_generator(payload):
    gen = ItineraryGenerator(Settings(_env_file=None, anthropic_api_key="sk-test", anthropic_model="claude-sonnet-5-5"))
    gen._client = FakeClient(payload)
    return gen


PREFS = TripPreferences(
    destination="Kyoto", start_date="2026-12-04", end_date="2026-12-05", budget=900, interests=["culture"]
)


def model_day(title):
    return {"title": title, "activities": [
        {"time": "2:30 PM", "title": "Tea ceremony", "type": "activity", "cost": 40},
        {"time": "9am", "title": "Fushimi Inari", "type": "attraction", "cost": 0},
    ]}


def test_model_output_is_normalised():
    gen = keyed_generator({"summary": "Kyoto", "days": [model_day("A"), model_day("B")], "lodging": [
        {"name": "Ryokan", "price_per_night": 200, "nights": 1}]})
    itinerary = gen.generate(PREFS)
    assert itinerary.generated_by == "claude-sonnet-5-5"
    assert [str(d.date) for d in itinerary.days] == ["2026-12-04", "2026-12-05"]
    assert [a.time for a in itinerary.days[0].activities] == ["09:00", "14:30"]
    assert itinerary.estimated_cost == 280  # 2 days x 40 + 1 night x 200
    call = gen._client.calls[0]
    assert call["tool_choice"]["name"] == "submit_itinerary"
    assert "Kyoto" in call["messages"][0]["content"]


@pytest.mark.parametrize("payload", [
    RuntimeError("boom"),
    {"days": [model_day("only one day")]},
    {"days": "not a list"},
])
def test_model_failures_fall_back_to_template_plan(payload):
    itinerary = keyed_generator(payload).generate(PREFS)
    assert itinerary.generated_by == "offline-template"
    assert len(itinerary.days) == 2
    assert "template plan" in itinerary.generation_note


def test_day_regeneration_passes_the_instruction_and_other_days_to_the_model():
    gen = keyed_generator({"days": []})
    base = ItineraryGenerator(Settings(_env_file=None)).generate(PREFS)
    gen._client = FakeClient(model_day("Gion evening"))
    day = gen.regenerate_day(PREFS, base, 2, "evening geisha district")
    assert day.day == 2 and str(day.date) == "2026-12-05" and day.title == "Gion evening"
    prompt = gen._client.calls[0]["messages"][0]["content"]
    assert "evening geisha district" in prompt
    assert base.days[0].activities[0].title in prompt
