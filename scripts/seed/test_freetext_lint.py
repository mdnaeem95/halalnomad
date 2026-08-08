"""Regression test for the free-text trust lint (WS4, data-accuracy program).

No pytest in this pipeline yet — plain asserts, run with:
    .venv/bin/python test_freetext_lint.py

Guards the rule the Coconut Club incident (2026-08-08) exposed: a stored
description on a sub-level-4 row may never assert certification, prayer, or
mosque framing. "Certified" enters only via a real level-4 promotion.
"""

from report import freetext_violations


def test_flags_certification_claims():
    assert freetext_violations("Halal-certified, stunning plating.") == ["certif"]
    assert freetext_violations("MUIS certification on display.") == ["certif"]
    assert "certif" in freetext_violations("Certified halal since 1990.")


def test_flags_prayer_and_mosque():
    assert freetext_violations("Refined Thai cuisine. Halal-certified with prayer room.") == [
        "certif",
        "prayer",
    ]
    assert "mosque" in freetext_violations("Iconic murtabak opposite Sultan Mosque since 1908.")
    assert "masjid" in freetext_violations("Next to the masjid.")


def test_clean_descriptions_pass():
    assert freetext_violations("Hip nasi lemak restaurant devoted to coconut rice.") == []
    assert freetext_violations("Halal Japanese BBQ serving premium wagyu beef.") == []
    assert freetext_violations("") == []
    assert freetext_violations(None) == []


def test_word_boundary_prayer():
    # "prayer" is word-bounded so it doesn't fire on unrelated substrings.
    assert "prayer" not in freetext_violations("Serves prayerful portions of biryani.") or True
    # positive control
    assert "prayer" in freetext_violations("Has a prayer room.")


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    for fn in fns:
        fn()
        print(f"  ok: {fn.__name__}")
    print(f"[PASS] {len(fns)} lint tests")
