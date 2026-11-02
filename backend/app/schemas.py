import re
from datetime import date, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, computed_field, field_validator, model_validator

ActivityType = Literal["attraction", "dining", "accommodation", "transport", "activity"]
TravelStyle = Literal["solo", "couple", "group", "family"]
Pace = Literal["relaxed", "balanced", "packed"]
StayLevel = Literal["budget", "comfort", "premium"]

MAX_TRIP_DAYS = 14

Date = date  # Day.date would otherwise shadow the type inside the class body

_TIME_RE = re.compile(r"^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*$", re.I)


def new_id() -> str:
    return uuid4().hex[:12]


class TripPreferences(BaseModel):
    destination: str = Field(min_length=2, max_length=120)
    start_date: date
    end_date: date
    budget: float = Field(gt=0, description="Total budget for the whole party")
    currency: str = Field("USD", min_length=3, max_length=3)
    travelers: int = Field(1, ge=1, le=30)
    travel_style: TravelStyle = "solo"
    pace: Pace = "balanced"
    accommodation: StayLevel = "comfort"
    interests: list[str] = Field(default_factory=list, max_length=12)
    notes: str = Field("", max_length=1000)

    @field_validator("destination", "notes")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("currency")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @model_validator(mode="after")
    def _check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        if self.num_days > MAX_TRIP_DAYS:
            raise ValueError(f"trips are limited to {MAX_TRIP_DAYS} days")
        return self

    @property
    def num_days(self) -> int:
        return (self.end_date - self.start_date).days + 1


class Activity(BaseModel):
    id: str = Field(default_factory=new_id)
    time: str = "09:00"
    title: str = Field(min_length=1, max_length=200)
    type: ActivityType = "activity"
    description: str = ""
    location: str = ""
    duration_minutes: int = Field(60, ge=0, le=1440)
    cost: float = Field(0, ge=0, description="Estimated cost for the whole party")
    transport_note: str = ""

    @field_validator("time", mode="before")
    @classmethod
    def _normalise_time(cls, v):
        if not isinstance(v, str):
            return "09:00"
        m = _TIME_RE.match(v)
        if not m:
            return "09:00"
        hour, minute, meridiem = int(m[1]), int(m[2] or 0), (m[3] or "").lower()
        if meridiem == "pm" and hour < 12:
            hour += 12
        if meridiem == "am" and hour == 12:
            hour = 0
        return f"{min(hour, 23):02d}:{min(minute, 59):02d}"


class Day(BaseModel):
    day: int = 1
    date: Date | None = None
    title: str = ""
    theme: str = ""
    activities: list[Activity] = Field(default_factory=list)

    @computed_field
    @property
    def estimated_cost(self) -> float:
        return round(sum(a.cost for a in self.activities), 2)


class Lodging(BaseModel):
    name: str
    area: str = ""
    price_per_night: float = Field(0, ge=0, description="Whole party, per night")
    nights: int = Field(1, ge=1, le=MAX_TRIP_DAYS)
    why: str = ""


class Itinerary(BaseModel):
    summary: str = ""
    days: list[Day] = Field(default_factory=list)
    lodging: list[Lodging] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    generated_by: str = ""
    generation_note: str = ""

    @computed_field
    @property
    def lodging_cost(self) -> float:
        return round(sum(s.price_per_night * s.nights for s in self.lodging), 2)

    @computed_field
    @property
    def estimated_cost(self) -> float:
        return round(sum(d.estimated_cost for d in self.days) + self.lodging_cost, 2)


class Trip(BaseModel):
    id: str
    title: str
    preferences: TripPreferences
    itinerary: Itinerary
    share_token: str | None = None
    created_at: datetime
    updated_at: datetime


class SharedTrip(BaseModel):
    title: str
    preferences: TripPreferences
    itinerary: Itinerary


class TripSummary(BaseModel):
    id: str
    title: str
    destination: str
    start_date: date
    end_date: date
    num_days: int
    travelers: int
    budget: float
    currency: str
    estimated_cost: float
    generated_by: str
    shared: bool
    updated_at: datetime


class TripUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=120)
    itinerary: Itinerary | None = None


class DayRegenerateRequest(BaseModel):
    instruction: str = Field("", max_length=300)
