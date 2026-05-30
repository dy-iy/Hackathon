from __future__ import annotations

import json

from app.agents.chat_agent.schemas import RiskCaseInput, SignalScanResult
from app.agents.chat_agent.tools.risk_scanner import RISK_NAME_MAP


def build_low_risk_gate_prompt(
    case_input: RiskCaseInput,
    signal_scan: SignalScanResult,
    current_route: str = "low_risk_path",
) -> str:
    risk_type_stats = signal_scan.debug.get("risk_type_stats", [])
    high_risk_route = signal_scan.debug.get("high_risk_route", {})
    payload = {
        "text": case_input.content or case_input.raw_text,
        "input_type": case_input.input_type,
        "entities": case_input.entities,
        "current_route": current_route,
        "current_risk_score": max(
            (int(round(float(score) * 100)) for score in signal_scan.raw_rule_scores.values()),
            default=0,
        ),
        "route_rule": {
            "direct_high_risk": [
                "score_hack",
                "score_fraud",
                "score_outage",
                "score_stablecoin",
                "score_solvency",
                "score_team",
                "score_infra",
            ],
            "threshold_high_risk": [
                "score_whale",
                "score_volatility",
                "score_macro",
                "score_liquidation",
                "score_regulatory",
            ],
            "threshold_condition": "score > 40 才进入高风险 path",
        },
        "risk_type_stats": risk_type_stats,
        "raw_rule_scores": signal_scan.raw_rule_scores,
        "high_risk_route": high_risk_route,
    }
    allowed_types = "\n".join(f"- {risk_type}: {risk_name}" for risk_type, risk_name in RISK_NAME_MAP.items())
    compact_payload = json.dumps(payload, ensure_ascii=False, indent=2)
    return f"""
你是 CryptoRisk 的风险路由门控 Agent。你的任务是对规则扫描器结果做全量复核：
1. 审核文本是否被错误地放入低风险 path。
2. 对全部 12 类 risk_type 做轻量复核，检查规则是否漏判、误判或分数明显偏差。

只允许使用以下 12 类 risk_type：
{allowed_types}

审核要求：
1. 结合原文、当前 risk_type 和 risk_score，判断“继续低风险 path”是否合理。
2. 如果文本明确命中 direct_high_risk 组中的任一风险类型，即使规则分很低，也应输出 escalate_to_high_risk=true。
3. 如果文本命中 threshold_high_risk 组，且你认为真实风险分应大于 40，应输出 escalate_to_high_risk=true。
4. 如果规则漏掉了 risk_type，请在 added_risk_types 中补充，并在 corrected_scores 中给出 0-100 的修正分。
5. 如果规则误命中了 risk_type，请在 suppressed_risk_types 中标记，并在 corrected_scores 中给出较低修正分。
6. confirmed_risk_types 只填写原文证据较明确、值得进入后续分支审核的风险类型。
7. 不要因为普通行情、观点、传闻、无损失维护、内部归集而轻易升级。
8. 必须严格输出 JSON，不要输出 Markdown。

JSON 格式：
{{
  "low_risk_confirmed": true,
  "escalate_to_high_risk": false,
  "confirmed_risk_types": ["score_whale"],
  "reviewed_primary_risk_type": "score_whale",
  "reviewed_risk_score": 35,
  "added_risk_types": [],
  "suppressed_risk_types": [],
  "corrected_scores": {{}},
  "reason": "一句话说明审核理由"
}}

待审核输入：
{compact_payload}
""".strip()
