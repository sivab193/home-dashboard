import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSymbols, parseYahooChart, StockQuotesService } from "./stocks.ts";

test("normalizeSymbols deduplicates and validates ticker symbols", () => {
  assert.deepEqual(normalizeSymbols("aapl, nvda, AAPL, ^GSPC"), ["AAPL", "NVDA", "^GSPC"]);
  assert.throws(() => normalizeSymbols(""), /1–8 ticker symbols/);
  assert.throws(() => normalizeSymbols("A,B,C,D,E,F,G,H,I"), /1–8 ticker symbols/);
  assert.throws(() => normalizeSymbols("BAD SYMBOL!"), /1–8 ticker symbols/);
});

test("parseYahooChart extracts price, delta, and intraday points", () => {
  const parsed = parseYahooChart("AAPL", {
    chart: {
      result: [
        {
          meta: {
            longName: "Apple Inc.",
            regularMarketPrice: 230.5,
            chartPreviousClose: 225.0,
            currency: "USD",
            regularMarketTime: 1700000000,
          },
          indicators: {
            quote: [{ close: [226.1, null, 230.5] }],
          },
        },
      ],
    },
  });
  assert.equal(parsed.available, true);
  assert.equal(parsed.price, 230.5);
  assert.equal(parsed.change, 5.5);
  assert.deepEqual(parsed.points, [226.1, null, 230.5]);
});

test("StockQuotesService caches quotes and serves stale quote on upstream failure", async () => {
  let calls = 0;
  const mockFetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  shortName: "NVIDIA",
                  regularMarketPrice: 140,
                  chartPreviousClose: 135,
                  currency: "USD",
                  regularMarketTime: 1700000000,
                },
                indicators: { quote: [{ close: [136, 140] }] },
              },
            ],
          },
        }),
        { status: 200 }
      );
    }
    return new Response("upstream down", { status: 503 });
  }) as unknown as typeof fetch;

  const service = new StockQuotesService(mockFetch);
  const first = await service.quotes("NVDA", 1000);
  assert.equal(first.quotes[0].available, true);
  assert.equal(first.quotes[0].stale, false);

  // Within TTL -> cached without refetching
  await service.quotes("NVDA", 50_000);
  assert.equal(calls, 1);

  // After TTL with upstream error -> returns stale cached quote
  const stale = await service.quotes("NVDA", 400_000);
  assert.equal(calls, 2);
  assert.equal(stale.quotes[0].stale, true);
  assert.equal(stale.quotes[0].price, 140);
});
