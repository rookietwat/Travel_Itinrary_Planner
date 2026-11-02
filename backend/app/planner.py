"""Offline template planner.

Used when no ANTHROPIC_API_KEY is configured, or when a model call fails. It is
deterministic apart from the rotation seed, spends about 90% of the budget, and
only knows generic experiences, so it never invents named venues.
"""

import random
from datetime import timedelta

from .schemas import Activity, Day, Itinerary, Lodging, TripPreferences, new_id

# interest -> (title, description, minutes)
EXPERIENCES: dict[str, list[tuple[str, str, int]]] = {
    "food": [
        ("Guided street-food tasting in {d}", "Sample signature dishes with a local guide.", 150),
        ("Visit a local market in {d}", "Browse produce, snacks and regional specialities.", 90),
        ("Hands-on cooking class in {d}", "Learn a regional dish from a local cook.", 180),
    ],
    "sightseeing": [
        ("Highlights tour of {d}'s landmarks", "The headline sights, ordered to cut backtracking.", 180),
        ("Viewpoint at golden hour in {d}", "A skyline or scenic overlook for the best light.", 90),
        ("Old-town walking route in {d}", "Wander the central streets at an easy pace.", 120),
    ],
    "culture": [
        ("Local museum visit in {d}", "A museum covering the region's story.", 120),
        ("Traditional performance in {d}", "Music, dance or theatre rooted in local tradition.", 120),
        ("Community craft workshop in {d}", "Meet makers and try a local craft.", 120),
    ],
    "history": [
        ("Historic quarter walk in {d}", "Landmarks and stories from the city's past.", 150),
        ("Fort, palace or heritage site in {d}", "The best-preserved historic site nearby.", 150),
        ("Archaeology or heritage museum in {d}", "Context for everything else you have seen.", 120),
    ],
    "adventure": [
        ("Outdoor adventure activity near {d}", "Pick a hike, ride or water activity that suits your group.", 240),
        ("Guided day hike near {d}", "A moderate trail with a guide and views.", 240),
        ("Rental bikes through {d}", "Cover more ground at your own pace.", 150),
    ],
    "nature": [
        ("Park or garden stroll in {d}", "Green space and quiet time.", 90),
        ("Nature day trip from {d}", "A short transfer to a nearby natural highlight.", 300),
        ("Sunrise or sunset spot near {d}", "Plan around the best light of the day.", 90),
    ],
    "shopping": [
        ("Local crafts and souvenirs in {d}", "Independent shops and artisan stalls.", 120),
        ("Main shopping district in {d}", "Fashion, homeware and local brands.", 150),
    ],
    "nightlife": [
        ("Evening bar or live-music crawl in {d}", "A few well-reviewed venues within walking distance.", 180),
        ("Night market in {d}", "Street food and stalls after dark.", 120),
    ],
    "relaxation": [
        ("Spa or wellness session in {d}", "Massage, hammam or a quiet hour in a spa.", 120),
        ("Slow morning at a café in {d}", "A long breakfast and no schedule.", 90),
        ("Waterfront or park picnic in {d}", "Pick up supplies locally and unwind.", 120),
    ],
    "art": [
        ("Gallery hop in {d}", "A few galleries within a short walk of each other.", 150),
        ("Street-art walking tour of {d}", "Murals and the stories behind them.", 120),
    ],
}

GENERIC = [
    ("Neighbourhood walk in {d}", "Explore on foot with no fixed agenda.", 120),
    ("Local viewpoint in {d}", "A spot with a good view of the area.", 90),
    ("Browse a neighbourhood in {d}", "Cafés, shops and street life.", 120),
]

LUNCH = ["Casual lunch at a well-reviewed local café", "Lunch at a neighbourhood eatery", "Lunch from a local market stall"]
DINNER = {
    "solo": ["Dinner at a local counter-style restaurant", "Dinner at a lively communal-table spot"],
    "couple": ["Candlelit dinner at a regional-cuisine restaurant", "Sunset dinner with a view"],
    "group": ["Group dinner at a shareable-plates restaurant", "Family-style dinner for the whole group"],
    "family": ["Family-friendly dinner at a regional restaurant", "Relaxed early dinner with a kids' menu"],
}

SLOTS = {
    "relaxed": [("10:00", "exp"), ("13:00", "lunch"), ("19:30", "dinner")],
    "balanced": [("09:00", "exp"), ("12:30", "lunch"), ("14:30", "exp"), ("19:00", "dinner")],
    "packed": [("08:00", "exp"), ("11:00", "exp"), ("13:00", "lunch"), ("15:00", "exp"), ("17:30", "exp"), ("19:30", "dinner")],
}

LODGING_SHARE = {"budget": 0.30, "comfort": 0.38, "premium": 0.50}
STAY_LABEL = {"budget": "Budget-friendly stay", "comfort": "Comfortable mid-range hotel", "premium": "Premium boutique hotel"}
SPEND_RATIO = 0.9  # leave a buffer under the stated budget


def _pool(prefs: TripPreferences) -> list[tuple[str, str, int]]:
    """Daytime experiences; nightlife is kept out because it gets its own evening slot."""
    pool: list[tuple[str, str, int]] = []
    for interest in prefs.interests:
        if interest.strip().lower() != "nightlife":
            pool.extend(EXPERIENCES.get(interest.strip().lower(), []))
    if len(pool) < 5:  # a packed day has 4 activity slots; avoid wrapping onto the same item
        pool += [g for g in GENERIC if g not in pool]
    return pool


def _slots(prefs: TripPreferences) -> list[tuple[str, str]]:
    slots = list(SLOTS[prefs.pace])
    wants_night = any(i.strip().lower() == "nightlife" for i in prefs.interests)
    if wants_night and prefs.pace != "relaxed":
        slots.append(("21:00", "night"))
    return slots


def _amounts(prefs: TripPreferences) -> dict[str, float]:
    spend = prefs.budget * SPEND_RATIO
    lodging = spend * LODGING_SHARE[prefs.accommodation]
    transport = spend * 0.12
    food = spend * 0.25
    return {
        "lodging": lodging,
        "arrival": transport * 0.3,
        "departure": transport * 0.3,
        "food": food,
        "activities": spend - lodging - food - transport * 0.6,
    }


def plan_day(prefs: TripPreferences, index: int, base: int, rng: random.Random) -> Day:
    """`base` rotates the experience pool so consecutive days differ."""
    days = prefs.num_days
    amounts = _amounts(prefs)
    first, last = index == 0, index == days - 1
    slots = _slots(prefs)
    if first and days > 1:
        slots = [s for s in slots if s[0] >= "11:30"]
    if last and days > 1:
        slots = [s for s in slots if s[0] <= "15:30"]

    n_exp = sum(1 for _, kind in slots if kind in ("exp", "night")) or 1
    exp_cost = amounts["activities"] / days / n_exp
    food_day = amounts["food"] / days
    pool = _pool(prefs)
    dest = prefs.destination
    per_day = sum(1 for _, kind in _slots(prefs) if kind == "exp") or 1
    offset = base + index * per_day

    activities: list[Activity] = []
    if first:
        activities.append(Activity(
            time="10:30", title=f"Arrive in {dest} and transfer to your stay", type="transport",
            description="Settle in, drop bags and pick up a local SIM or transit card.",
            location=dest, duration_minutes=90,
            cost=round(amounts["arrival"], 2) if days > 1 else 0,
            transport_note="Pre-book an airport or station transfer.",
        ))
    pick = 0
    for time, kind in slots:
        if kind == "exp":
            title, desc, minutes = pool[(offset + pick) % len(pool)]
            pick += 1
            activities.append(Activity(
                time=time, title=title.format(d=dest), type="attraction" if pick % 2 else "activity",
                description=desc, location=dest, duration_minutes=minutes, cost=round(exp_cost, 2),
                transport_note="Walk or use local transit.",
            ))
        elif kind == "night":
            title, desc, minutes = EXPERIENCES["nightlife"][(base + index) % len(EXPERIENCES["nightlife"])]
            activities.append(Activity(
                time=time, title=title.format(d=dest), type="activity", description=desc, location=dest,
                duration_minutes=minutes, cost=round(exp_cost, 2), transport_note="Use a licensed taxi or ride-hail after dark.",
            ))
        elif kind == "lunch":
            activities.append(Activity(
                time=time, title=LUNCH[(index + rng.randrange(3)) % len(LUNCH)], type="dining",
                description="Pick somewhere close to the morning's activity.", location=dest,
                duration_minutes=75, cost=round(food_day * 0.4, 2),
            ))
        else:
            options = DINNER[prefs.travel_style]
            activities.append(Activity(
                time=time, title=options[(index + rng.randrange(2)) % len(options)], type="dining",
                description="Book ahead on weekends.", location=dest,
                duration_minutes=105, cost=round(food_day * 0.6, 2),
            ))
    if last and days > 1:
        activities.append(Activity(
            time="16:30", title=f"Check out and depart from {dest}", type="transport",
            description="Leave a comfortable buffer before your departure.", location=dest,
            duration_minutes=90, cost=round(amounts["departure"], 2),
        ))

    theme = ("Arrival" if first and days > 1 else "Departure" if last and days > 1 else "Exploring")
    activities.sort(key=lambda a: a.time)
    return Day(
        day=index + 1, date=prefs.start_date + timedelta(days=index),
        title=f"Day {index + 1}: {theme} {dest}" if theme == "Exploring" else f"Day {index + 1}: {theme} in {dest}",
        theme=theme, activities=activities,
    )


def plan_offline(prefs: TripPreferences, rng: random.Random | None = None) -> Itinerary:
    rng = rng or random.Random()
    base = rng.randrange(1000)
    days = [plan_day(prefs, i, base, rng) for i in range(prefs.num_days)]
    nights = max(1, prefs.num_days - 1)
    lodging_total = _amounts(prefs)["lodging"]
    interests = ", ".join(prefs.interests) if prefs.interests else "general sightseeing"
    return Itinerary(
        summary=(
            f"A {prefs.num_days}-day {prefs.pace} {prefs.travel_style} trip to {prefs.destination} "
            f"for {prefs.travelers} traveler{'s' if prefs.travelers != 1 else ''}, built around {interests} "
            f"and planned to stay under {prefs.currency} {prefs.budget:,.0f}."
        ),
        days=days,
        lodging=[Lodging(
            name=f"{STAY_LABEL[prefs.accommodation]} in central {prefs.destination}",
            area=f"Central {prefs.destination}", price_per_night=round(lodging_total / nights, 2), nights=nights,
            why="A central base keeps daily transfers short.",
        )],
        tips=[
            "Book lodging and any timed-entry attractions as early as you can.",
            "Keep roughly 10% of the budget unspent for surprises.",
            "Download an offline map of the area before you travel.",
        ],
        generated_by="offline-template",
        generation_note="Template plan: set ANTHROPIC_API_KEY on the backend for tailored venue recommendations.",
    )
