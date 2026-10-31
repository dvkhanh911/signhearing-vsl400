"""Import only the supplied collection; keep originals and existing lesson assignments intact."""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT.parent / 'data'
MEDIA = ROOT / 'static' / 'media' / 'local-videos'
WORDS = (
    ('Anh', 'anh', 'Older brother / male addressee'),
    ('Ăn', 'an', 'Eat'),
    ('Ấm', 'am', 'Warm / kettle'),
    ('Áo sơ mi', 'ao-so-mi', 'Shirt'),
    ('Áo thun', 'ao-thun', 'T-shirt'),
    ('Áo đầm', 'ao-dam', 'Dress'),
    ('Ba lô', 'ba-lo', 'Backpack'),
    ('Bà ngoại', 'ba-ngoai', 'Maternal grandmother'),
    ('Bà nội', 'ba-noi', 'Paternal grandmother'),
    ('Bác', 'bac', 'Elder aunt / uncle'),
    ('Bác sĩ', 'bac-si', 'Doctor'),
    # Both Bạn and Bận normalize to "ban". Preserve the existing Bạn slug.
    ('Bận', 'ban-ron', 'Busy / occupied'),
)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    curriculum_path = ROOT / 'data' / 'curriculum.json'
    curriculum = json.loads(curriculum_path.read_text(encoding='utf-8'))
    original = [sign for sign in curriculum['signs'] if sign.get('collection') != 'local-videos']
    imported = {sign['slug']: sign for sign in curriculum['signs'] if sign.get('collection') == 'local-videos'}
    occupied = {sign['slug'] for sign in original}
    planned = []
    for word, slug, english in WORDS:
        files = list((SOURCE / word).glob('*.mp4'))
        if len(files) != 1 or slug in occupied:
            raise ValueError(f'Expected one video and a unique slug for {word!r}')
        source = files[0]
        destination = MEDIA / (slug + '.mp4')
        checksum = sha256(source)
        provenance = {'relative_path': source.relative_to(SOURCE).as_posix(), 'sha256': checksum}
        if destination.exists() and sha256(destination) != checksum:
            previous = imported.get(slug, {}).get('source', {})
            if previous.get('sha256') != checksum or previous.get('web_sha256') != sha256(destination):
                raise ValueError(f'Refusing to overwrite a different video: {destination}')
            provenance.update({key: previous[key] for key in ('web_sha256', 'web_codec') if key in previous})
        planned.append((source, destination, checksum, {
            'slug': slug,
            'word': {'vi': word, 'en': english},
            'meaning': {
                'vi': 'Ngữ cảnh đang chờ rà soát.',
                'en': 'Context pending review.',
            },
            'lesson': None,
            'collection': 'local-videos',
            'status': 'sample',
            'video': '/static/media/local-videos/' + slug + '.mp4',
            'thumbnail': None,
            'variants': [],
            'ai_supported': False,
            'source': provenance,
        }))
    MEDIA.mkdir(parents=True, exist_ok=True)
    for source, destination, checksum, entry in planned:
        if not destination.exists():
            shutil.copy2(source, destination)
        if sha256(destination) != entry['source'].get('web_sha256', checksum):
            raise ValueError(f'Copied video checksum mismatch: {destination}')
    curriculum['signs'] = [entry for _, _, _, entry in planned] + original
    curriculum['_local_videos'] = {
        'collection': 'local-videos', 'source_directory': '../data',
        'reviewed': False, 'translations_reviewed': False,
        'note': 'User-supplied preview collection. lesson=null until syllabus mapping is reviewed; original lesson signs are preserved.',
    }
    curriculum_path.write_text(json.dumps(curriculum, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(planned)} videos; preserved {len(original)} existing signs and all lesson assignments.')


if __name__ == '__main__':
    main()
