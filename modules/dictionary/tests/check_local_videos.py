"""Check copied originals, MP4 ranges and sample-only standalone collection data."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
import content


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:8014')
    args = parser.parse_args()
    checks = 0

    def check(condition, message):
        nonlocal checks
        if not condition:
            raise AssertionError(message)
        checks += 1

    def fetch(path, headers=None, method='GET'):
        try:
            return urlopen(Request(args.url + path, headers=headers or {}, method=method), timeout=10)
        except HTTPError as error:
            return error

    signs = [sign for sign in content.signs() if sign.get('collection') == 'local-videos']
    check(len(signs) == 12, 'All 12 supplied words imported')
    check(len(content.open_lessons()) == 2, 'No planned lesson opened')
    check(content.sign('ban')['word']['vi'] == 'Bạn' and content.sign('ban-ron')['word']['vi'] == 'Bận', 'Diacritic slug collision handled')
    for sign in signs:
        video_path = sign['video']
        original = ROOT.parent / 'data' / sign['source']['relative_path']
        copied = ROOT / video_path.lstrip('/')
        digest = hashlib.sha256(original.read_bytes()).hexdigest()
        body = copied.read_bytes()
        check(digest == sign['source']['sha256'], 'Original video is intact')
        check(hashlib.sha256(body).hexdigest() == sign['source']['web_sha256'] and sign['source']['web_codec'] == 'h264' and b'avc1' in body, 'Traceable H.264 derivative')
        check(sign['lesson'] is None and sign['status'] == 'sample', 'Unreviewed collection, no invented lesson assignment')
        with fetch(video_path) as response:
            check(response.status == 200 and response.headers['Content-Type'] == 'video/mp4', 'MP4 response')
            check(response.read() == body, 'Full video bytes')
            check(response.headers['Accept-Ranges'] == 'bytes', 'Range support')
        with fetch(video_path, method='HEAD') as response:
            check(response.status == 200 and int(response.headers['Content-Length']) == len(body) and not response.read(), 'HEAD without body')
        for header, first, last in [('bytes=0-127', 0, 127), ('bytes=128-', 128, len(body)-1), ('bytes=-64', len(body)-64, len(body)-1), ('bytes=0-999999999', 0, len(body)-1)]:
            with fetch(video_path, {'Range': header}) as response:
                check(response.status == 206 and response.headers['Content-Range'] == f'bytes {first}-{last}/{len(body)}', 'Correct partial response')
                check(response.read() == body[first:last+1], 'Exact requested bytes')
        for header in ['bytes=999999999-', 'bytes=10-5', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=bad-range']:
            with fetch(video_path, {'Range': header}) as response:
                check(response.status == 416 and response.headers['Content-Range'] == f'bytes */{len(body)}' and not response.read(), 'Invalid range is bounded')
        with fetch(video_path, {'Range': 'bytes=0-10', 'If-Range': '"stale"'}) as response:
            check(response.status == 200 and response.read() == body, 'Unvalidated If-Range returns full content')
        for locale in ('vi', 'en'):
            with fetch('/app/signs/' + sign['slug'] + '?lang=' + locale) as response:
                page = response.read().decode('utf-8')
                check(response.status == 200 and f'src="{video_path}"' in page and 'dictionary-video-notice' in page, 'SSR media and review notice')
        print('PASS preserved original, H.264 video, SSR and byte ranges:', sign['slug'])
    for path in ('/static/media/local-videos/%2e%2e/%2e%2e/%2e%2e/serve.py', '/data/curriculum.json', '/app/signs/khong-co'):
        with fetch(path) as response:
            check(response.status == 404, 'Private and unknown paths stay blocked')
    print(f'PASS: {checks} local-video integration checks; 12 preserved originals and H.264 copies, VI/EN SSR, streaming and seeking ranges.')


if __name__ == '__main__':
    main()
