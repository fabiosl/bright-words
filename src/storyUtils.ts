import type { ProgressMap, Story, StoryProgress } from './types';

export const PROGRESS_KEY = 'bright-words-progress';

export function splitWords(paragraph: string): string[] {
  return paragraph.trim().split(/\s+/).filter(Boolean);
}

export function readProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveStoryProgress(storyId: string, progress: StoryProgress) {
  const allProgress = readProgress();
  allProgress[storyId] = progress;
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));
}

export function clearStoryProgress(storyId: string) {
  const allProgress = readProgress();
  delete allProgress[storyId];
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));
}

export function clampProgress(story: Story, progress?: StoryProgress): StoryProgress {
  if (!progress || progress.completed) {
    return { pageIndex: 0, wordIndex: 0, completed: Boolean(progress?.completed) };
  }

  const pageIndex = Math.min(Math.max(progress.pageIndex, 0), story.pages.length - 1);
  const words = splitWords(story.pages[pageIndex]?.paragraph ?? '');
  const wordIndex = Math.min(Math.max(progress.wordIndex, 0), Math.max(words.length - 1, 0));

  return { pageIndex, wordIndex, completed: false };
}
