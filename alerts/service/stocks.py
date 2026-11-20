"""Read-only market quotes with bounded caching and partial-failure handling."""
import asyncio
import math
import re
import time

import httpx


def parse_chart(symbol, payload):
    chart = payload['chart']['result'][0]
    meta = chart['meta']
    price = float(meta['regularMarketPrice'])
    previous = float(meta.get('chartPreviousClose', meta.get('previousClose', price)))
    if not all(math.isfinite(value) for value in (price, previous)):
        raise ValueError('Invalid quote')
    points = [float(value) if isinstance(value, (float, int)) and math.isfinite(value) else None
              for value in chart['indicators']['quote'][0].get('close', [])]
    return dict(symbol=symbol, name=meta.get('longName') or meta.get('shortName') or symbol,
                price=price, change=price-previous, previous=previous,
                currency=meta.get('currency', 'USD'), timestamp=meta['regularMarketTime'],
                points=points, stale=False, available=True)


class StockQuotes:
    def __init__(self):
        self.cache = {}

    async def quotes(self, symbols):
        symbols = list(dict.fromkeys(symbol.strip().upper() for symbol in symbols.split(',') if symbol.strip()))
        if not 1 <= len(symbols) <= 8 or any(not re.fullmatch(r'[A-Z0-9^][A-Z0-9.^=-]{0,14}', s) for s in symbols):
            raise ValueError('Enter 1–8 ticker symbols, separated by commas.')
        async with httpx.AsyncClient(timeout=8, headers={'User-Agent': 'Mozilla/5.0'}) as client:
            async def quote(symbol):
                now = time.monotonic()
                cached = self.cache.get(symbol)
                if cached and now - cached[0] < 300:
                    return cached[1]
                try:
                    response = await client.get(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}',
                                                params={'interval': '5m', 'range': '1d'})
                    response.raise_for_status()
                    result = parse_chart(symbol, response.json())
                except (httpx.HTTPError, ValueError, TypeError, KeyError, IndexError):
                    result = dict(cached[1], stale=True) if cached else dict(symbol=symbol, available=False)
                if len(self.cache) >= 128 and symbol not in self.cache:
                    self.cache.pop(next(iter(self.cache)))
                self.cache[symbol] = (now, result)
                return result
            return {'source': 'Yahoo Finance', 'quotes': await asyncio.gather(*(quote(s) for s in symbols))}
