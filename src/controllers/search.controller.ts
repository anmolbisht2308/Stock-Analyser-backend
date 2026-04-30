import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { searchSymbols } from "../services/searchService";
import { cacheGetJSON, cacheSetJSON } from "../services/cacheService";

export const searchStocks = asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) throw new AppError("Query required", { statusCode: 400, code: "QUERY_REQUIRED" });

  const cacheKey = `search:${q.toLowerCase()}`;
  const cached = await cacheGetJSON<unknown>(cacheKey);
  if (cached) return res.json(cached);

  const results = await searchSymbols(q);
  const payload = { q, results };
  await cacheSetJSON(cacheKey, payload, 15 * 60);
  res.json(payload);
});

