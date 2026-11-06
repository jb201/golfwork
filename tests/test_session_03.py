import csv
import hashlib
import json
from pathlib import Path
import statistics as st
import unittest

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / 'sessions' / '2026-11-06-session-03'


class Session03Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.session = json.loads((D / 'session.json').read_text(encoding='utf-8'))
        cls.review = json.loads((D / 'review.json').read_text(encoding='utf-8'))
        cls.source = D / cls.review['sources'][0]['path']
        with cls.source.open(encoding='utf-8-sig', newline='') as f:
            cls.rows = sorted(csv.DictReader(f), key=lambda r: r['Shot Time'])

    def test_source_and_correction_preserve_every_shot(self):
        self.assertEqual(len(self.rows), 194)
        self.assertEqual(len({r['Shot Key'] for r in self.rows}), 194)
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(),
                         self.review['sources'][0]['sha256'])
        correction, = self.review['observations']['clubCorrections']
        self.assertEqual(self.rows[0]['Shot Key'], correction['shotKey'])
        self.assertEqual(self.rows[0]['Club Name'], correction['exportedClub'])
        self.assertEqual(correction['actualClub'], 'I7')
        self.assertEqual(self.session['review'], self.review)

    def test_result_is_all_shot_exploratory_not_a_best_shot_average(self):
        seven = self.rows[:161]
        self.assertEqual([r['Club Name'] for r in seven[1:]], ['I7'] * 160)
        result = self.session['result']
        self.assertEqual(result['comparability'], 'exploratory-not-standardized')
        self.assertEqual(result['source'], 'uploaded-summary')
        self.assertEqual(result['shotCount'], 161)
        for field, column in [('sevenCarry', 'Carry Dist (yd)'), ('sevenTotal', 'Total Dist (yd)')]:
            self.assertAlmostEqual(result[field], st.mean(float(r[column]) for r in seven))
        self.assertEqual(sum(float(r['Carry Dist (yd)']) >= 130 for r in seven), 9)
        self.assertEqual(sum(float(r['Carry Dist (yd)']) >= 120 for r in seven), 18)
        self.assertEqual(sum(float(r['Ball Speed (mph)']) >= 95 for r in seven), 10)
        self.assertEqual(sum(float(r['Total Dist (yd)']) >= 145 for r in seven), 5)

    def test_rankings_and_chronological_windows_match_original_export(self):
        for club, picks in self.review['selectedShots'].items():
            group = [r for r in self.rows if r['Club Name'] == club]
            for ranking, column in [('longestCarry', 'Carry Dist (yd)'),
                                    ('fastestBallSpeed', 'Ball Speed (mph)')]:
                expected = sorted(group, key=lambda r: float(r[column]), reverse=True)[:5]
                self.assertEqual([r['Shot Key'] for r in expected],
                                 [r['shotKey'] for r in picks[ranking]])
                for row, pick in zip(expected, picks[ranking]):
                    self.assertEqual(self.rows[pick['chronologicalOrdinal'] - 1]['Shot Key'],
                                     row['Shot Key'])
                    self.assertEqual(pick['peakHeightYd'], float(row['Peak Height (yd)']))
        windows = self.review['sevenIronChronologicalWindows']
        self.assertEqual(sum(w['n'] for w in windows), 160)
        for window in windows:
            group = self.rows[window['chronologicalStart'] - 1:window['chronologicalEnd']]
            self.assertEqual(len(group), 40)
            self.assertTrue(all(r['Club Name'] == 'I7' for r in group))
            self.assertEqual(window['metrics']['peakHeightYd']['mean'],
                             round(st.mean(float(r['Peak Height (yd)']) for r in group), 3))


if __name__ == '__main__':
    unittest.main()
