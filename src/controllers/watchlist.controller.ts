import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { UserModel } from "../models/User.model";
import { yf } from "../services/yahooFinance";

// GET /api/watchlist
export const getWatchlist = asyncHandler(async (req, res) => {
  const userId = req.userId!;

  const user = await UserModel.findById(userId, { watchlist: 1 }).lean();
  if (!user) throw new AppError("User not found", { statusCode: 404, code: "USER_NOT_FOUND" });

  const symbols = user.watchlist.map((w) => w.symbol);

  // Fetch live quotes for all symbols in parallel
  const quoteResults = await Promise.allSettled(symbols.map((sym) => yf.quote(sym)));

  const items = user.watchlist.map((w, i) => {
    const result = quoteResults[i];
    const q = result?.status === "fulfilled" ? result.value : null;
    return {
      symbol: w.symbol,
      addedAt: w.addedAt,
      quote: q
        ? {
            price: q.regularMarketPrice ?? 0,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            name: q.longName || q.shortName || w.symbol,
          }
        : null,
    };
  });

  res.json({ watchlist: items });
});

// POST /api/watchlist
export const addToWatchlist = asyncHandler(async (req, res) => {
  const userId = req.userId!;
  const { symbol } = req.body as { symbol?: string };

  if (!symbol || typeof symbol !== "string" || symbol.trim().length === 0) {
    throw new AppError("symbol is required", { statusCode: 400, code: "MISSING_SYMBOL" });
  }

  const normalizedSymbol = symbol.trim().toUpperCase();

  // Check that ticker actually exists on Yahoo Finance
  try {
    await yf.quote(normalizedSymbol);
  } catch {
    throw new AppError(`Symbol "${normalizedSymbol}" not found`, { statusCode: 404, code: "SYMBOL_NOT_FOUND" });
  }

  const user = await UserModel.findById(userId);
  if (!user) throw new AppError("User not found", { statusCode: 404, code: "USER_NOT_FOUND" });

  const alreadyExists = user.watchlist.some((w) => w.symbol === normalizedSymbol);
  if (alreadyExists) {
    throw new AppError(`${normalizedSymbol} is already in your watchlist`, { statusCode: 409, code: "SYMBOL_ALREADY_IN_WATCHLIST" });
  }

  if (user.watchlist.length >= 50) {
    throw new AppError("Watchlist limit of 50 symbols reached", { statusCode: 400, code: "WATCHLIST_LIMIT_REACHED" });
  }

  user.watchlist.push({ symbol: normalizedSymbol, addedAt: new Date() });
  await user.save();

  res.status(201).json({ ok: true, symbol: normalizedSymbol, watchlistCount: user.watchlist.length });
});

// DELETE /api/watchlist/:symbol
export const removeFromWatchlist = asyncHandler(async (req, res) => {
  const userId = req.userId!;
  const symbol = String(req.params.symbol ?? "").trim().toUpperCase();

  if (!symbol) throw new AppError("symbol is required", { statusCode: 400, code: "MISSING_SYMBOL" });

  const user = await UserModel.findById(userId);
  if (!user) throw new AppError("User not found", { statusCode: 404, code: "USER_NOT_FOUND" });

  const prevLen = user.watchlist.length;
  user.watchlist = user.watchlist.filter((w) => w.symbol !== symbol) as typeof user.watchlist;

  if (user.watchlist.length === prevLen) {
    throw new AppError(`${symbol} not found in watchlist`, { statusCode: 404, code: "SYMBOL_NOT_IN_WATCHLIST" });
  }

  await user.save();
  res.json({ ok: true, symbol, watchlistCount: user.watchlist.length });
});
