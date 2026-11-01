from html.parser import HTMLParser
import importlib.util
from pathlib import Path
import tempfile
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('staging', ROOT / 'scripts' / 'stage_pages.py')
staging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(staging)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        for key in ('href', 'src'):
            if key in attrs:
                self.links.append(attrs[key])
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            self.links.append(attrs['content'].split('url=', 1)[1])


def missing_links(root):
    missing = []
    for file in root.rglob('*.html'):
        parser = Links()
        parser.feed(file.read_text(encoding='utf-8'))
        for value in parser.links:
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            target = (file.parent / unquote(parsed.path)).resolve()
            if not target.exists():
                missing.append((str(file.relative_to(root)), value))
    return missing


class OrganizationTests(unittest.TestCase):
    def test_only_entry_html_and_configuration_at_root(self):
        self.assertEqual([p.name for p in ROOT.glob('*.html')], ['index.html'])
        for pattern in ('*.xlsx', '*.csv', '*.xml', '*.mp4'):
            self.assertEqual(list(ROOT.glob(pattern)), [])

    def test_all_local_html_references_and_redirects_resolve(self):
        missing = missing_links_in_workspace()
        self.assertEqual(missing, [])

    def test_public_artifact_contains_references_but_not_raw_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            staged = staging.stage(Path(directory))
            self.assertTrue((staged / 'coach' / 'library.html').exists())
            self.assertTrue((staged / 'research' / 'pages' / 'golf_benchmark_comparison.html').exists())
            self.assertTrue((staged / 'sessions' / '2026-11-01-session-01' / 'session.json').exists())
            for pattern in ('*.csv', '*.xlsx', '*.xml', '*.mp4', '*.md'):
                self.assertEqual(list(staged.rglob(pattern)), [])
            self.assertFalse((staged / 'legacy').exists())
            self.assertEqual(missing_links(staged), [])


def missing_links_in_workspace():
    # Ignore local tool/runtime folders, which are not project content.
    missing = []
    for directory in ('coach', 'research/pages', 'legacy/pages'):
        for file in (ROOT / directory).glob('*.html'):
            parser = Links()
            parser.feed(file.read_text(encoding='utf-8'))
            for value in parser.links:
                parsed = urlsplit(value)
                if parsed.scheme or parsed.netloc or not parsed.path:
                    continue
                if not (file.parent / unquote(parsed.path)).resolve().exists():
                    missing.append((str(file.relative_to(ROOT)), value))
    return missing


if __name__ == '__main__':
    unittest.main()