# Data Sources & Third-Party Services

This document outlines the external services and APIs powering the Stock Analyser backend.

## 1. Market Data (Yahoo Finance)

**Package Used:** `yahoo-finance2` (NPM)
**API Keys Required:** None (It operates by scraping public Yahoo Finance endpoints)
**Rate Limits:** High, but not strictly defined. Handled by internal package retries.

The following data points are sourced entirely from **Yahoo Finance**:

*   **News:** (`yf.search` / `yf.quoteSummary`) - Recent articles and press releases for a specific ticker.
*   **Price History (OHLCV):** (`yf.chart`) - Daily historical Open, High, Low, Close, and Volume data.
*   **Live Quotes:** (`yf.quote`) - Real-time or delayed current prices, changes, and market cap.
*   **Trending Tickers:** (`yf.trendingSymbols`) - The top 20 trending stocks in a specific market (e.g., "IN" for India).
*   **Company Profile:** (`yf.quoteSummary` -> `assetProfile`) - Sector, industry, and company description.
*   **Fundamentals:** (`yf.quoteSummary` -> `defaultKeyStatistics`, `financialData`) - PE ratio, PB ratio, ROE, margins.
*   **Analyst Estimates:** (`yf.quoteSummary` -> `recommendationTrend`, `financialData`) - Consensus ratings (Buy/Hold/Sell) and target prices.
*   **Search/Lookup:** (`yf.search`) - Converting human-readable names (e.g., "Reliance") to ticker symbols (e.g., "RELIANCE.NS").

> [!NOTE]
> Previously, the system used Alpha Vantage, Finnhub, and Financial Modeling Prep (FMP) for this data. These were entirely replaced by `yahoo-finance2` to natively support global and Indian stock exchanges (NSE/BSE) without restrictive free-tier paywalls.

---

## 2. Artificial Intelligence (Groq)

**Package Used:** `openai` (configured to point to Groq's base URL)
**API Keys Required:** Yes (`GROQ_API_KEY`)
**Model Used:** `llama-3.3-70b-versatile` (Fallback: `llama-3.1-8b-instant`)

The AI service is strictly used for the **Analysis generation**. 

1. We gather all the raw data (Price History, Fundamentals, News, Technicals) from Yahoo Finance.
2. We feed that data into the Groq LLM using a strict JSON schema prompt.
3. Groq acts as a quantitative analyst and returns the generated scores, targets, technical summaries, and investment thesis.

*(Note: Token usage for Groq is tracked and logged to MongoDB in the `TokenUsageLog` collection).*
