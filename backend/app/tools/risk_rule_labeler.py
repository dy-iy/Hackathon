from __future__ import annotations

from typing import Any

from app.tools.risk_score_and_risk_type_labeler import score_all_risks as _score_all_risks


def score_all_risks(text: str) -> dict[str, Any]:
    return _score_all_risks(text)
