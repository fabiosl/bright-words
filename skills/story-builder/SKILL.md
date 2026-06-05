---
name: story-builder
description: Create or update app-ready children's reading stories for this project, including story ideation, page-count planning, English or Portuguese language metadata, engagement scoring, user approval gates, AI image generation, story asset placement, JSON registration, audio generation with timings, audio-language validation, and build verification. Use when Codex is asked to add, draft, improve, or install a story in the ADHD learning-to-read app.
---

# Story Builder

Use this skill to add or revise stories in the reading app.

## Project Targets

- Story metadata lives in `public/data/stories.json`.
- Story assets live in `public/stories/<story-id>/`.
- Each story must include `id`, `title`, `description`, `level`, `language`, `coverImage`, and `pages`.
- Use `language: "pt-BR"` for Portuguese stories.
- Use `language: "en-US"` for English stories.
- Store all story text and JSON metadata as UTF-8. Portuguese stories must preserve accents and punctuation correctly, such as `mágico`, `coração`, `ação`, `história`, and `não`.
- Keep image paths app-root relative, such as `/stories/<story-id>/page-1.png`.
- Every finalized page must have a generated image, audio file, and audio timing file.
- Run `npm.cmd run build` after project changes.

## Required Visual Style

Always create story images with an AI image generator such as ChatGPT image generation, DALL-E, or the built-in `image_gen` tool.

Do not satisfy story images with hand-authored SVG, CSS art, placeholder illustrations, stock-like generic assets, or unrelated reused images. If AI image generation hits a rate limit or temporary quota block, keep the story process open and wait in a retry loop with a reasonable backoff until quota is released and every page image has been generated. Do not mark the story as finalized until the generated images exist in the project. If image generation is unavailable for a non-rate-limit reason, or retries fail with a permanent error, report the blocker and keep the story incomplete.

Every page must have its own generated image that is relevant to that specific page and to the surrounding story context being depicted. Each generated image must be directly related to that page's paragraph. The visible action, character, setting, and mood should match the page content and the story moment, not merely the story's general topic.

Use the same child-appealing direction as `public/stories/tres-porquinhos/page-1.png`.

Visual requirements:

- Warm, polished children's-book look.
- Soft 3D/painterly rendering from the image generator.
- Rounded, expressive characters with large friendly eyes.
- Bright natural lighting, soft clouds, trees, flowers, and warm backgrounds when appropriate.
- Rich but gentle colors, especially sunny yellows, greens, sky blues, and soft pink clouds.
- Clear foreground action with uncluttered composition.
- No scary intensity, no harsh realism, no gritty documentary look.
- No text, logos, brand marks, or readable signs inside images.

For each image prompt, include:

- Page number and paragraph summary.
- The exact subject/action for that page.
- Consistent recurring character details across pages.
- Warm cinematic children's illustration style, plush rounded characters, soft depth of field, glowing daylight, highly appealing to preschool children.
- No readable text, no logos, no brand marks, no watermarks.
- For factual stories about real people or public characters, create age-appropriate illustrated likenesses or symbolic scenes. If a human figure is shown as a specific public person, the illustrated person should resemble that public person at the age or life stage being pictured in the story. Avoid photorealistic celebrity portrait demands unless the user explicitly asks for that style and policy allows it.

After generation, copy final images into `public/stories/<story-id>/` as stable project assets. Prefer `.png` outputs from the generator. Use `cover.png` and `page-N.png` unless there is a strong reason to use another raster format.

## Required Audio Generation

Stories are not complete until audio and word timings exist for every page.

If audio generation hits a rate limit, temporary quota block, transient service failure, or temporary network/service availability error, keep the story process open and wait in a retry loop with a reasonable backoff until every page audio file and timing file has been generated. Do not mark the story as finalized until all images, audio files, and timing files exist for every page.

Audio generation in this project uses:

- `npm run generate-audio` or `npm.cmd run generate-audio` on Windows PowerShell
- `scripts/generate-audio.mjs`
- `scripts/generate-edge-audio.py`
- `edge_tts`

The Node script reads `public/data/stories.json`, loops over every story/page, creates `public/stories/<story-id>/audio/`, and writes:

- `page-N.mp3`
- `page-N.timings.json`

It also updates each page in `stories.json` with:

```json
"audio": "/stories/<story-id>/audio/page-N.mp3",
"audioTimings": "/stories/<story-id>/audio/page-N.timings.json"
```

Voice mapping used by `scripts/generate-audio.mjs`:

- `en-US` -> `en-US-JennyNeural`
- `pt-BR` -> `pt-BR-FranciscaNeural`

Audio rate:

- `--rate=-8%`

Timing files are JSON arrays with one entry per word:

```json
[
  { "text": "Palavra", "start": 0.104, "end": 0.403 }
]
```

Important constraints:

- Page text is split by whitespace. Avoid unusual spacing that could break word-boundary matching.
- If `generate-audio` fails because Python or `edge_tts` is unavailable, report the blocker. Do not call the story final.
- If `generate-audio` fails because of a rate limit, temporary quota block, transient service failure, or temporary network/service availability error, keep waiting and retrying with backoff until all missing page audio and timing files are generated. Do not call the story final while any page is missing audio or timings.
- If audio already exists for a page, the script skips regenerating it. When page text changes, delete or regenerate that page's stale `mp3` and `timings.json` so the audio matches the new paragraph.
- Confirm every page has both `audio` and `audioTimings` fields after audio generation.

## Required User Intake

Before drafting a story, ask for missing required inputs. Ask concise questions.

Required inputs:

1. Story mode:
   - Real facts: grounded in true places, people, science, history, family events, nature, or everyday real-life experiences.
   - Imaginary: once-upon-a-time style, magical, pretend, whimsical, or fantasy.
2. Number of pages.
3. Language: English or Portuguese, unless already clear.

Optional useful inputs:

- Child age or reading level.
- Main character name.
- Topic, setting, theme, or personal detail.
- Any words to include or avoid.

Do not draft the story until the required inputs are known.

## Story Draft Workflow

1. Draft only the story text first. Do not generate images and do not edit project files yet.
2. Match the requested page count exactly.
3. Use short sentences and simple paragraphs suitable for young children.
4. For real-facts stories, keep facts accurate and age-appropriate. Verify unstable or specific factual claims before relying on them.
5. For imaginary stories, use clear cause-and-effect, warm stakes, repetition, and a satisfying ending.
6. Avoid overly long words when a simpler word preserves meaning. If a long word is important, keep it and rely on the app's word scaling.
7. Do not end stories with explicit lesson labels such as "Moral:", "Licao:", or "Moral da historia:". Let the ending show the idea through the story instead.

## Engagement Quality Gate

Before showing the story to the user, score it for engagement for children.

Score from 1 to 10 using this rubric:

- Clear child-friendly premise.
- Immediate curiosity or emotional hook.
- Simple, concrete action on every page.
- Repetition or rhythm that helps early readers.
- Visual moments that will make good illustrations.
- Warm, safe stakes.
- Satisfying ending.
- Ending avoids explicit lesson labels such as "Moral:".
- Age-appropriate vocabulary.
- No boring filler.
- No confusing jumps.

If the engagement score is below 9/10, revise the story and score it again.

Repeat until the story reaches at least 9/10. Keep the final score and one-sentence rationale available, but do not overburden the user with the full critique unless asked.

## User Approval Gate

After the story reaches 9/10 or higher, show the story as text only.

Include:

- Title.
- Page-by-page text.
- Story mode.
- Page count.
- Language.
- Engagement score.

Ask the user to approve or request changes.

Do not generate images, copy assets, or edit `stories.json` until the user explicitly approves the story text.

## Second LLM Validation Gate

After user approval and before implementation, run a second LLM validation pass.

Use an independent subagent if available and appropriate. If subagents are unavailable, perform a fresh validation pass yourself as a separate critique step.

Validation must check:

- The approved text still matches the requested mode.
- The story has the exact requested number of pages.
- Engagement is still at least 9/10.
- The story is age-appropriate.
- The story has clear image opportunities on every page.
- Real-facts stories do not introduce unsupported or dubious claims.
- Language metadata should be `en-US` for English or `pt-BR` for Portuguese.

If validation fails, revise the text, show the revision to the user, and return to the User Approval Gate.

Only proceed to implementation after validation passes.

## Implementation Workflow

After approval and successful second validation:

1. Create a kebab-case story id.
2. Create `public/stories/<story-id>/`.
3. Generate one AI image per page using the Required Visual Style.
4. Copy generated images into `public/stories/<story-id>/` as `page-N.png`.
5. Use page 1 as `cover.png` unless the user asks for a separate generated cover.
6. Add or update the story entry in `public/data/stories.json`.
7. Write useful alt text for every image.
8. Confirm the `language` field is present and correct.
9. Confirm every page image file exists. If any image is missing because of rate limits or temporary quota blocks, keep waiting and retrying image generation with backoff until all page images exist.
10. For Portuguese stories, verify that `public/data/stories.json` still contains valid UTF-8 text with proper accents. Search for mojibake markers such as `Ã`, `Â`, `â€™`, `â€œ`, `â€`, and replacement characters `�`. If any appear in story text, fix the encoding before continuing.
11. Run `npm.cmd run generate-audio` on Windows PowerShell, or `npm run generate-audio` in shells where `npm` works.
12. If audio generation is blocked by rate limits, temporary quota blocks, transient service failures, or temporary network/service availability errors, keep waiting and retrying with backoff until every page has generated audio and timings.
13. Confirm every page has an `audio` and `audioTimings` entry and that every referenced file exists.
14. Run `npm.cmd run build`.
15. Report changed files and any verification limits.

## Story Text Format

Use this format for approval:

```text
Title: <title>
Mode: <Real facts | Imaginary>
Language: <English | Portuguese>
Pages: <number>
Engagement score: <score>/10

Page 1
<short text>

Page 2
<short text>
```

## Implementation Notes

- Preserve unrelated user changes.
- Do not overwrite existing story assets unless the user asks for replacement.
- If generated images are project-bound, copy them into `public/stories/<story-id>/`.
- Keep the story JSON valid and app-root image paths stable.
- When editing `public/data/stories.json`, preserve UTF-8 encoding. Do not introduce double-encoded text or mojibake such as `mÃ¡gico` instead of `mágico`.
- For English stories, ensure speech synthesis receives `en-US`.
- For Portuguese stories, ensure speech synthesis receives `pt-BR`.
- Before calling a Portuguese story complete, inspect the rendered or stored text for broken accent encoding. Fix any mojibake in the JSON before generating or regenerating audio, because audio text and word timings must match the corrected Portuguese text.
- A story is final only when text, generated images, audio files, timing files, JSON metadata, and build verification are all complete.
