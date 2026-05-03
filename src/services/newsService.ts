import { AppError } from "../utils/AppError";
import { yf } from "./yahooFinance";

export type NewsItem = { headline: string; source: string; publishedAt: string; url?: string };

export async function fetchCompanyNews(ticker: string, limit: number): Promise<NewsItem[]> {
  try {
    const results = (await yf.search(ticker, {
      newsCount: limit,
      quotesCount: 0,
    })) as any;

    const dedup = new Map<string, NewsItem>();
    
    for (const item of results.news) {
      // item usually has title, publisher, providerPublishTime, link
      const title = item.title ?? "";
      const source = item.publisher ?? "Yahoo Finance";
      const datetime = item.providerPublishTime instanceof Date 
        ? item.providerPublishTime.getTime() 
        : typeof item.providerPublishTime === 'number' 
          ? item.providerPublishTime * 1000 // if it's epoch seconds
          : Date.now();

      const key = `${source}:${title}`.toLowerCase();
      if (!dedup.has(key) && title) {
        const base: NewsItem = {
          headline: title,
          source,
          publishedAt: new Date(datetime).toISOString(),
        };
        if (item.link) base.url = item.link;
        dedup.set(key, base);
      }
    }

    return Array.from(dedup.values())
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .slice(0, Math.max(1, Math.min(50, limit)));
  } catch (err: unknown) {
    const e = err as Error;
    throw new AppError("Yahoo Finance news request failed", {
      statusCode: 502,
      code: "YF_REQUEST_FAILED",
      details: { ticker, message: e.message ?? String(err) },
    });
  }
}
