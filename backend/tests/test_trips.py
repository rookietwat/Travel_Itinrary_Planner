import copy


def create(client, prefs):
    res = client.post("/api/trips", json=prefs)
    assert res.status_code == 201, res.text
    return res.json()


def test_health_reports_offline_mode(client):
    body = client.get("/api/health").json()
    assert body == {"status": "ok", "ai": "offline-template", "storage": "local-file", "auth": False}


def test_create_builds_one_day_per_date_and_stays_under_budget(client, prefs):
    trip = create(client, prefs)
    days = trip["itinerary"]["days"]
    assert [d["day"] for d in days] == [1, 2, 3, 4]
    assert [d["date"] for d in days] == ["2026-12-04", "2026-12-05", "2026-12-06", "2026-12-07"]
    assert trip["preferences"]["currency"] == "EUR"
    assert 0 < trip["itinerary"]["estimated_cost"] <= prefs["budget"]
    assert trip["title"] == "Lisbon · 4 days"
    for day in days:
        times = [a["time"] for a in day["activities"]]
        assert times == sorted(times)
        assert any(a["type"] == "dining" for a in day["activities"])
    assert days[0]["activities"][0]["type"] == "transport"
    assert days[-1]["activities"][-1]["type"] == "transport"


def test_pace_controls_density(client, prefs):
    counts = {}
    for pace in ("relaxed", "packed"):
        trip = create(client, {**prefs, "pace": pace})
        counts[pace] = len(trip["itinerary"]["days"][1]["activities"])
    assert counts["relaxed"] < counts["packed"]


def test_invalid_preferences_are_rejected(client, prefs):
    assert client.post("/api/trips", json={**prefs, "end_date": "2026-12-01"}).status_code == 422
    assert client.post("/api/trips", json={**prefs, "end_date": "2027-02-01"}).status_code == 422
    assert client.post("/api/trips", json={**prefs, "budget": 0}).status_code == 422


def test_list_get_update_delete(client, prefs):
    trip = create(client, prefs)
    listing = client.get("/api/trips").json()
    assert [t["id"] for t in listing] == [trip["id"]]
    assert listing[0]["num_days"] == 4

    edited = copy.deepcopy(trip["itinerary"])
    edited["days"][0]["activities"][1]["title"] = "Pastéis de nata crawl"
    edited["days"][0]["activities"][1]["cost"] = 5
    res = client.put(f"/api/trips/{trip['id']}", json={"title": "Lisbon with Sam", "itinerary": edited})
    assert res.status_code == 200
    saved = res.json()
    assert saved["title"] == "Lisbon with Sam"
    assert saved["itinerary"]["days"][0]["activities"][1]["title"] == "Pastéis de nata crawl"
    assert client.get(f"/api/trips/{trip['id']}").json()["title"] == "Lisbon with Sam"

    edited["days"].pop()
    assert client.put(f"/api/trips/{trip['id']}", json={"itinerary": edited}).status_code == 422

    assert client.delete(f"/api/trips/{trip['id']}").status_code == 204
    assert client.get(f"/api/trips/{trip['id']}").status_code == 404


def test_regenerate_single_day_leaves_other_days_alone(client, prefs):
    trip = create(client, prefs)
    res = client.post(f"/api/trips/{trip['id']}/days/2/regenerate", json={"instruction": "more museums"})
    assert res.status_code == 200
    new = res.json()["itinerary"]["days"]
    old = trip["itinerary"]["days"]
    assert new[0] == old[0] and new[2] == old[2] and new[3] == old[3]
    assert new[1]["day"] == 2 and new[1]["date"] == "2026-12-05"
    assert client.post(f"/api/trips/{trip['id']}/days/9/regenerate").status_code == 404


def test_regenerate_whole_trip_with_new_preferences(client, prefs):
    trip = create(client, prefs)
    res = client.post(
        f"/api/trips/{trip['id']}/regenerate",
        json={**prefs, "end_date": "2026-12-05", "budget": 600},
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["itinerary"]["days"]) == 2
    assert body["preferences"]["budget"] == 600


def test_share_link_is_public_read_only_and_revocable(client, prefs):
    trip = create(client, prefs)
    shared = client.post(f"/api/trips/{trip['id']}/share").json()
    token = shared["share_token"]
    assert token
    assert client.post(f"/api/trips/{trip['id']}/share").json()["share_token"] == token

    public = client.get(f"/api/shared/{token}")
    assert public.status_code == 200
    assert "owner_id" not in public.json() and "share_token" not in public.json()

    client.delete(f"/api/trips/{trip['id']}/share")
    assert client.get(f"/api/shared/{token}").status_code == 404


def test_offline_plan_does_not_repeat_activities_or_misplace_nightlife(client, prefs):
    trip = create(client, {**prefs, "end_date": "2026-12-06", "pace": "packed", "interests": ["adventure", "nightlife"]})
    for day in trip["itinerary"]["days"]:
        titles = [a["title"] for a in day["activities"]]
        assert len(titles) == len(set(titles)), titles
        for a in day["activities"]:
            if any(w in a["title"].lower() for w in ("bar", "night market", "live-music")):
                assert a["time"] >= "19:00", a


def test_offline_day_regeneration_changes_the_day(client, prefs):
    trip = create(client, {**prefs, "interests": ["food", "history", "art"]})
    old = {a["title"] for a in trip["itinerary"]["days"][1]["activities"]}
    for _ in range(5):
        new = client.post(f"/api/trips/{trip['id']}/days/2/regenerate").json()["itinerary"]["days"][1]
        assert {a["title"] for a in new["activities"]} != old
        old = {a["title"] for a in new["activities"]}


def test_duplicate_copies_plan_without_share_token(client, prefs):
    trip = create(client, prefs)
    client.post(f"/api/trips/{trip['id']}/share")
    res = client.post(f"/api/trips/{trip['id']}/duplicate")
    assert res.status_code == 201
    copy_ = res.json()
    assert copy_["id"] != trip["id"]
    assert copy_["title"] == "Lisbon · 4 days (copy)"
    assert copy_["share_token"] is None
    assert copy_["itinerary"]["days"] == trip["itinerary"]["days"]
    assert len(client.get("/api/trips").json()) == 2


def test_store_survives_restart(settings, client, prefs):
    from app.store import LocalJsonStore

    trip = create(client, prefs)
    fresh = LocalJsonStore(settings.data_file)  # new instance, cold cache
    assert fresh.get(trip["id"])["title"] == trip["title"]
    assert [r["id"] for r in fresh.list("demo-user")] == [trip["id"]]


def test_regenerate_with_new_preferences_refreshes_default_title_only(client, prefs):
    trip = create(client, prefs)
    longer = {**prefs, "end_date": "2026-12-08"}
    assert client.post(f"/api/trips/{trip['id']}/regenerate", json=longer).json()["title"] == "Lisbon · 5 days"
    client.put(f"/api/trips/{trip['id']}", json={"title": "Honeymoon"})
    assert client.post(f"/api/trips/{trip['id']}/regenerate", json=prefs).json()["title"] == "Honeymoon"
