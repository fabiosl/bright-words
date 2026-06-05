import argparse
import asyncio
import json
from pathlib import Path

import edge_tts


TICKS_PER_SECOND = 10_000_000


def split_words(text: str) -> list[str]:
    return [word for word in text.strip().split() if word]


def align_word_timings(words: list[str], boundary_events: list[dict]) -> list[dict]:
    if not words or not boundary_events:
        return []

    if len(boundary_events) == len(words):
        return boundary_events

    if len(boundary_events) < len(words):
        start = boundary_events[0]["offset"]
        end = boundary_events[-1]["offset"] + boundary_events[-1]["duration"]
        duration = max(end - start, 1)
        step = duration / len(words)

        return [
            {
                "offset": round(start + (step * index)),
                "duration": round(step),
            }
            for index, _word in enumerate(words)
        ]

    aligned = []
    event_index = 0
    remaining_extra = len(boundary_events) - len(words)

    for word_index, _word in enumerate(words):
        remaining_words = len(words) - word_index
        take = 1

        if remaining_extra > 0 and len(boundary_events) - event_index > remaining_words:
            take += 1
            remaining_extra -= 1

        group = boundary_events[event_index : event_index + take]
        event_index += take
        start = group[0]["offset"]
        end = group[-1]["offset"] + group[-1]["duration"]
        aligned.append({"offset": start, "duration": end - start})

    return aligned


async def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Edge TTS audio with word timings.")
    parser.add_argument("--text")
    parser.add_argument("--text-file")
    parser.add_argument("--voice", required=True)
    parser.add_argument("--rate", default="-8%")
    parser.add_argument("--write-media", required=True)
    parser.add_argument("--write-timings", required=True)
    args = parser.parse_args()

    if not args.text and not args.text_file:
        parser.error("one of --text or --text-file is required")

    text = args.text
    if args.text_file:
        text = Path(args.text_file).read_text(encoding="utf-8")

    media_path = Path(args.write_media)
    timings_path = Path(args.write_timings)
    media_path.parent.mkdir(parents=True, exist_ok=True)
    timings_path.parent.mkdir(parents=True, exist_ok=True)

    communicate = edge_tts.Communicate(
        text=text,
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

    words = split_words(text)
    boundary_events = align_word_timings(words, boundary_events)

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
