"""
practice_constants.py

Python mirror of practice_constants.js. Loads practice_constants.json
and exposes a handful of derived strings so verify.py can confirm
that generated documents and the website contain the correct values.

Edit practice_constants.json — NOT this file — to change the
practice's focus, voice, fees, licences, or contact details.
"""

import json
from pathlib import Path

_JSON = Path(__file__).with_name("practice_constants.json")
with open(_JSON, "r", encoding="utf-8") as _f:
    C = json.load(_f)


# --- Derived strings (match practice_constants.js) ----------------------

def _license_line():
    return " · ".join(
        f"{l['abbr']} {l['profession']} {l['number']}" for l in C["licenses"]
    )


def _license_lines():
    return [f"{l['state']} {l['profession']} #{l['number']}" for l in C["licenses"]]


def _credentials_compact():
    return (
        f"{C['identity']['clinician_credentials']} · "
        + ", ".join(f"{l['abbr']} {l['number']}" for l in C["licenses"])
    )


LICENSE_LINE = _license_line()
LICENSE_LINES = _license_lines()
CREDENTIALS_COMPACT = _credentials_compact()

COMPLIANCE_FOOTER = (
    f"{C['identity']['legal_entity']} · NPI {C['registry']['npi']} · "
    f"{LICENSE_LINE} · {C['contact']['email']}"
)

NICHE_SENTENCE = (
    f"I work with {C['niche']['track1_long']}, "
    f"and with {C['niche']['track2_long']}."
)

FRAMEWORKS_SENTENCE = (
    f"I primarily draw on {C['frameworks']['cbc']['short']} "
    f"({C['frameworks']['cbc']['attribution']}) "
    f"and {C['frameworks']['ipt']['short']} "
    f"({C['frameworks']['ipt']['attribution']})."
)

CRISIS_LINE = C["crisis"]["line_full"]

VOICE_PARAGRAPH = C["voice_paragraph_locked"]


def required_strings_everywhere():
    """
    Values that MUST appear in every public-facing document (compliance +
    website footer). Used by verify.py for consistency checks.
    """
    return [
        C["identity"]["legal_entity"],
        C["identity"]["clinician_with_credentials"],
        f"NPI {C['registry']['npi']}",
    ]


def license_numbers():
    return [l["number"] for l in C["licenses"]]


if __name__ == "__main__":
    # Quick diagnostic: python3 tools/practice_constants.py
    print(f"Legal entity     : {C['identity']['legal_entity']}")
    print(f"Clinician        : {C['identity']['clinician_with_credentials']}")
    print(f"NPI              : {C['registry']['npi']}")
    print(f"License line     : {LICENSE_LINE}")
    print(f"Fees (50/con)    : ${C['fees']['session_50min_price_usd']} / "
          f"{C['fees']['consultation_label']}")
    print(f"Contact          : {C['contact']['email']} | {C['contact']['phone']}")
    print(f"Crisis line      : {CRISIS_LINE}")
