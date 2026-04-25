"""Tiny Supabase client wrapper for seed scripts.

We use the service role key — the staging table is RLS-locked so only
service-role can read/write. Don't ever ship this key in app code.
"""

from __future__ import annotations

import os
from functools import cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


def _required(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise RuntimeError(
            f"Missing env var {name}. Copy .env.example to .env and fill it in."
        )
    return v


@cache
def supa() -> Client:
    return create_client(_required("SUPABASE_URL"), _required("SUPABASE_SERVICE_ROLE_KEY"))


def seed_user_id() -> str:
    return _required("SEED_USER_ID")


def google_api_key() -> str:
    return _required("GOOGLE_PLACES_API_KEY")
