"""Offline asset preparation using PyAV already installed on the development machine.

The website itself still uses only Python stdlib. No package is installed by this
script. Keep each original in ../data; transcode only the website copy to H.264.
"""
import hashlib
import json
from pathlib import Path

import av

ROOT = Path(__file__).resolve().parents[3]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    data_path = ROOT / 'data' / 'curriculum.json'
    data = json.loads(data_path.read_text(encoding='utf-8'))
    for sign in data['signs']:
        if sign.get('collection') != 'local-videos':
            continue
        source = ROOT.parent / 'data' / sign['source']['relative_path']
        destination = ROOT / sign['video'].lstrip('/')
        temporary = destination.with_suffix('.preparing')
        if sha256(source) != sign['source']['sha256']:
            raise ValueError('The original video changed: ' + str(source))
        with av.open(str(source)) as incoming:
            original = incoming.streams.video[0]
            with av.open(str(temporary), 'w', format='mp4', options={'movflags': '+faststart'}) as outgoing:
                stream = outgoing.add_stream('libx264', rate=original.average_rate)
                stream.width, stream.height = original.width, original.height
                stream.pix_fmt = 'yuv420p'
                stream.options = {'crf': '18', 'preset': 'fast'}
                stream.codec_context.thread_count = 2
                frame_count = 0
                for frame in incoming.decode(original):
                    for packet in stream.encode(frame):
                        outgoing.mux(packet)
                    frame_count += 1
                for packet in stream.encode():
                    outgoing.mux(packet)
        with av.open(str(temporary)) as output:
            video = output.streams.video[0]
            if video.codec_context.name != 'h264' or (video.width, video.height) != (original.width, original.height):
                raise ValueError('Web video format changed unexpectedly')
            if sum(1 for _ in output.decode(video)) != frame_count:
                raise ValueError('Frame count changed during conversion')
        temporary.replace(destination)
        sign['source'].update(web_codec='h264', web_sha256=sha256(destination))
        print('Prepared H.264, original resolution and frame count:', sign['slug'], frame_count, flush=True)
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
