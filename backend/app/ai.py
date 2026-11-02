import json
import logging
import random
from datetime import timedelta

from .config import Settings
from .planner import plan_day, plan_offline
from .schemas import Day, Itinerary, TripPreferences, new_id

log = logging.getLogger("planner.ai")


class GenerationError(Exception):
    pass


SYSTEM = """You are an expert travel planner. You build realistic, well-paced day-by-day itineraries.

Rules:
- Costs are the estimated total for the WHOLE party, in the trip's currency, as plain numbers.
- The sum of all activity costs plus lodging (price_per_night x nights) must stay at or under the budget.
- Order activities by time of day and keep travel between consecutive stops short.
- Respect the pace: relaxed = 2-3 stops a day, balanced = 4-5, packed = 6-7 (meals count as stops).
- Match the traveller type and accommodation level, and weave in the stated interests.
- Day 1 starts with arrival and the last day ends with departure when the trip has more than one day.
- Only recommend real, well-known places and venues you are confident exist; otherwise describe the kind of place.
- Use 24-hour HH:MM times. Activity type is one of attraction, dining, accommodation, transport, activity.
- Lodging nights must add up to the number of days minus one (minimum one night).
Always answer by calling the provided tool."""


def _prefs_block(prefs: TripPreferences) -> str:
    return (
        f"Destination: {prefs.destination}\n"
        f"Dates: {prefs.start_date} to {prefs.end_date} ({prefs.num_days} days)\n"
        f"Total budget: {prefs.currency} {prefs.budget:,.0f} for {prefs.travelers} traveler(s)\n"
        f"Traveller type: {prefs.travel_style}\nPace: {prefs.pace}\nAccommodation level: {prefs.accommodation}\n"
        f"Interests: {', '.join(prefs.interests) or 'none stated'}\n"
        f"Extra notes: {prefs.notes or 'none'}"
    )


def finalise_day(day: Day, prefs: TripPreferences, index: int) -> Day:
    day.day = index + 1
    day.date = prefs.start_date + timedelta(days=index)
    day.activities.sort(key=lambda a: a.time)
    for activity in day.activities:
        activity.id = new_id()
    return day


class ItineraryGenerator:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None

    @property
    def model_name(self) -> str:
        return self.settings.anthropic_model if self.settings.anthropic_api_key else "offline-template"

    def _ask(self, user: str, tool_name: str, schema: dict, max_tokens: int = 8192):
        if self._client is None:
            import anthropic

            # Fail fast rather than hanging a request: 90 s per attempt, one retry.
            self._client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key, timeout=90.0, max_retries=1)
        response = self._client.messages.create(
            model=self.settings.anthropic_model,
            max_tokens=max_tokens,
            # The system prompt is identical on every call, so let the API cache it.
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
            tools=[{"name": tool_name, "description": "Submit the finished plan.", "input_schema": schema}],
            tool_choice={"type": "tool", "name": tool_name},
        )
        for block in response.content:
            if block.type == "tool_use" and block.name == tool_name:
                return block.input
        raise GenerationError("model returned no tool call")

    def generate(self, prefs: TripPreferences) -> Itinerary:
        if not self.settings.anthropic_api_key:
            return plan_offline(prefs)
        try:
            data = self._ask(
                f"Plan this trip.\n\n{_prefs_block(prefs)}",
                "submit_itinerary",
                Itinerary.model_json_schema(mode="validation"),
            )
            itinerary = Itinerary.model_validate(data)
            if len(itinerary.days) != prefs.num_days:
                raise GenerationError(f"expected {prefs.num_days} days, got {len(itinerary.days)}")
            for i, day in enumerate(itinerary.days):
                finalise_day(day, prefs, i)
            itinerary.generated_by = self.settings.anthropic_model
            itinerary.generation_note = ""
            return itinerary
        except Exception as exc:  # noqa: BLE001 - any model/validation failure falls back to the template plan
            log.warning("AI generation failed, using template plan: %r", exc)
            fallback = plan_offline(prefs)
            fallback.generation_note = (
                f"The AI model could not produce a plan ({type(exc).__name__}), so this is a template plan. "
                "Regenerate to try again."
            )
            return fallback

    @staticmethod
    def _different_template_day(prefs: TripPreferences, current: Day, index: int) -> Day:
        """Re-roll the template day until its activities differ from the current ones."""
        seen = {a.title for a in current.activities}
        day = current
        for _ in range(10):
            day = plan_day(prefs, index, random.randrange(1000), random.Random())
            if {a.title for a in day.activities} != seen:
                break
        return day

    def regenerate_day(self, prefs: TripPreferences, itinerary: Itinerary, day_number: int, instruction: str = "") -> Day:
        index = day_number - 1
        if not self.settings.anthropic_api_key:
            return self._different_template_day(prefs, itinerary.days[index], index)
        others = [a.title for d in itinerary.days if d.day != day_number for a in d.activities]
        user = (
            f"Rewrite day {day_number} of this trip so it differs from the current version.\n\n{_prefs_block(prefs)}\n\n"
            f"Current plan for day {day_number}:\n{json.dumps(itinerary.days[index].model_dump(mode='json', exclude={'estimated_cost'}))}\n\n"
            f"Do not repeat anything planned on other days: {json.dumps(others)}\n"
            f"Keep this day's cost close to {itinerary.days[index].estimated_cost:.0f} {prefs.currency}.\n"
            f"Traveller's request for this day: {instruction or 'surprise me with a different mix'}"
        )
        try:
            data = self._ask(user, "submit_day", Day.model_json_schema(mode="validation"), max_tokens=2048)
            return finalise_day(Day.model_validate(data), prefs, index)
        except Exception as exc:  # noqa: BLE001
            log.warning("AI day regeneration failed, using template day: %r", exc)
            return self._different_template_day(prefs, itinerary.days[index], index)
