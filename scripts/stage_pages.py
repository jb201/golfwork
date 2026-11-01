"""Stage the explicit public-site allowlist; never copy raw sources or legacy apps."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def stage(destination, root=ROOT):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / 'index.html', destination / 'index.html')
    for directory in ('assets', 'coach', 'data'):
        shutil.copytree(root / directory, destination / directory, dirs_exist_ok=True)
    shutil.copytree(root / 'research' / 'pages', destination / 'research' / 'pages', dirs_exist_ok=True)
    for session in (root / 'sessions').iterdir():
        if not session.is_dir():
            continue
        for filename in ('session.json', 'review.json'):
            source = session / filename
            if source.exists():
                target = destination / 'sessions' / session.name / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
    (destination / '.nojekyll').touch()
    return destination


if __name__ == '__main__':
    stage(ROOT / '_site')
    print('Staged journal, session JSON and research pages; no raw exports, notes or workbooks.')