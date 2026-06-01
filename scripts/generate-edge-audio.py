import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


TICKS_PER_SECOND = 10_000_000


def split_words(text: str) -> list[str]:
    return [word for word in text.strip().split() if word]


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Edge TTS audio with word timings.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--rate", default="-8%")
    parser.add_argument("--write-media", required=True)
    parser.add_argument("--write-timings", required=True)
    args = parser.parse_args()

    media_path = Path(args.write_media)
    timings_path = Path(args.write_timings)
    media_path.parent.mkdir(parents=True, exist_ok=True)
    timings_path.parent.mkdir(parents=True, exist_ok=True)

    communicate = edge_tts.Communicate(
        text=args.text,
        voice=args.voice,
        rate=args.rate,
        boundary="WordBoundary",
    )

    boundary_events = []
    with media_path.open("wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                boundary_events.append(chunk)

    words = split_words(args.text)
    if len(boundary_events) != len(words):
        raise RuntimeError(
            f"Word timing mismatch: paragraph has {len(words)} words, Edge returned {len(boundary_events)} boundaries."
        )

    timings = []
    for word, event in zip(words, boundary_events):
        start = event["offset"] / TICKS_PER_SECOND
        duration = event["duration"] / TICKS_PER_SECOND
        timings.append(
            {
                "text": word,
                "start": round(start, 3),
                "end": round(start + duration, 3),
            }
        )

    timings_path.write_text(json.dumps(timings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
