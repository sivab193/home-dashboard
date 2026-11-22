export interface StockQuote {
  symbol: string;
  available: boolean;
  name?: string;
  price?: number;
  change?: number;
  previous?: number;
  currency?: string;
  timestamp?: number;
  points?: Array<number | null>;
  stale?: boolean;
}

const SYMBOL_PATTERN = /^[A-Z0-9^][A-Z0-9.^=-]{0,14}$/;
const CACHE_TTL_MS = 300_000;
const MAX_CACHE_ENTRIES = 128;

export function parseYahooChart(symbol: string, payload: unknown): StockQuote {
  const root = payload as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          previousClose?: number;
          longName?: string;
          shortName?: string;
          currency?: string;
          regularMarketTime?: number;
        };
        indicators?: {
          quote?: Array<{ close?: Array<number | null> }>;
        };
      }>;
    };
  };
  const chart = root?.chart?.result?.[0];
  const meta = chart?.meta;
  if (!chart || !meta || meta.regularMarketPrice === undefined || meta.regularMarketTime === undefined) {
    throw new Error("Invalid quote");
  }
  const price = Number(meta.regularMarketPrice);
  const previous = Number(meta.chartPreviousClose ?? meta.previousClose ?? price);
  if (!Number.isFinite(price) || !Number.isFinite(previous)) {
    throw new Error("Invalid quote");
  }
  const closes = chart.indicators?.quote?.[0]?.close ?? [];
  const points = closes.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null
  );
  return {
    symbol,
    name: meta.longName || meta.shortName || symbol,
    price,
    change: price - previous,
    previous,
    currency: meta.currency || "USD",
    timestamp: meta.regularMarketTime,
    points,
    stale: false,
    available: true,
  };
}

export function normalizeSymbols(rawSymbols: string): string[] {
  const list = [
    ...new Set(
      String(rawSymbols || "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  if (list.length < 1 || list.length > 8 || list.some((s) => !SYMBOL_PATTERN.test(s))) {
    throw new Error("Enter 1–8 ticker symbols, separated by commas.");
  }
  return list;
}

export class StockQuotesService {
  private cache = new Map<string, { fetchedAt: number; quote: StockQuote }>();
  private fetcher: typeof fetch;

  constructor(fetcher: typeof fetch = fetch) {
    this.fetcher = fetcher;
  }

  async quotes(rawSymbols: string, now = Date.now()): Promise<{ source: string; quotes: StockQuote[] }> {
    const symbols = normalizeSymbols(rawSymbols);
    const results = await Promise.all(symbols.map((symbol) => this.fetchOne(symbol, now)));
    return { source: "Yahoo Finance", quotes: results };
  }

  private async fetchOne(symbol: string, now: number): Promise<StockQuote> {
    const cached = this.cache.get(symbol);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.quote;
    }

    let result: StockQuote;
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?interval=5m&range=1d`;
      const response = await this.fetcher(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      result = parseYahooChart(symbol, await response.json());
    } catch {
      result = cached ? { ...cached.quote, stale: true } : { symbol, available: false };
    }

    if (this.cache.size >= MAX_CACHE_ENTRIES && !this.cache.has(symbol)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(symbol, { fetchedAt: now, quote: result });
    return result;
  }
}
