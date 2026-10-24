"""Google Calendar agenda backend for the calendar-pane desktop plugin.

Mounted by the dashboard plugin host at /api/plugins/calendar-pane/ and reached from the pane
through ctx.rest('/agenda'). The OAuth token, the proxy fallback and the pysocks plumbing already
live in the google-workspace skill, so this backend shells out to that CLI instead of
re-implementing the auth stack — one source of truth for "how Hermes talks to Google".

One subprocess per refresh, cached briefly: a cold interpreter start costs ~1.5 s and the pane
polls on the order of minutes, so the cache keeps a reopened pane instant without going stale.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Query

log = logging.getLogger(__name__)

router = APIRouter()

_CACHE_TTL_S = 120
_cache: dict[tuple[str, int], tuple[float, dict]] = {}


def _hermes_home() -> Path:
    try:
        from hermes_constants import get_hermes_home  # type: ignore

        return Path(get_hermes_home())
    except Exception:
        env = os.environ.get("HERMES_HOME", "").strip()
        return Path(env) if env else Path.home() / ".hermes"


def _script() -> Path:
    return _hermes_home() / "skills" / "productivity" / "google-workspace" / "scripts" / "google_api.py"


def _iso(dt: datetime) -> str:
    return dt.astimezone().isoformat(timespec="seconds")


def _run_calendar_list(start: str, end: str, calendar: str) -> list[dict]:
    script = _script()
    if not script.exists():
        raise RuntimeError(f"google-workspace skill not found at {script}")
    proc = subprocess.run(
        [sys.executable, str(script), "calendar", "list",
         "--start", start, "--end", end, "--calendar", calendar],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="strict",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        timeout=90,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "google_api.py failed").strip().splitlines()
        raise RuntimeError(detail[-1] if detail else "google_api.py failed")
    raw = proc.stdout.strip()
    if not raw:
        return []
    return json.loads(raw)


def _normalise(event: dict) -> dict:
    # google_api.py flattens Google's {date}/{dateTime} objects into one string: all-day events
    # arrive as "2026-08-18", timed ones as a full ISO stamp. Accept both shapes so this works
    # against the CLI today and against a raw Calendar API payload without another change.
    raw_start = event.get("start")
    raw_end = event.get("end")
    if isinstance(raw_start, dict):
        start = raw_start.get("dateTime") or raw_start.get("date") or ""
        all_day = "date" in raw_start and "dateTime" not in raw_start
    else:
        start = str(raw_start or "")
        all_day = "T" not in start
    if isinstance(raw_end, dict):
        end = raw_end.get("dateTime") or raw_end.get("date") or ""
    else:
        end = str(raw_end or "")
    return {
        "id": event.get("id"),
        "summary": event.get("summary") or "(无标题)",
        "start": start,
        "end": end,
        "all_day": all_day,
        "location": event.get("location") or "",
        "link": event.get("htmlLink") or "",
        "status": event.get("status") or "",
    }


@router.get("/health")
async def health() -> dict:
    script = _script()
    token = _hermes_home() / "google_token.json"
    return {"ok": script.exists() and token.exists(), "script": str(script), "token": token.exists()}


@router.get("/agenda")
async def agenda(
    days: int = Query(14, ge=1, le=120),
    calendar: str = Query("primary"),
) -> dict:
    key = (calendar, days)
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _CACHE_TTL_S:
        return {**hit[1], "cached": True}

    start = datetime.now(timezone.utc) - timedelta(hours=6)
    end = datetime.now(timezone.utc) + timedelta(days=days)
    try:
        # Google/CLI I/O must not stall the shared dashboard event loop.
        events = await asyncio.to_thread(_run_calendar_list, _iso(start), _iso(end), calendar)
    except Exception as exc:  # surfaced to the pane as an error card, never a 500 stack
        log.warning("calendar-pane agenda failed: %s", exc)
        return {"error": str(exc), "items": [], "days": days}

    items = sorted((_normalise(e) for e in events), key=lambda e: e["start"])
    payload = {
        "items": items,
        "days": days,
        "start": _iso(start),
        "end": _iso(end),
        "fetched_at": int(now),
    }
    _cache[key] = (now, payload)
    return {**payload, "cached": False}
