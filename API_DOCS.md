# Stock Analyser API Documentation

Base URL: `http://localhost:5000`

---

## Health

### `GET /health`
Check if the server is running.

**Response**
```json
{ "ok": true }
```

---

## Stock

### `GET /api/stock/search`
Search for stocks by name or ticker symbol.

**Query Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | ✅ | Search query (e.g. `BAJAJHFL`, `Reliance`, `AAPL`) |

**Example Request**
```
GET /api/stock/search?q=BAJAJHFL.NS
```

**Response**
```json
{
  "q": "BAJAJHFL.NS",
  "results": [
    {
      "symbol": "BAJAJHFL.NS",
      "description": "Bajaj Housing Finance Limited",
      "type": "EQUITY"
    }
  ]
}
```

---

### `GET /api/stock/:ticker/price-history`
Get daily OHLCV price history for a ticker (last ~120 days).

**Path Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `ticker` | string | ✅ | Yahoo Finance ticker (e.g. `BAJAJHFL.NS`, `RELIANCE.NS`, `AAPL`) |

**Example Request**
```
GET /api/stock/BAJAJHFL.NS/price-history
```

**Response**
```json
{
  "ticker": "BAJAJHFL.NS",
  "interval": "1d",
  "bars": [
    {
      "date": "2025-01-02",
      "open": 85.10,
      "high": 87.50,
      "low": 84.30,
      "close": 86.90,
      "volume": 12345678
    }
  ]
}
```

---

### `GET /api/stock/:ticker/news`
Get recent news articles for a ticker.

**Path Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `ticker` | string | ✅ | Yahoo Finance ticker |

**Query Params**
| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `limit` | number | ❌ | `20` | Number of articles (1–50) |

**Example Request**
```
GET /api/stock/BAJAJHFL.NS/news?limit=10
```

**Response**
```json
{
  "ticker": "BAJAJHFL.NS",
  "news": [
    {
      "headline": "Bajaj Housing Finance Q3 results beat estimates",
      "source": "Economic Times",
      "publishedAt": "2025-01-10T08:30:00.000Z",
      "url": "https://economictimes.com/..."
    }
  ]
}
```

---

### `GET /api/stock/:ticker/quote`
Get the live quote for a ticker.

**Path Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `ticker` | string | ✅ | Yahoo Finance ticker |

**Example Request**
```
GET /api/stock/BAJAJHFL.NS/quote
```

**Response**
```json
{
  "ticker": "BAJAJHFL.NS",
  "quote": {
    "currentPrice": 87.15,
    "change": -0.85,
    "changePercent": -0.97
  }
}
```

---

### `GET /api/stock/:ticker/analysis`
Run a full AI-powered analysis on a stock (Groq LLM). Results are cached for 30 minutes.

**Path Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `ticker` | string | ✅ | Yahoo Finance ticker |

**Example Request**
```
GET /api/stock/BAJAJHFL.NS/analysis
```

**Response**
```json
{
  "ticker": "BAJAJHFL.NS",
  "cached": false,
  "cacheTtlSeconds": 1800,
  "raw": {
    "quote": { "currentPrice": 87.15, "change": -0.85, "changePercent": -0.97 },
    "ohlcv": [...],
    "news": [...],
    "analystRatings": [
      { "firm": "Consensus (Yahoo)", "rating": "Buy", "targetPrice": 105.0 }
    ],
    "fundamentals": {
      "peRatio": 24.5,
      "pbRatio": 3.2,
      "roe": 0.14,
      "netMargin": 0.18,
      "marketCap": 73500000000
    },
    "technicals": {
      "rsi14": 52.3,
      "macd": { "macd": 0.45, "signal": 0.32, "histogram": 0.13 }
    },
    "profile": {
      "companyName": "Bajaj Housing Finance Limited",
      "sector": "Financial Services",
      "industry": "Mortgage Finance",
      "exchange": "NSE"
    }
  },
  "analysis": {
    "overallScore": 72,
    "analystRating": "BUY",
    "ratingReason": "Strong fundamentals with healthy ROE and improving margins...",
    "multibaggerProbability": {
      "within1Year": 12,
      "within2Years": 28,
      "within3Years": 45,
      "confidence": "MEDIUM",
      "reasoning": "..."
    },
    "targetProbabilities": {
      "twoX": { "within1Y": 8, "within2Y": 25, "within3Y": 42 },
      "threeX": { "within1Y": 3, "within2Y": 10, "within3Y": 22 },
      "fourX": { "within1Y": 1, "within2Y": 4, "within3Y": 12 }
    },
    "targetPrices": {
      "conservative": 95.0,
      "base": 110.0,
      "optimistic": 135.0,
      "timeHorizon": "12-18 months"
    },
    "technicalSummary": {
      "trend": "UPTREND",
      "momentum": "BULLISH",
      "supportLevels": [82.0, 78.5],
      "resistanceLevels": [92.0, 98.0],
      "keyPatterns": ["Bullish flag", "Higher lows"],
      "technicalScore": 68,
      "signals": [
        { "name": "RSI", "value": "52.3", "interpretation": "NEUTRAL" },
        { "name": "MACD", "value": "Bullish crossover", "interpretation": "BULLISH" }
      ]
    },
    "fundamentalSummary": {
      "valuationStatus": "FAIRLY VALUED",
      "growthOutlook": "STRONG",
      "financialHealth": "GOOD",
      "fundamentalScore": 75,
      "keyStrengths": ["Low NPA ratio", "Strong loan book growth"],
      "keyRisks": ["Interest rate sensitivity", "Housing market slowdown"]
    },
    "newsSentiment": {
      "overall": "POSITIVE",
      "sentimentScore": 35,
      "catalysts": ["RBI rate cut expectations", "Affordable housing push"],
      "risks": ["Rising bond yields"]
    },
    "investmentThesis": "Bajaj Housing Finance is well-positioned...",
    "catalystsForGrowth": ["Rate cuts", "Affordable housing demand"],
    "majorRisks": ["Rising interest rates", "Competition from banks"],
    "comparablePeers": ["HDFC.NS", "LICHSGFIN.NS", "CANFINHOME.NS"],
    "suggestedTimeHorizon": "12-24 months",
    "entryStrategy": "Accumulate on dips near ₹82-85 support zone",
    "exitStrategy": "Partial profits at ₹110; trail stop below ₹95"
  }
}
```

---

## Trending

### `GET /api/trending`
Get the top 20 trending Indian stocks (updated hourly by BullMQ worker).

**Example Request**
```
GET /api/trending
```

**Response**
```json
{
  "source": "cache",
  "market": "IN",
  "fetchedAt": "2025-05-01T22:00:00.000Z",
  "tickers": [
    {
      "symbol": "RELIANCE.NS",
      "name": "Reliance Industries Limited",
      "price": 2854.30,
      "change": 34.50,
      "changePercent": 1.22,
      "volume": 8765432,
      "marketCap": 1932000000000
    }
  ]
}
```

> `source` can be `"cache"` (Redis), `"db"` (MongoDB fallback), or `"empty"` (worker hasn't run yet).

---

## Screener

### `GET /api/screener`
Filter and paginate AI-analysed stocks from MongoDB.

**Query Params**
| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `minScore` | number | ❌ | — | Minimum `overallScore` (0–100) |
| `maxScore` | number | ❌ | — | Maximum `overallScore` (0–100) |
| `rating` | string | ❌ | — | `STRONG BUY` \| `BUY` \| `HOLD` \| `SELL` \| `STRONG SELL` |
| `sector` | string | ❌ | — | Partial match e.g. `Financial` |
| `exchange` | string | ❌ | — | Partial match e.g. `NSE` |
| `sort` | string | ❌ | `overallScore` | `overallScore` \| `createdAt` |
| `order` | string | ❌ | `desc` | `asc` \| `desc` |
| `page` | number | ❌ | `1` | Page number |
| `limit` | number | ❌ | `20` | Results per page (1–100) |

**Example Request**
```
GET /api/screener?minScore=65&rating=BUY&sector=Financial&sort=overallScore&order=desc&limit=10
```

**Response**
```json
{
  "page": 1,
  "limit": 10,
  "total": 42,
  "totalPages": 5,
  "results": [
    {
      "ticker": "BAJAJHFL.NS",
      "createdAt": "2025-05-01T18:00:00.000Z",
      "overallScore": 72,
      "analystRating": "BUY",
      "ratingReason": "Strong fundamentals with healthy ROE...",
      "targetPrices": {
        "conservative": 95.0,
        "base": 110.0,
        "optimistic": 135.0,
        "timeHorizon": "12-18 months"
      },
      "trend": "UPTREND",
      "valuationStatus": "FAIRLY VALUED",
      "sector": "Financial Services",
      "exchange": "NSE",
      "companyName": "Bajaj Housing Finance Limited",
      "currentPrice": 87.15
    }
  ]
}
```

---

## Auth

### `POST /api/auth/register`
Create a new user account.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | string | ✅ | Valid email format |
| `password` | string | ✅ | Minimum 8 characters |

**Response** `201 Created`
```json
{
  "user": {
    "id": "6634abc123...",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST /api/auth/login`
Login with email and password.

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "mypassword123"
}
```

**Response** `200 OK`
```json
{
  "user": {
    "id": "6634abc123...",
    "email": "user@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> **Token lifetimes:** `accessToken` expires in **15 minutes**, `refreshToken` in **7 days**.

---

### `POST /api/auth/refresh`
Exchange a valid refresh token for a new access token.

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** `200 OK`
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST /api/auth/logout`
Revoke a refresh token (blacklisted in Redis for 7 days).

**Request Body**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** `200 OK`
```json
{ "ok": true }
```

---

## Watchlist

> **All watchlist endpoints require authentication.**
> Include the access token in the `Authorization` header:
> ```
> Authorization: Bearer <accessToken>
> ```

---

### `GET /api/watchlist`
Get the authenticated user's watchlist with live quotes.

**Example Request**
```
GET /api/watchlist
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** `200 OK`
```json
{
  "watchlist": [
    {
      "symbol": "BAJAJHFL.NS",
      "addedAt": "2025-05-01T10:00:00.000Z",
      "quote": {
        "price": 87.15,
        "change": -0.85,
        "changePercent": -0.97,
        "name": "Bajaj Housing Finance Limited"
      }
    },
    {
      "symbol": "RELIANCE.NS",
      "addedAt": "2025-04-28T14:30:00.000Z",
      "quote": {
        "price": 2854.30,
        "change": 34.50,
        "changePercent": 1.22,
        "name": "Reliance Industries Limited"
      }
    }
  ]
}
```

---

### `POST /api/watchlist`
Add a stock symbol to the watchlist (validates ticker exists on Yahoo Finance).

**Request Body**
```json
{
  "symbol": "BAJAJHFL.NS"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `symbol` | string | ✅ | Yahoo Finance ticker. Auto-uppercased. Max 50 symbols per user. |

**Response** `201 Created`
```json
{
  "ok": true,
  "symbol": "BAJAJHFL.NS",
  "watchlistCount": 3
}
```

---

### `DELETE /api/watchlist/:symbol`
Remove a stock symbol from the watchlist.

**Path Params**
| Param | Type | Required | Description |
|---|---|---|---|
| `symbol` | string | ✅ | Ticker to remove (e.g. `BAJAJHFL.NS`) |

**Example Request**
```
DELETE /api/watchlist/BAJAJHFL.NS
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** `200 OK`
```json
{
  "ok": true,
  "symbol": "BAJAJHFL.NS",
  "watchlistCount": 2
}
```

---

## Error Format

All errors follow this consistent structure:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials",
    "details": null
  }
}
```

### Common Error Codes

| Code | Status | Description |
|---|---|---|
| `TICKER_REQUIRED` | 400 | Missing ticker in path |
| `QUERY_REQUIRED` | 400 | Missing `q` search param |
| `INVALID_EMAIL` | 400 | Email format invalid |
| `INVALID_PASSWORD` | 400 | Password too short |
| `MISSING_CREDENTIALS` | 400 | Email or password missing |
| `MISSING_SYMBOL` | 400 | Symbol not provided |
| `WATCHLIST_LIMIT_REACHED` | 400 | User has 50 symbols already |
| `MISSING_AUTH_HEADER` | 401 | No `Authorization` header |
| `INVALID_ACCESS_TOKEN` | 401 | Token expired or invalid |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token invalid |
| `REVOKED_REFRESH_TOKEN` | 401 | Refresh token was logged out |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `SYMBOL_NOT_FOUND` | 404 | Ticker not found on Yahoo Finance |
| `USER_NOT_FOUND` | 404 | User ID from token not in DB |
| `SYMBOL_NOT_IN_WATCHLIST` | 404 | Symbol not in user's watchlist |
| `EMAIL_TAKEN` | 409 | Email already registered |
| `SYMBOL_ALREADY_IN_WATCHLIST` | 409 | Symbol already added |
| `YF_REQUEST_FAILED` | 502 | Yahoo Finance API error |
| `INSUFFICIENT_OHLCV` | 502 | Not enough price history |
| `GROQ_RATE_LIMIT` | 429 | Groq LLM rate limited |
