# Backend API Testing Guide

## Prerequisites
- **Node.js**: 18+
- **MongoDB** running and reachable at `MONGODB_URI`
- **Redis** running and reachable at `REDIS_URL`
- `.env` present in `bigJOD/backend` with **real** keys:
  - `GROQ_API_KEY`, `ALPHA_VANTAGE_KEY`, `FINNHUB_KEY`, `FMP_KEY`

## Start the backend

```bash
cd "/Users/anmolbisht/Documents/bigJOD/backend"
npm install
npm run dev
```

- Base URL: `http://localhost:5000`
- API base: `http://localhost:5000/api`

Quick health check:

```bash
curl -s "http://localhost:5000/health" | jq .
```

## Common notes (important)
- **Alpha Vantage free tier** rate limits are strict. If you hit limits you may see **429** from `/analysis` or `/price-history`.
- **Caching**
  - `/api/stock/:ticker/analysis` cached in Redis for **30 minutes** (`analysis:{TICKER}`)
  - `/api/stock/:ticker/quote` cached for **60 seconds** (`price:{TICKER}`)
  - `/api/stock/:ticker/news` cached for **15 minutes**

## Endpoints

### 1) Search symbols (autocomplete)
**GET** `/api/stock/search?q=AAPL`

```bash
curl -s "http://localhost:5000/api/stock/search?q=AAPL" | jq .
```

**Response**
- `q`: query string
- `results[]`: `{ symbol, description, type }`

---

### 2) Live quote
**GET** `/api/stock/:ticker/quote`

```bash
curl -s "http://localhost:5000/api/stock/AAPL/quote" | jq .
```

**Response**
- `ticker`
- `quote`: `{ currentPrice, change, changePercent }`

---

### 3) News
**GET** `/api/stock/:ticker/news?limit=20`

```bash
curl -s "http://localhost:5000/api/stock/AAPL/news?limit=20" | jq .
```

**Response**
- `ticker`
- `news[]`: `{ headline, source, publishedAt, url? }`

---

### 4) Price history (daily OHLCV)
**GET** `/api/stock/:ticker/price-history`

```bash
curl -s "http://localhost:5000/api/stock/AAPL/price-history" | jq .
```

**Response**
- `ticker`
- `interval`: `"1d"`
- `bars[]`: `{ date, open, high, low, close, volume }`

---

### 5) Full analysis (Groq + computed indicators + fundamentals + news + ratings)
**GET** `/api/stock/:ticker/analysis`

```bash
curl -s "http://localhost:5000/api/stock/AAPL/analysis" | jq .
```

**What it does**
- Checks Redis `analysis:AAPL`
- If cache miss:
  - Finnhub: profile + quote + news + recommendations + price targets
  - Alpha Vantage: daily OHLCV
  - FMP: fundamentals
  - Computes 17 technical indicators locally
  - Calls **Groq** (`llama-3.3-70b-versatile`, fallback: `llama-3.1-8b-instant`)
  - Stores:
    - Redis (TTL 30m)
    - MongoDB `Analysis` document (historical record)

**Response shape**
- `ticker`
- `cached`: boolean
- `cacheTtlSeconds`: number (30m)
- `raw`:
  - `quote`
  - `ohlcv[]`
  - `news[]`
  - `analystRatings[]`
  - `fundamentals`
  - `technicals` (includes RSI/MACD/.../Ichimoku/PSAR/Fib/VolumeSMA)
  - `profile`
- `analysis`: Groq JSON result (scores, probabilities, thesis, strategies, etc.)

## Error responses (all endpoints)
Errors are returned as:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Common `code` values:
- `VALIDATION_ERROR` (bad params/query)
- `ALPHA_VANTAGE_RATE_LIMIT` (429)
- `FINNHUB_BAD_RESPONSE` / `FMP_BAD_RESPONSE` (502)
- `INTERNAL_SERVER_ERROR` (500)

## Recommended test flow (fast)
1. Search: `/api/stock/search?q=AAPL`
2. Quote: `/api/stock/AAPL/quote`
3. Analysis (first call will be slower): `/api/stock/AAPL/analysis`
4. Call analysis again (should be **cached: true** and much faster)

