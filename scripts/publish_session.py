"""Validate a downloaded session bundle and publish it into the Git-tracked archive.

No network calls or Git pushes. Existing plan snapshots cannot be rewritten.
"""
import argparse
import copy
import datetime as dt
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def validate_session(session):
    if not isinstance(session, dict) or session.get('schemaVersion') != 1:
        raise ValueError('Expected session schemaVersion 1')
    sid, date = session.get('id', ''), session.get('date', '')
    if not isinstance(sid, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9-]+', sid):
        raise ValueError('Invalid session ID')
    if not isinstance(date, str) or dt.date.fromisoformat(date).isoformat() != date or not sid.startswith(date + '-'):
        raise ValueError('Date must match the session ID')
    if not isinstance(session.get('title'), str) or not session['title'].strip():
        raise ValueError('Session title is required')
    plan = session.get('plan')
    if not isinstance(plan, dict):
        raise ValueError('Saved plan is required')
    for field in ('createdAt', 'rationale', 'focus', 'cue', 'playThrough', 'videoNote'):
        if not isinstance(plan.get(field), str) or not plan[field].strip():
            raise ValueError(f'Plan needs {field}')
    if not isinstance(plan.get('schedule'), list) or not plan['schedule'] or not all(isinstance(s, str) for s in plan['schedule']):
        raise ValueError('Plan needs a schedule')
    if not isinstance(plan.get('drills'), list) or not plan['drills']:
        raise ValueError('Plan must contain drill snapshots')
    for drill in plan['drills']:
        for key in ('id', 'title', 'purpose', 'setup', 'feel', 'cue', 'reps', 'troubleshooting'):
            if not isinstance(drill.get(key), str) or not drill[key].strip():
                raise ValueError(f'Drill needs {key}')
        if not drill['purpose'].startswith('Purpose of this drill is'):
            raise ValueError('Each drill must explicitly state its purpose')
        if not isinstance(drill.get('steps'), list) or not drill['steps'] or not all(isinstance(s, str) for s in drill['steps']):
            raise ValueError('Drill steps are required')
    result = session.get('result')
    if result is not None:
        if not isinstance(result, dict) or result.get('source') not in ('shot-csv', 'uploaded-summary'):
            raise ValueError('Results need a recognized source')
        if result.get('sevenTotal') is None and result.get('sevenCarry') is None:
            raise ValueError('Results need a measured distance')
        for field in ('sevenTotal', 'sevenCarry', 'shotCount', 'totalCount', 'carryCount', 'practiceMinutes'):
            number = result.get(field)
            if number is not None and (isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or number < 0):
                raise ValueError(f'Invalid {field}')
            if field in ('shotCount', 'totalCount', 'carryCount') and number is not None and int(number) != number:
                raise ValueError('Sample counts must be integers')
        count = result.get('shotCount')
        if count is not None and any(result.get(k) is not None and result[k] > count for k in ('totalCount', 'carryCount')):
            raise ValueError('Metric sample count exceeds shot count')
        play = result.get('playThrough', {})
        holes = play.get('holes', 0)
        if not isinstance(holes, (int, float)) or isinstance(holes, bool) or not 0 <= holes <= 18 or int(holes) != holes:
            raise ValueError('Play-through holes must be an integer from 0 to 18')
        if result['source'] == 'shot-csv':
            shots = result.get('shots')
            if not isinstance(shots, list) or not shots:
                raise ValueError('CSV results must include their shot data')
            normal = []
            for shot in shots:
                if not isinstance(shot, dict) or shot.get('block') not in ('normal', 'drill', 'play'):
                    raise ValueError('Invalid shot block')
                for field in ('carry', 'total'):
                    n = shot.get(field)
                    if n is not None and (isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or n < 0):
                        raise ValueError('Invalid shot distance')
                if shot.get('club') in ('7i', '7iron', 'iron7') and shot['block'] == 'normal':
                    normal.append(shot)
            if count != len(normal):
                raise ValueError('Shot count does not match normal 7i rows')
            for field, avg_key, count_key in [('total', 'sevenTotal', 'totalCount'), ('carry', 'sevenCarry', 'carryCount')]:
                values = [s[field] for s in normal if s.get(field) is not None]
                expected = sum(values) / len(values) if values else None
                actual = result.get(avg_key)
                if result.get(count_key) != len(values) or (expected is None and actual is not None) or (expected is not None and (actual is None or not math.isclose(expected, actual, abs_tol=1e-7))):
                    raise ValueError('Summary does not match the actual normal 7i shots')
    return session


def publish(bundle, root=ROOT, replace_results=False):
    if not isinstance(bundle, dict) or bundle.get('schemaVersion') != 1:
        raise ValueError('Expected bundle schemaVersion 1')
    session = validate_session(copy.deepcopy(bundle.get('session')))
    manifest_path = root / 'data' / 'archive.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    relative = f"sessions/{session['id']}/session.json"
    target = root / relative
    existing_entry = next((e for e in manifest['sessions'] if e['id'] == session['id']), None)
    if target.exists():
        existing = json.loads(target.read_text(encoding='utf-8'))
        if existing == session:
            return target
        if any(existing.get(k) != session.get(k) for k in ('id', 'date', 'title', 'plan')):
            raise ValueError('Saved plan snapshots are immutable. Create a new session instead.')
        if existing.get('result') is not None and not replace_results:
            raise ValueError('Results already exist. Use --replace-results explicitly to correct them.')
        if existing.get('result') is not None and session.get('result') is None:
            raise ValueError('Completed results cannot be cleared')
    based_on = session['plan'].get('basedOnSessionId')
    if based_on:
        entry = next((e for e in manifest['sessions'] if e['id'] == based_on), None)
        if not entry:
            raise ValueError('Publish the referenced prior session before this plan')
        prior = json.loads((root / entry['path']).read_text(encoding='utf-8'))
        if not prior.get('result') or prior['date'] >= session['date']:
            raise ValueError('Plan must refer to an earlier completed session')
    if not existing_entry:
        manifest['sessions'].append({k: session[k] for k in ('id', 'date', 'title')} | {'path': relative})
    manifest['sessions'].sort(key=lambda s: (s['date'], s['id']))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(session, indent=2, ensure_ascii=False, allow_nan=False) + '\n', encoding='utf-8')
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return target


def validate_archive(root=ROOT):
    manifest = json.loads((root / 'data' / 'archive.json').read_text(encoding='utf-8'))
    ids = set()
    for entry in manifest['sessions']:
        expected = f"sessions/{entry['id']}/session.json"
        if entry['path'] != expected or not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9-]+', entry['id']) or entry['id'] in ids:
            raise ValueError('Invalid or duplicate archive entry')
        ids.add(entry['id'])
        session = validate_session(json.loads((root / expected).read_text(encoding='utf-8')))
        if any(entry[k] != session[k] for k in ('id', 'date', 'title')):
            raise ValueError('Manifest does not match session')
        based_on = session['plan'].get('basedOnSessionId')
        if based_on:
            prior_entry = next((e for e in manifest['sessions'] if e['id'] == based_on), None)
            if not prior_entry:
                raise ValueError('Missing plan source session')
            prior = json.loads((root / prior_entry['path']).read_text(encoding='utf-8'))
            if not prior.get('result') or prior['date'] >= session['date']:
                raise ValueError('Invalid plan source session')
    return len(ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', nargs='?', type=Path)
    parser.add_argument('--replace-results', action='store_true')
    parser.add_argument('--validate', action='store_true')
    args = parser.parse_args()
    try:
        if args.validate:
            print(f'Validated {validate_archive()} archived session(s).')
        elif args.bundle:
            print(f'Published {publish(json.loads(args.bundle.read_text(encoding="utf-8-sig")), replace_results=args.replace_results)}')
            print('Review the diff, commit, and push to make this visible on GitHub Pages.')
        else:
            parser.error('Supply a downloaded bundle or --validate')
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, f'Publication rejected: {error}\n')


if __name__ == '__main__':
    main()