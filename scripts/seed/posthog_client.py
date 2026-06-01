"""Shared PostHog client for the seed pipeline scripts.

Uses the instance-based API as recommended by the PostHog Python SDK.
Registers shutdown via atexit so events are flushed on normal exit.
"""

from __future__ import annotations

import atexit
import os
from functools import cache

from dotenv import load_dotenv
from posthog import Posthog

load_dotenv()

# Stable identifier for the operator running the seed pipeline.
DISTINCT_ID = "seed-operator"


@cache
def ph() -> Posthog | None:
    api_key = os.getenv("POSTHOG_API_KEY")
    if not api_key:
        return None

    host = os.getenv("POSTHOG_HOST")
    if not host:
        return None

    client = Posthog(
        api_key,
        host=host,
        enable_exception_autocapture=True,
    )
    atexit.register(client.shutdown)
    return client


def capture(event: str, properties: dict | None = None) -> None:
    client = ph()
    if client is None:
        return
    client.capture(
        distinct_id=DISTINCT_ID,
        event=event,
        properties=properties or {},
    )


def capture_exception(exc: Exception) -> None:
    client = ph()
    if client is None:
        return
    client.capture_exception(exc, DISTINCT_ID)
