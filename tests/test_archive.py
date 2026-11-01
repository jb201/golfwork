import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('publisher', ROOT / 'scripts' / 'publish_session.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)
SEED = json.loads((ROOT / 'sessions' / '2026-11-01-session-01' / 'session.json').read_text(encoding='utf-8'))
SEED['result'] = None


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'data').mkdir()
        (self.root / 'data' / 'archive.json').write_text(json.dumps({'schemaVersion': 1, 'sessions': []}), encoding='utf-8')
        self.seed = copy.deepcopy(SEED)

    def tearDown(self):
        self.temp.cleanup()

    def bundle(self, session=None):
        return {'schemaVersion': 1, 'session': session or self.seed}

    def result(self, total=120):
        return {'source': 'uploaded-summary', 'sevenTotal': total, 'sevenCarry': 110, 'shotCount': 10, 'totalCount': 10, 'carryCount': 10, 'practiceMinutes': 30, 'playThrough': {'holes': 3, 'notes': ''}, 'notes': ''}

    def test_plan_then_result_and_next_week_roundtrip(self):
        publisher.publish(self.bundle(), self.root)
        self.seed['result'] = self.result()
        publisher.publish(self.bundle(), self.root)
        next_week = copy.deepcopy(self.seed)
        next_week.update(id='2026-11-08-session-02', date='2026-11-08', title='Session 02', result=None)
        next_week['plan']['basedOnSessionId'] = self.seed['id']
        publisher.publish(self.bundle(next_week), self.root)
        self.assertEqual(publisher.validate_archive(self.root), 2)
        stored = json.loads((self.root / 'sessions' / self.seed['id'] / 'session.json').read_text(encoding='utf-8'))
        self.assertEqual(stored['result']['sevenTotal'],120)
        self.assertEqual(stored['plan'], SEED['plan'])

    def test_duplicate_publish_is_idempotent_and_snapshot_cannot_change(self):
        publisher.publish(self.bundle(), self.root)
        publisher.publish(self.bundle(), self.root)
        self.assertEqual(publisher.validate_archive(self.root), 1)
        self.seed['plan']['cue'] = 'different'
        with self.assertRaisesRegex(ValueError, 'immutable'):
            publisher.publish(self.bundle(), self.root)

    def test_result_correction_requires_explicit_flag(self):
        self.seed['result'] = self.result()
        publisher.publish(self.bundle(), self.root)
        self.seed['result']['sevenTotal'] = 125
        with self.assertRaisesRegex(ValueError, 'replace-results'):
            publisher.publish(self.bundle(), self.root)
        publisher.publish(self.bundle(), self.root, replace_results=True)

    def test_unsafe_id_and_missing_source_leave_archive_unchanged(self):
        self.seed['id'] = '../../escape'
        with self.assertRaises(ValueError):
            publisher.publish(self.bundle(), self.root)
        self.seed = copy.deepcopy(SEED)
        self.seed['plan']['basedOnSessionId'] = '2026-10-01-missing'
        with self.assertRaisesRegex(ValueError, 'referenced'):
            publisher.publish(self.bundle(), self.root)
        self.assertEqual(publisher.validate_archive(self.root), 0)

    def test_csv_summary_must_match_normal_shots(self):
        self.seed['result'] = self.result()
        self.seed['result'].update(source='shot-csv', shotCount=1, totalCount=1, carryCount=1, shots=[{'club':'7i','block':'normal','total':120,'carry':110}, {'club':'7i','block':'drill','total':50,'carry':40}])
        publisher.publish(self.bundle(), self.root)
        self.seed['result']['sevenTotal'] = 200
        with self.assertRaisesRegex(ValueError, 'Summary'):
            publisher.publish(self.bundle(), self.root, replace_results=True)


if __name__ == '__main__':
    unittest.main()