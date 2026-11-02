"""Trip persistence. Records are plain dicts: id, owner_id, title, preferences,
itinerary, share_token, created_at, updated_at (JSON-compatible)."""

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Protocol


class TripStore(Protocol):
    def list(self, owner_id: str) -> list[dict]: ...
    def get(self, trip_id: str) -> dict | None: ...
    def get_by_token(self, token: str) -> dict | None: ...
    def create(self, record: dict) -> dict: ...
    def update(self, trip_id: str, patch: dict) -> dict: ...
    def delete(self, trip_id: str) -> None: ...


class LocalJsonStore:
    """Demo-mode store: one JSON file, safe for a single process.

    The file is parsed once and kept in memory; every write goes through to disk
    atomically, so reads never touch the filesystem after start-up."""

    def __init__(self, path: str):
        self.path = Path(path)
        self._lock = threading.Lock()
        self._data: dict[str, dict] | None = None

    def _load(self) -> dict[str, dict]:
        if self._data is None:
            self._data = json.loads(self.path.read_text() or "{}") if self.path.exists() else {}
        return self._data

    def _flush(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.path.parent, suffix=".tmp")
        with os.fdopen(fd, "w") as f:
            json.dump(self._data, f, indent=2)
        os.replace(tmp, self.path)

    def list(self, owner_id):
        with self._lock:
            rows = [r for r in self._load().values() if r["owner_id"] == owner_id]
        return sorted(rows, key=lambda r: r["updated_at"], reverse=True)

    def get(self, trip_id):
        with self._lock:
            return self._load().get(trip_id)

    def get_by_token(self, token):
        with self._lock:
            return next((r for r in self._load().values() if r.get("share_token") == token), None)

    def create(self, record):
        with self._lock:
            self._load()[record["id"]] = record
            self._flush()
        return record

    def update(self, trip_id, patch):
        with self._lock:
            row = self._load()[trip_id]
            row.update(patch)
            self._flush()
            return row

    def delete(self, trip_id):
        with self._lock:
            self._load().pop(trip_id, None)
            self._flush()


class SupabaseStore:
    """Uses the service key, which bypasses RLS, so the router always filters by owner_id."""

    TABLE = "trips"

    def __init__(self, url: str, service_key: str):
        from supabase import create_client

        self.db = create_client(url, service_key)

    def _table(self):
        return self.db.table(self.TABLE)

    def list(self, owner_id):
        return self._table().select("*").eq("owner_id", owner_id).order("updated_at", desc=True).execute().data

    def get(self, trip_id):
        rows = self._table().select("*").eq("id", trip_id).limit(1).execute().data
        return rows[0] if rows else None

    def get_by_token(self, token):
        rows = self._table().select("*").eq("share_token", token).limit(1).execute().data
        return rows[0] if rows else None

    def create(self, record):
        return self._table().insert(record).execute().data[0]

    def update(self, trip_id, patch):
        return self._table().update(patch).eq("id", trip_id).execute().data[0]

    def delete(self, trip_id):
        self._table().delete().eq("id", trip_id).execute()
