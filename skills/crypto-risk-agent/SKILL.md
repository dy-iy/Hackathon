---
name: crypto-risk-agent
description: "Use this skill when a user asks OpenClaw, ArkClaw, or Codex to use the CryptoRisk project capabilities: analyze cryptocurrency news or announcements for financial risk, query today's or recent high-risk crypto news, inspect coin/token risk rankings, fetch news or coin details, start/check news update jobs, or explain risk evidence, scores, impact, and mitigation advice from the project's FastAPI multi-agent backend."
---

# Crypto Risk Agent

## Overview

Use the CryptoRisk FastAPI backend through the bundled script instead of reimplementing risk logic. The project analyzes cryptocurrency news, exchange/project announcements, project events, abnormal exchange behavior, and on-chain security incidents with a multi-agent workflow.

Default public API base: `https://kassa-wiki.top`

## Quick Start

Run the script from this skill folder or pass its absolute path:

```bash
python3 scripts/crypto_risk_api.py analyze-news "某 DeFi 项目疑似被攻击，资金池出现异常大额转出，官方尚未发布公告。"
python3 scripts/crypto_risk_api.py high-risk-news --date 24h --limit 10 --min-score 70
python3 scripts/crypto_risk_api.py coins --date 24h --limit 10
python3 scripts/crypto_risk_api.py coin-detail BTC --date 7d
```

Set `CRYPTO_RISK_API_BASE` only when the user explicitly wants another deployment:

```bash
CRYPTO_RISK_API_BASE=https://kassa-wiki.top python3 scripts/crypto_risk_api.py overview --date 24h
```

## Capabilities

### Analyze One News Item

Use `analyze-news` when the user provides a news article, announcement, alert, incident text, rumor, or project/exchange event and asks for risk analysis.

Return or summarize:
- `summary`
- `has_risk`
- `risk_score` or `final_risk_score`
- `risk_level`
- `risk_categories`
- `risk_signals`
- `evidence`
- `impact`
- `advice`
- `confidence_level`

### Query High-Risk News

Use `high-risk-news` when the user asks for today's high-risk news, recent high-risk events, top risky news, or severe crypto alerts.

Prefer `--date 24h` for "today" or "当日"; use `--date 7d` for recent weekly views; use `--date all` only when the user asks for all historical data.

### Query Coin Risk

Use `coins` for ranked token/project risk lists. Use `coin-detail SYMBOL` for a specific symbol such as `BTC`, `ETH`, `SOL`, or `BNB`.

When answering, include the coin symbol, final score, risk level, main risk type, news count, top related news, and short mitigation note when present.

### Update News

Use update commands only if the user explicitly asks to refresh, crawl, or update news. Prefer the async job flow:

```bash
python3 scripts/crypto_risk_api.py start-update
python3 scripts/crypto_risk_api.py update-status
```

Do not start updates casually because the backend may crawl data and run agent scoring.

## Project Constraints

If editing this project, keep frontend requests relative to `/api/xxx`. Do not hardcode `localhost`, `127.0.0.1`, `8000`, `8001`, or `8002` in frontend code.

Do not run these project server commands:
- `uvicorn main:app --reload`
- `npm run dev`
- `npm run build`
- `pm2`

## References

Read `references/api-contracts.md` when endpoint parameters, response fields, or examples are needed.
