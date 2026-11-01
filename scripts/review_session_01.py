"""Reproduce Session 01 measurements from preserved original exports."""
import csv
import hashlib
import json
import statistics as st
from publish_session import ROOT, publish

D = ROOT / 'sessions' / '2026-11-01-session-01'


def load(name):
    with (D / 'sources' / name).open(encoding='utf-8-sig', newline='') as f:
        return sorted(csv.DictReader(f), key=lambda r: int(r['Global Shot Number']))


def summary(rows):
    return {'n': len(rows), 'carry': st.mean(float(r['Carry Dist (yd)']) for r in rows),
            'total': st.mean(float(r['Total Dist (yd)']) for r in rows),
            'ballSpeed': st.mean(float(r['Ball Speed (mph)']) for r in rows),
            'outsideInCount': sum('O-I' in r['Club Path'] for r in rows),
            'insideOutCount': sum('I-O' in r['Club Path'] for r in rows)}


def build():
    practice, play = load('practice-original.csv'), load('play-original.csv')
    if len(practice) != 84 or len(play) != 21:
        raise ValueError('Unexpected source row counts')
    tasks = [('Staggered hip-to-hip',6,20),('Non-staggered half-swings',22,35),('Freer swing experiment',37,61),('Headcover experiment',75,84)]
    blocks = []
    for title, start, end in tasks:
        rows = [r for r in practice if start <= int(r['Global Shot Number']) <= end and r['Club Name']=='I7']
        blocks.append({'title':title,'start':start,'end':end,**summary(rows)})
    freer = [r for r in practice if 37 <= int(r['Global Shot Number']) <= 61 and r['Club Name']=='I7']
    play7 = [r for r in play if r['Club Name']=='I7']
    session = json.loads((D / 'session.json').read_text(encoding='utf-8'))
    review = json.loads((D / 'review.json').read_text(encoding='utf-8'))
    review.update(blocks=blocks, playSeven=summary(play7))
    review['sources'] = [{'path':'sources/'+name, 'rows':len(rows), 'sha256':hashlib.sha256((D/'sources'/name).read_bytes()).hexdigest()} for name, rows in [('practice-original.csv',practice),('play-original.csv',play)]]
    session['review'] = review
    shots = [{'club':'7i','block':block,'carry':float(r['Carry Dist (yd)']),'total':float(r['Total Dist (yd)'])} for block,rows in [('normal',freer),('play',play7)] for r in rows]
    session['result'] = {'recordedAt':'2026-11-01','source':'shot-csv','sevenTotal':blocks[2]['total'],'sevenCarry':blocks[2]['carry'],'shotCount':len(freer),'totalCount':len(freer),'carryCount':len(freer),'shots':shots,'practiceMinutes':None,
        'notes':'Freer exploratory I7 block only, shots 37–61. Not a standardized full-swing benchmark. Drill/headcover blocks are separate in the review; poor contact and lower-back discomfort reported.',
        'comparability':'exploratory-not-standardized',
        'playThrough':{'holes':8,'notes':'Holes 1–8 represented, completion unconfirmed. 21 recorded shots; one I7 opportunity: 103.5 carry / 105.5 total. Player reports not hitting the ball well.'}}
    publish({'schemaVersion':1,'session':session}, replace_results=True)
    print('Saved results and post-lesson review; original plan preserved.')
    print(json.dumps(blocks, indent=2))


if __name__ == '__main__':
    build()