import secrets
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from .ai import ItineraryGenerator, finalise_day
from .auth import User, get_current_user
from .deps import get_generator, get_store
from .schemas import (
    DayRegenerateRequest,
    SharedTrip,
    Trip,
    TripPreferences,
    TripSummary,
    TripUpdate,
)
from .store import TripStore

router = APIRouter(prefix="/api")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _owned(trip_id: str, user: User, store: TripStore) -> dict:
    record = store.get(trip_id)
    if not record or record["owner_id"] != user.id:
        raise HTTPException(404, "Trip not found")
    return record


def _trip(record: dict) -> Trip:
    return Trip.model_validate(record)


def _default_title(prefs: TripPreferences) -> str:
    return f"{prefs.destination} · {prefs.num_days} day{'s' if prefs.num_days != 1 else ''}"


@router.get("/trips", response_model=list[TripSummary])
def list_trips(user: User = Depends(get_current_user), store: TripStore = Depends(get_store)):
    summaries = []
    for record in store.list(user.id):
        trip = _trip(record)
        p = trip.preferences
        summaries.append(TripSummary(
            id=trip.id, title=trip.title, destination=p.destination, start_date=p.start_date,
            end_date=p.end_date, num_days=p.num_days, travelers=p.travelers, budget=p.budget,
            currency=p.currency, estimated_cost=trip.itinerary.estimated_cost,
            generated_by=trip.itinerary.generated_by, shared=bool(trip.share_token),
            updated_at=trip.updated_at,
        ))
    return summaries


@router.post("/trips", response_model=Trip, status_code=201)
def create_trip(
    prefs: TripPreferences,
    user: User = Depends(get_current_user),
    store: TripStore = Depends(get_store),
    generator: ItineraryGenerator = Depends(get_generator),
):
    itinerary = generator.generate(prefs)
    now = _now()
    record = {
        "id": str(uuid4()),
        "owner_id": user.id,
        "title": _default_title(prefs),
        "preferences": prefs.model_dump(mode="json"),
        "itinerary": itinerary.model_dump(mode="json"),
        "share_token": None,
        "created_at": now,
        "updated_at": now,
    }
    return _trip(store.create(record))


@router.get("/trips/{trip_id}", response_model=Trip)
def get_trip(trip_id: str, user: User = Depends(get_current_user), store: TripStore = Depends(get_store)):
    return _trip(_owned(trip_id, user, store))


@router.put("/trips/{trip_id}", response_model=Trip)
def update_trip(
    trip_id: str,
    body: TripUpdate,
    user: User = Depends(get_current_user),
    store: TripStore = Depends(get_store),
):
    record = _owned(trip_id, user, store)
    prefs = TripPreferences.model_validate(record["preferences"])
    patch: dict = {"updated_at": _now()}
    if body.title is not None:
        patch["title"] = body.title
    if body.itinerary is not None:
        if len(body.itinerary.days) != prefs.num_days:
            raise HTTPException(422, f"itinerary must have {prefs.num_days} days")
        for i, day in enumerate(body.itinerary.days):
            finalise_day(day, prefs, i)
        patch["itinerary"] = body.itinerary.model_dump(mode="json")
    return _trip(store.update(trip_id, patch))


@router.delete("/trips/{trip_id}", status_code=204)
def delete_trip(trip_id: str, user: User = Depends(get_current_user), store: TripStore = Depends(get_store)):
    _owned(trip_id, user, store)
    store.delete(trip_id)


@router.post("/trips/{trip_id}/regenerate", response_model=Trip)
def regenerate_trip(
    trip_id: str,
    new_prefs: TripPreferences | None = None,
    user: User = Depends(get_current_user),
    store: TripStore = Depends(get_store),
    generator: ItineraryGenerator = Depends(get_generator),
):
    """Rebuild the whole itinerary, optionally with edited preferences."""
    record = _owned(trip_id, user, store)
    old_prefs = TripPreferences.model_validate(record["preferences"])
    prefs = new_prefs or old_prefs
    patch = {
        "preferences": prefs.model_dump(mode="json"),
        "itinerary": generator.generate(prefs).model_dump(mode="json"),
        "updated_at": _now(),
    }
    if record["title"] == _default_title(old_prefs):  # keep custom titles, refresh generated ones
        patch["title"] = _default_title(prefs)
    return _trip(store.update(trip_id, patch))


@router.post("/trips/{trip_id}/days/{day_number}/regenerate", response_model=Trip)
def regenerate_day(
    trip_id: str,
    day_number: int,
    body: DayRegenerateRequest | None = None,
    user: User = Depends(get_current_user),
    store: TripStore = Depends(get_store),
    generator: ItineraryGenerator = Depends(get_generator),
):
    trip = _trip(_owned(trip_id, user, store))
    if not 1 <= day_number <= len(trip.itinerary.days):
        raise HTTPException(404, "Day not found")
    new_day = generator.regenerate_day(
        trip.preferences, trip.itinerary, day_number, body.instruction if body else ""
    )
    trip.itinerary.days[day_number - 1] = new_day
    patch = {"itinerary": trip.itinerary.model_dump(mode="json"), "updated_at": _now()}
    return _trip(store.update(trip_id, patch))


@router.post("/trips/{trip_id}/duplicate", response_model=Trip, status_code=201)
def duplicate_trip(trip_id: str, user: User = Depends(get_current_user), store: TripStore = Depends(get_store)):
    """Copy a trip (plan included) so it can be tweaked without touching the original."""
    source = _owned(trip_id, user, store)
    now = _now()
    record = {
        **{k: source[k] for k in ("owner_id", "preferences", "itinerary")},
        "id": str(uuid4()),
        "title": f"{source['title']} (copy)",
        "share_token": None,
        "created_at": now,
        "updated_at": now,
    }
    return _trip(store.create(record))


@router.post("/trips/{trip_id}/share", response_model=Trip)
def share_trip(trip_id: str, user: User = Depends(get_current_user), store: TripStore = Depends(get_store)):
    record = _owned(trip_id, user, store)
    token = record.get("share_token") or secrets.token_urlsafe(9)
    return _trip(store.update(trip_id, {"share_token": token}))


@router.delete("/trips/{trip_id}/share", response_model=Trip)
def unshare_trip(trip_id: str, user: User = Depends(get_current_user), store: TripStore = Depends(get_store)):
    _owned(trip_id, user, store)
    return _trip(store.update(trip_id, {"share_token": None}))


@router.get("/shared/{token}", response_model=SharedTrip)
def get_shared(token: str, store: TripStore = Depends(get_store)):
    """Public, read-only view for anyone holding the link."""
    record = store.get_by_token(token)
    if not record:
        raise HTTPException(404, "This link is no longer active")
    return SharedTrip.model_validate(record)
