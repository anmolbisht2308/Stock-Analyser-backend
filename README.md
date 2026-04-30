# Stock Analysis Backend (Express + TS)

Production-grade API for stock analysis + Groq-powered multibagger predictions.

## Requirements
- Node.js 18+
- MongoDB running locally or a hosted URI
- Redis running locally or a hosted URI
- API keys: Alpha Vantage, Finnhub, FMP, Groq

## Setup
1. Create `.env` from `.env.example`
2. Install deps:

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
```

API listens on `http://localhost:5000` by default.
