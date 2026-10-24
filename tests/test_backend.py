"""Portable offline tests. FastAPI is stubbed only for route decoration."""
import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

fastapi = types.ModuleType('fastapi')
class Router:
    def get(self, *args, **kwargs):
        return lambda fn: fn
fastapi.APIRouter = Router
fastapi.Query = lambda default, **kwargs: default
spec = importlib.util.spec_from_file_location('calendar_backend', Path(__file__).parents[1]/'dashboard/plugin_api.py')
backend = importlib.util.module_from_spec(spec)
with patch.dict(sys.modules, {'fastapi': fastapi}):
    spec.loader.exec_module(backend)

class CalendarTests(unittest.TestCase):
    def test_all_day_flattened(self):
        event = backend._normalise({'id':'synthetic-1','summary':'示例事项','start':'2026-10-30','end':'2026-10-31'})
        self.assertTrue(event['all_day'])
        self.assertEqual(event['end'], '2026-10-31')
    def test_nested_timed(self):
        event = backend._normalise({'start':{'dateTime':'2026-10-26T08:00:00+08:00'},'end':{'dateTime':'2026-10-26T09:00:00+08:00'}})
        self.assertFalse(event['all_day'])
        self.assertEqual(event['summary'], '(无标题)')
    def test_cache_and_read_only_source(self):
        backend._cache.clear()
        items = [{'id':'synthetic-2','summary':'示例课程','start':'2026-10-26T08:00:00+08:00','end':'2026-10-26T09:00:00+08:00'}]
        with patch.object(backend, '_run_calendar_list', return_value=items) as query:
            first = asyncio.run(backend.agenda(days=14, calendar='primary'))
            second = asyncio.run(backend.agenda(days=14, calendar='primary'))
        self.assertFalse(first['cached'])
        self.assertTrue(second['cached'])
        self.assertEqual(query.call_count, 1)
        self.assertEqual(first['items'][0]['summary'], '示例课程')
    def test_network_error_is_returned_as_error_card(self):
        backend._cache.clear()
        with patch.object(backend, '_run_calendar_list', side_effect=TimeoutError('synthetic timeout')):
            result = asyncio.run(backend.agenda(days=14, calendar='primary'))
        self.assertIn('error', result)
        self.assertEqual(result['items'], [])

if __name__ == '__main__':
    unittest.main()
