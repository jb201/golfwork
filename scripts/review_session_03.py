"""Reproduce the November 6 review; optionally record its exploratory summary."""
import argparse
import copy
import csv
from datetime import datetime
import hashlib
import itertools
import json
import math
import re
import statistics as st

from publish_session import ROOT, publish

D = ROOT / 'sessions' / '2026-11-06-session-03'
SOURCE = D / 'sources' / 'PlayerShots_2026-11-06_15-21.csv'
OBSERVATIONS = D / 'notes' / 'observations.json'
ANALYSIS = D / 'notes' / 'analysis.json'


def number(value):
    match = re.match(r'^(-?\d+(?:\.\d+)?)', value)
    if not match:
        raise ValueError(f'Invalid numeric measurement: {value!r}')
    result = float(match.group())
    if not math.isfinite(result):
        raise ValueError(f'Non-finite measurement: {value!r}')
    return result


def clock(row):
    value = row['Shot Time']
    if not (value.startswith('="') and value.endswith('"')):
        raise ValueError(f'Unexpected shot time: {value!r}')
    return datetime.strptime(value[2:-1], '%H:%M:%S.%f')


def distribution(values):
    return {
        'n': len(values), 'mean': round(st.mean(values), 3),
        'median': round(st.median(values), 3),
        'sampleSd': round(st.stdev(values), 3) if len(values) > 1 else None,
        'min': min(values), 'max': max(values),
    }


def summary(rows):
    paths = [r['Club Path'] for r in rows]
    offline = [number(r['Offline (yd)']) for r in rows]
    result = {
        'n': len(rows),
        'firstShotTime': clock(rows[0]).strftime('%H:%M:%S.%f')[:-3],
        'lastShotTime': clock(rows[-1]).strftime('%H:%M:%S.%f')[:-3],
        'metrics': {
            name: distribution([number(r[column]) for r in rows])
            for name, column in (
                ('carryYd', 'Carry Dist (yd)'), ('totalYd', 'Total Dist (yd)'),
                ('ballSpeedMph', 'Ball Speed (mph)'), ('launchDeg', 'VLA'),
                ('peakHeightYd', 'Peak Height (yd)'),
                ('descentDeg', 'Desc Angle'), ('backSpinRpm', 'Back Spin'),
            )
        },
        'reportedPath': {
            'outsideInCount': sum('O-I' in p for p in paths),
            'insideOutCount': sum('I-O' in p for p in paths),
            'zeroUnqualifiedCount': sum(number(p) == 0 and 'O-I' not in p and 'I-O' not in p for p in paths),
            'meanAbsoluteDegIncludingZeros': round(st.mean(abs(number(p)) for p in paths), 3),
        },
        'offline': {
            'meanAbsoluteYd': round(st.mean(abs(v) for v in offline), 3),
            'within10YdCount': sum(abs(v) <= 10 for v in offline),
            'within20YdCount': sum(abs(v) <= 20 for v in offline),
            'leftCount': sum(r['Offline (yd)'].endswith(' L') for r in rows),
            'rightCount': sum(r['Offline (yd)'].endswith(' R') for r in rows),
        },
        'launchBelow10DegCount': sum(number(r['VLA']) < 10 for r in rows),
        'negativeBackSpinCount': sum(number(r['Back Spin']) < 0 for r in rows),
    }
    result['metrics']['totalMinusCarryYd'] = distribution([
        number(r['Total Dist (yd)']) - number(r['Carry Dist (yd)']) for r in rows
    ])
    return result


def build(record=False):
    with SOURCE.open(encoding='utf-8-sig', newline='') as f:
        rows = sorted(csv.DictReader(f), key=clock)
    if len(rows) != 194 or len({r['Shot Key'] for r in rows}) != 194:
        raise ValueError('Expected 194 unique recorded shots')
    if {r['Round Date'] for r in rows} != {'Friday, Nov 06, 2026 (13:44)'}:
        raise ValueError('Unexpected session date')
    groups = {club: [r for r in rows if r['Club Name'] == club]
              for club in dict.fromkeys(r['Club Name'] for r in rows)}
    if {club: len(group) for club, group in groups.items()} != {'DR': 1, 'I7': 160, 'I9': 33}:
        raise ValueError('Unexpected club-label counts')
    observations = json.loads(OBSERVATIONS.read_text(encoding='utf-8'))
    analysis = json.loads(ANALYSIS.read_text(encoding='utf-8'))
    actual_rows = {r['Shot Key']: dict(r) for r in rows}
    for correction in observations['clubCorrections']:
        row = actual_rows[correction['shotKey']]
        if row['Club Name'] != correction['exportedClub']:
            raise ValueError('Club correction does not match original label')
        row['Club Name'] = correction['actualClub']
    actual_groups = {
        club: [r for r in actual_rows.values() if r['Club Name'] == club]
        for club in dict.fromkeys(r['Club Name'] for r in actual_rows.values())
    }
    if {club: len(group) for club, group in actual_groups.items()} != {'I7': 161, 'I9': 33}:
        raise ValueError('Unexpected corrected club counts')
    ordinals = {r['Shot Key']: i for i, r in enumerate(rows, 1)}

    def shot(row):
        return {
            'shotKey': row['Shot Key'], 'chronologicalOrdinal': ordinals[row['Shot Key']],
            'shotTime': clock(row).strftime('%H:%M:%S.%f')[:-3],
            'actualClub': row['Club Name'],
            'exportedClub': rows[ordinals[row['Shot Key']] - 1]['Club Name'],
            **{name: number(row[column]) for name, column in (
                ('carryYd', 'Carry Dist (yd)'), ('totalYd', 'Total Dist (yd)'),
                ('ballSpeedMph', 'Ball Speed (mph)'), ('peakHeightYd', 'Peak Height (yd)'),
                ('launchDeg', 'VLA'), ('descentDeg', 'Desc Angle'),
            )},
            'offline': row['Offline (yd)'], 'reportedPath': row['Club Path'],
            'reportedFaceToPath': row['Face to Path'],
        }

    runs = []
    for club, run in itertools.groupby(enumerate(rows, 1), key=lambda item: item[1]['Club Name']):
        run = list(run)
        runs.append({'clubLabel': club, 'chronologicalStart': run[0][0],
                     'chronologicalEnd': run[-1][0], **summary([r for _, r in run])})
    review = {
        'title': 'November 6 swing exploration - provisional data review',
        'status': 'Player observations saved; club correction applied; exact experiment boundaries pending',
        'date': '2026-11-06',
        'sources': [{'path': 'sources/' + SOURCE.name, 'rows': len(rows),
                     'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest()}],
        'method': [
            'Sort by Shot Time ascending; the export is reverse chronological.',
            'Chronological ordinals are reconstructed row positions, not device shot numbers.',
            'Keep every recorded shot and all mishits; apply the player-confirmed DR-to-I7 correction without modifying the original export.',
            'Club summaries use corrected actual clubs; exported label summaries and runs are retained separately for audit.',
            'Divide the 160 originally I7-labeled shots into four consecutive 40-shot windows solely to describe chronology, not experiment boundaries. The initial corrected I7 is included in the overall 161-shot summary but not these windows.',
            'Selected shots are the top five per actual club by carry and separately by ball speed, with descending ranking and chronological tie order. No shots are removed from session averages.',
            'Distances are yards. Standard deviations are sample standard deviations.',
            'Offline is reported endpoint distance from the device target line, not carry-only dispersion.',
            'All corrected I7 shots form an exploratory aggregate with unclassified shot purposes, not a normal-block benchmark. Selected shots never replace the all-shot result.',
        ],
        'observations': observations,
        **analysis,
        'clubSummaries': {club: summary(group) for club, group in actual_groups.items()},
        'exportedClubSummaries': {club: summary(group) for club, group in groups.items()},
        'chronologicalClubRuns': runs,
        'selectedShots': {
            club: {
                name: [shot(r) for r in sorted(group, key=lambda r: number(r[column]), reverse=True)[:5]]
                for name, column in [('longestCarry', 'Carry Dist (yd)'), ('fastestBallSpeed', 'Ball Speed (mph)')]
            }
            for club, group in actual_groups.items()
        },
        'sevenIronChronologicalWindows': [
            {'exportedSevenIronStart': start + 1, 'exportedSevenIronEnd': start + 40,
             'chronologicalStart': start + 2, 'chronologicalEnd': start + 41,
             **summary(groups['I7'][start:start + 40])}
            for start in range(0, 160, 40)
        ],
        'limitations': [
            'The initial DR label is confirmed as I7; no other label corrections were supplied. Device, handedness, alignment and exact change boundaries remain unconfirmed.',
            'Course, hole and shot-number fields are blank; do not infer play-through, scores or missing swings.',
            'Club speed, smash factor, club lie, impact speed, impact location and closure rate are zero throughout; do not interpret as usable tracking evidence.',
            'Unqualified zero path readings are not proof of neutral delivery. Negative backspin readings need device/context verification and are retained, not silently corrected.',
            'Low launch and large total-minus-carry values can inflate total distance; they do not prove a thin strike or a successful swing.',
            'Path fields describe reported club delivery, not body sequencing, foot pressure or an over-the-top diagnosis.',
            'Different club labels and unlabeled experiments are not directly comparable benchmarks; no causal or lasting-improvement claim is supported yet.',
        ],
        'findings': [
            'The longest-carry I7 shots are genuinely airborne in the export, with substantial peak height and descent angle rather than extreme simulated runout.',
            'The fastest I9 and longest-total I9 are low-launch runners, not the longest carries. Separate speed from useful iron flight.',
            'The selected longest-carry shots still report outside-in path; improved distance does not establish a path or pelvic-rotation correction.',
            'The wait/float feel is a candidate for further comparison, not a demonstrated cause: setup, takeaway intention and effort also changed, and no precise shot boundaries are supplied.',
        ],
        'nextDiscussion': [
            'Approximately when did the wait/float feel begin, and was it also used with I9?',
            'Upload selected-shot video or the swing-analysis report if available for independent rotation/plane review.',
            'Confirm device, handedness and any settings or target changes.',
        ],
    }
    zero_columns = ['Club Speed (mph)', 'Smash Factor', 'Club Lie', 'Speed at Impact',
                    'Vertical Impact', 'Horizontal Impact', 'Closure Rate']
    if any(any(number(r[column]) != 0 for r in rows) for column in zero_columns):
        raise ValueError('Tracking-availability caveat no longer matches the source')
    (D / 'review.json').write_text(json.dumps(review, indent=2) + '\n', encoding='utf-8')
    if record:
        intended_id = '2026-11-02-session-02'
        intended = json.loads((ROOT / 'sessions' / intended_id / 'session.json').read_text(encoding='utf-8'))
        seven = actual_groups['I7']
        session = {
            'schemaVersion': 1, 'id': D.name, 'date': '2026-11-06',
            'title': 'Session 2 -- revamped, did not follow plan',
            'intendedPlanSessionId': intended_id,
            'plan': copy.deepcopy(intended['plan']),
            'review': review,
            'result': {
                'recordedAt': '2026-11-06', 'source': 'uploaded-summary',
                'sevenCarry': st.mean(number(r['Carry Dist (yd)']) for r in seven),
                'sevenTotal': st.mean(number(r['Total Dist (yd)']) for r in seven),
                'shotCount': len(seven), 'carryCount': len(seven), 'totalCount': len(seven),
                'practiceMinutes': None,
                'comparability': 'exploratory-not-standardized',
                'sampleLabel': 'All exploratory 7i shots; purposes unclassified',
                'notes': 'Original Session 02 plan not followed. All 161 actual 7i shots retained, including the DR-labeled 7i and mishits. Mixed feels and effort; no normal/drill boundaries supplied. Long-shot selections are review examples, not the progress average. 33 I9 shots are reviewed separately.',
                'playThrough': {'holes': 0, 'notes': 'No play-through holes or shot classifications supplied; zero here means not supplied, not a confirmed zero-hole session.'},
            },
        }
        publish({'schemaVersion': 1, 'session': session})
        print('Recorded exploratory session in the archive; no Git commit or push performed.')
    print('Saved review:', D / 'review.json')
    for club, group in review['clubSummaries'].items():
        print(club, 'shots:', group['n'], 'mean carry:', group['metrics']['carryYd']['mean'],
              'mean total:', group['metrics']['totalYd']['mean'])
        for row in review['selectedShots'][club]['longestCarry']:
            print(row['shotTime'], 'carry:', row['carryYd'], 'total:', row['totalYd'],
                  'ball mph:', row['ballSpeedMph'], 'peak yd:', row['peakHeightYd'],
                  'offline:', row['offline'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true', help='Record the exploratory result and review in the local archive; does not commit or push.')
    build(record=parser.parse_args().publish)
