from __future__ import annotations

from app.risk_engine.graph import run_risk_graph


def run_v6_risk_engine(message: str) -> dict[str, object]:
    return run_risk_graph(message)
