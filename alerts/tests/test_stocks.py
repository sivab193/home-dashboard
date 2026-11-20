import unittest
from unittest.mock import AsyncMock, Mock, patch

from service.stocks import StockQuotes, parse_chart


def payload():
    return {'chart': {'result': [{'meta': {'regularMarketPrice': 105, 'chartPreviousClose': 100,
                                          'regularMarketTime': 12345, 'currency': 'USD'},
                                  'indicators': {'quote': [{'close': [100, None, 105]}]}}]}}


class StockTests(unittest.IsolatedAsyncioTestCase):
    def test_daily_change_and_gaps(self):
        quote = parse_chart('TEST', payload())
        self.assertEqual(quote['change'], 5)
        self.assertEqual(quote['points'], [100, None, 105])

    async def test_invalid_input_never_fetches(self):
        with self.assertRaises(ValueError):
            await StockQuotes().quotes('../../etc/passwd')

    async def test_cache_and_stale_fallback(self):
        service = StockQuotes()
        response = Mock()
        response.json.return_value = payload()
        with patch('service.stocks.httpx.AsyncClient.get', new_callable=AsyncMock) as get:
            get.return_value = response
            await service.quotes('TEST')
            await service.quotes('TEST')
            self.assertEqual(get.await_count, 1)
            service.cache['TEST'] = (-1000, service.cache['TEST'][1])
            get.side_effect = ValueError('broken response')
            result = await service.quotes('TEST,UNKNOWN')
            self.assertTrue(result['quotes'][0]['stale'])
            self.assertFalse(result['quotes'][1]['available'])
