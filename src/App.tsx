import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProgressMap, StoriesResponse, Story, StoryProgress } from './types';
import { clampProgress, clearStoryProgress, readProgress, saveStoryProgress, splitWords } from './storyUtils';

type View = 'library' | 'reader';

export function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading stories...');

  useEffect(() => {
    async function loadStories() {
      try {
        const response = await fetch('/data/stories.json');
        if (!response.ok) {
          throw new Error('Could not load stories.');
        }

        const data = (await response.json()) as StoriesResponse;
        setStories(data.stories);
        setProgress(readProgress());
        setStatus('');
      } catch {
        setStatus('Stories are taking a little nap. Please refresh to try again.');
      }
    }

    loadStories();
  }, []);

  const activeStory = stories.find((story) => story.id === activeStoryId) ?? null;
  const view: View = activeStory ? 'reader' : 'library';

  function openStory(story: Story) {
    setActiveStoryId(story.id);
  }

  function updateProgress(storyId: string, nextProgress: StoryProgress) {
    saveStoryProgress(storyId, nextProgress);
    setProgress((current) => ({ ...current, [storyId]: nextProgress }));
  }

  function resetStory(storyId: string) {
    clearStoryProgress(storyId);
    setProgress((current) => {
      const next = { ...current };
      delete next[storyId];
      return next;
    });
  }

  if (status) {
    return (
      <main className="status-screen">
        <p>{status}</p>
      </main>
    );
  }

  return (
    <>
      {view === 'library' && (
        <StoryLibrary stories={stories} progress={progress} onOpenStory={openStory} onResetStory={resetStory} />
      )}
      {activeStory && (
        <StoryReader
          story={activeStory}
          savedProgress={progress[activeStory.id]}
          onBackToLibrary={() => setActiveStoryId(null)}
          onProgressChange={updateProgress}
          onResetStory={resetStory}
        />
      )}
    </>
  );
}

function StoryLibrary({
  stories,
  progress,
  onOpenStory,
  onResetStory,
}: {
  stories: Story[];
  progress: ProgressMap;
  onOpenStory: (story: Story) => void;
  onResetStory: (storyId: string) => void;
}) {
  return (
    <main className="library-shell">
      <section className="library-heading" aria-labelledby="library-title">
        <p className="eyebrow">Bright Words</p>
        <h1 id="library-title">Pick a story</h1>
      </section>

      <section className="story-grid" aria-label="Stories">
        {stories.map((story) => {
          const storyProgress = progress[story.id];
          const isStarted = storyProgress && !storyProgress.completed;
          const isComplete = storyProgress?.completed;

          return (
            <article className="story-card" key={story.id}>
              <img src={story.coverImage} alt="" className="story-cover" />
              <div className="story-card-body">
                <div className="story-meta">
                  <span>{story.level}</span>
                  {isComplete && <span>Finished</span>}
                  {isStarted && <span>In progress</span>}
                </div>
                <h2>{story.title}</h2>
                <p>{story.description}</p>
                <div className="story-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      if (isComplete) {
                        onResetStory(story.id);
                      }

                      onOpenStory(story);
                    }}
                  >
                    {isStarted ? 'Resume' : isComplete ? 'Read again' : 'Start'}
                  </button>
                  {(isStarted || isComplete) && (
                    <button className="text-button" type="button" onClick={() => onResetStory(story.id)}>
                      Restart
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function StoryReader({
  story,
  savedProgress,
  onBackToLibrary,
  onProgressChange,
  onResetStory,
}: {
  story: Story;
  savedProgress?: StoryProgress;
  onBackToLibrary: () => void;
  onProgressChange: (storyId: string, progress: StoryProgress) => void;
  onResetStory: (storyId: string) => void;
}) {
  const initialProgress = useMemo(() => clampProgress(story, savedProgress), [savedProgress, story]);
  const [pageIndex, setPageIndex] = useState(initialProgress.pageIndex);
  const [wordIndex, setWordIndex] = useState(initialProgress.wordIndex);
  const [completed, setCompleted] = useState(initialProgress.completed);

  const currentPage = story.pages[pageIndex];
  const words = useMemo(() => splitWords(currentPage.paragraph), [currentPage.paragraph]);
  const activeWord = words[wordIndex] ?? '';

  const persist = useCallback(
    (nextPageIndex: number, nextWordIndex: number, isCompleted = false) => {
      onProgressChange(story.id, {
        pageIndex: nextPageIndex,
        wordIndex: nextWordIndex,
        completed: isCompleted,
      });
    },
    [onProgressChange, story.id],
  );

  const goToPage = useCallback(
    (nextPageIndex: number) => {
      const boundedPage = Math.min(Math.max(nextPageIndex, 0), story.pages.length - 1);
      setCompleted(false);
      setPageIndex(boundedPage);
      setWordIndex(0);
      persist(boundedPage, 0);
    },
    [persist, story.pages.length],
  );

  const previousWord = useCallback(() => {
    if (completed) {
      setCompleted(false);
      const lastPageIndex = story.pages.length - 1;
      const lastWords = splitWords(story.pages[lastPageIndex].paragraph);
      const lastWordIndex = Math.max(lastWords.length - 1, 0);
      setPageIndex(lastPageIndex);
      setWordIndex(lastWordIndex);
      persist(lastPageIndex, lastWordIndex);
      return;
    }

    if (wordIndex > 0) {
      const nextWordIndex = wordIndex - 1;
      setWordIndex(nextWordIndex);
      persist(pageIndex, nextWordIndex);
      return;
    }

    if (pageIndex > 0) {
      const nextPageIndex = pageIndex - 1;
      const previousPageWords = splitWords(story.pages[nextPageIndex].paragraph);
      const nextWordIndex = Math.max(previousPageWords.length - 1, 0);
      setPageIndex(nextPageIndex);
      setWordIndex(nextWordIndex);
      persist(nextPageIndex, nextWordIndex);
    }
  }, [completed, pageIndex, persist, story.pages, wordIndex]);

  const nextWord = useCallback(() => {
    if (completed) {
      return;
    }

    if (wordIndex < words.length - 1) {
      const nextWordIndex = wordIndex + 1;
      setWordIndex(nextWordIndex);
      persist(pageIndex, nextWordIndex);
      return;
    }

    if (pageIndex < story.pages.length - 1) {
      const nextPageIndex = pageIndex + 1;
      setPageIndex(nextPageIndex);
      setWordIndex(0);
      persist(nextPageIndex, 0);
      return;
    }

    setCompleted(true);
    persist(pageIndex, wordIndex, true);
  }, [completed, pageIndex, persist, story.pages.length, wordIndex, words.length]);

  function rereadStory() {
    onResetStory(story.id);
    setCompleted(false);
    setPageIndex(0);
    setWordIndex(0);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousWord();
      }

      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        nextWord();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextWord, previousWord]);

  return (
    <main className="reader-shell">
      <img className="reader-image" src={currentPage.image} alt={currentPage.alt} />
      <div className="reader-scrim" />

      <header className="reader-topbar">
        <button className="round-button home-button" type="button" onClick={onBackToLibrary} aria-label="Back to stories">
          ‹
        </button>
        <div>
          <p className="reader-kicker">{story.title}</p>
          <p className="reader-count">
            Page {pageIndex + 1} of {story.pages.length}
          </p>
        </div>
      </header>

      <button
        className="page-button page-button-left"
        type="button"
        onClick={() => goToPage(pageIndex - 1)}
        disabled={pageIndex === 0}
        aria-label="Previous page"
      >
        ‹
      </button>
      <button
        className="page-button page-button-right"
        type="button"
        onClick={() => goToPage(pageIndex + 1)}
        disabled={pageIndex === story.pages.length - 1}
        aria-label="Next page"
      >
        ›
      </button>

      <section className="focus-stage" aria-live="polite">
        {completed ? (
          <div className="completion-panel">
            <p className="eyebrow">Great reading</p>
            <h1>You finished {story.title}!</h1>
            <div className="completion-actions">
              <button className="primary-button" type="button" onClick={rereadStory}>
                Read again
              </button>
              <button className="secondary-button" type="button" onClick={onBackToLibrary}>
                Stories
              </button>
            </div>
          </div>
        ) : (
          <p className="focus-word" style={{ '--word-scale': getWordScale(activeWord) }}>
            {activeWord}
          </p>
        )}
      </section>

      {!completed && (
        <footer className="reader-footer">
          <div className="paragraph-strip" aria-label="Full paragraph">
            {words.map((word, index) => (
              <span className={index === wordIndex ? 'active-paragraph-word' : ''} key={`${word}-${index}`}>
                {word}
              </span>
            ))}
          </div>

          <div className="word-controls" aria-label="Word controls">
            <button className="secondary-button control-button" type="button" onClick={previousWord}>
              ‹ Word
            </button>
            <div className="word-progress">
              {wordIndex + 1} / {words.length}
            </div>
            <button className="primary-button control-button" type="button" onClick={nextWord}>
              Word ›
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}

function getWordScale(word: string) {
  const letters = Math.max(word.length, 1);
  return `${Math.min(17, Math.max(7, 140 / letters))}vw`;
}
