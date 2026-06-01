import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProgressMap, StoriesResponse, Story, StoryProgress } from './types';
import { clampProgress, clearStoryProgress, readProgress, saveStoryProgress, splitWords } from './storyUtils';
import { splitIntoSyllables } from './syllables';

type View = 'library' | 'reader';
type LanguageFilter = 'all' | 'en-US' | 'pt-BR';
type WordTiming = {
  end: number;
};

export function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all');
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

  useEffect(() => {
    if (stories.length === 0) {
      return;
    }

    function syncStoryFromPath() {
      const slug = getStorySlugFromPath();
      if (!slug) {
        setActiveStoryId(null);
        return;
      }

      const story = stories.find((candidate) => getStorySlug(candidate) === slug);
      setActiveStoryId(story?.id ?? null);
    }

    syncStoryFromPath();
    window.addEventListener('popstate', syncStoryFromPath);
    return () => window.removeEventListener('popstate', syncStoryFromPath);
  }, [stories]);

  const activeStory = stories.find((story) => story.id === activeStoryId) ?? null;
  const view: View = activeStory ? 'reader' : 'library';

  function openStory(story: Story) {
    const nextPath = `/stories/${getStorySlug(story)}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setActiveStoryId(story.id);
  }

  function backToLibrary() {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }

    setActiveStoryId(null);
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
        <StoryLibrary
          stories={stories}
          progress={progress}
          languageFilter={languageFilter}
          onLanguageFilterChange={setLanguageFilter}
          onOpenStory={openStory}
          onResetStory={resetStory}
        />
      )}
      {activeStory && (
        <StoryReader
          story={activeStory}
          savedProgress={progress[activeStory.id]}
          onBackToLibrary={backToLibrary}
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
  languageFilter,
  onLanguageFilterChange,
  onOpenStory,
  onResetStory,
}: {
  stories: Story[];
  progress: ProgressMap;
  languageFilter: LanguageFilter;
  onLanguageFilterChange: (language: LanguageFilter) => void;
  onOpenStory: (story: Story) => void;
  onResetStory: (storyId: string) => void;
}) {
  const filteredStories = stories.filter((story) => {
    if (languageFilter === 'all') {
      return true;
    }

    return getStoryLanguage(story) === languageFilter;
  });

  return (
    <main className="library-shell">
      <section className="library-heading" aria-labelledby="library-title">
        <p className="eyebrow">Bright Words</p>
        <h1 id="library-title">Pick a story</h1>
      </section>

      <div className="language-filter" aria-label="Filter stories by language">
        <button
          className={languageFilter === 'all' ? 'active-language-filter' : ''}
          type="button"
          onClick={() => onLanguageFilterChange('all')}
        >
          All
        </button>
        <button
          className={languageFilter === 'en-US' ? 'active-language-filter' : ''}
          type="button"
          onClick={() => onLanguageFilterChange('en-US')}
        >
          English
        </button>
        <button
          className={languageFilter === 'pt-BR' ? 'active-language-filter' : ''}
          type="button"
          onClick={() => onLanguageFilterChange('pt-BR')}
        >
          Portuguese
        </button>
      </div>

      <section className="story-grid" aria-label="Stories">
        {filteredStories.map((story) => {
          const storyProgress = progress[story.id];
          const isStarted = storyProgress && !storyProgress.completed;
          const isComplete = storyProgress?.completed;

          return (
            <article className="story-card" key={story.id}>
              <img src={story.coverImage} alt="" className="story-cover" />
              <div className="story-card-body">
                <div className="story-meta">
                  <span>{getLanguageLabel(story)}</span>
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
  const [audioStatus, setAudioStatus] = useState('');
  const [isShowingSyllables, setIsShowingSyllables] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFrameRef = useRef<number | null>(null);

  const currentPage = story.pages[pageIndex];
  const words = useMemo(() => splitWords(currentPage.paragraph), [currentPage.paragraph]);
  const activeWord = words[wordIndex] ?? '';
  const displayedWord = isShowingSyllables ? splitIntoSyllables(activeWord, story) : activeWord;

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

  const stopPageAudio = useCallback((shouldClearStatus = true) => {
    if (audioFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (shouldClearStatus) {
      setAudioStatus('');
    }
  }, []);

  const goToPage = useCallback(
    (nextPageIndex: number) => {
      stopPageAudio();
      const boundedPage = Math.min(Math.max(nextPageIndex, 0), story.pages.length - 1);
      setCompleted(false);
      setPageIndex(boundedPage);
      setWordIndex(0);
      persist(boundedPage, 0);
    },
    [persist, stopPageAudio, story.pages.length],
  );

  const previousWord = useCallback(() => {
    stopPageAudio();

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
  }, [completed, pageIndex, persist, stopPageAudio, story.pages, wordIndex]);

  const nextWord = useCallback(() => {
    stopPageAudio();

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
  }, [completed, pageIndex, persist, stopPageAudio, story.pages.length, wordIndex, words.length]);

  function rereadStory() {
    stopPageAudio();
    onResetStory(story.id);
    setCompleted(false);
    setPageIndex(0);
    setWordIndex(0);
  }

  async function playPageAudio() {
    if (!currentPage.audio) {
      setAudioStatus('Áudio indisponível');
      window.setTimeout(() => setAudioStatus(''), 1600);
      return;
    }

    try {
      stopPageAudio(false);
      const playbackPageIndex = pageIndex;
      const playbackWords = [...words];
      const audio = new Audio(currentPage.audio);
      audioRef.current = audio;

      let timeline: WordTiming[] = [];
      let lastHighlightedIndex = -1;

      const updateHighlightedWord = (nextWordIndex: number) => {
        if (lastHighlightedIndex === nextWordIndex) {
          return;
        }

        lastHighlightedIndex = nextWordIndex;
        setWordIndex(nextWordIndex);
        persist(playbackPageIndex, nextWordIndex);
      };

      const syncHighlight = () => {
        if (audioRef.current !== audio) {
          return;
        }

        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          if (timeline.length === 0) {
            timeline = buildWordTimeline(playbackWords, audio.duration);
          }

          updateHighlightedWord(getTimelineWordIndex(timeline, audio.currentTime));
        }

        if (!audio.paused && !audio.ended) {
          audioFrameRef.current = window.requestAnimationFrame(syncHighlight);
        }
      };

      audio.addEventListener('loadedmetadata', syncHighlight);
      audio.addEventListener('play', syncHighlight);
      audio.addEventListener('ended', () => {
        updateHighlightedWord(Math.max(playbackWords.length - 1, 0));
        if (audioFrameRef.current !== null) {
          window.cancelAnimationFrame(audioFrameRef.current);
          audioFrameRef.current = null;
        }
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        setAudioStatus('');
      });
      audio.addEventListener('error', () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        setAudioStatus('Áudio indisponível');
        window.setTimeout(() => setAudioStatus(''), 1600);
      });

      setAudioStatus('Lendo...');
      updateHighlightedWord(0);
      await audio.play();
    } catch {
      stopPageAudio(false);
      setAudioStatus('Toque novamente');
      window.setTimeout(() => setAudioStatus(''), 1600);
    }
  }

  useEffect(() => () => stopPageAudio(), [pageIndex, stopPageAudio, story.id]);

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
        <div className="reader-title">
          <p className="reader-kicker">{story.title}</p>
          <p className="reader-count">
            Page {pageIndex + 1} of {story.pages.length}
          </p>
        </div>
        <div className="reader-actions">
          <button
            className={`syllable-action-button ${isShowingSyllables ? 'active-syllable-action-button' : ''}`}
            type="button"
            onClick={() => setIsShowingSyllables((current) => !current)}
            aria-pressed={isShowingSyllables}
            aria-label={getSyllableToggleAriaLabel(story, isShowingSyllables)}
            title={getSyllableToggleAriaLabel(story, isShowingSyllables)}
          >
            <span className="syllable-checkmark" aria-hidden="true" />
            <span>Sílabas</span>
          </button>
        </div>
      </header>

      <button
        className="page-button page-button-left"
        type="button"
        onClick={previousWord}
        disabled={!completed && pageIndex === 0 && wordIndex === 0}
        aria-label="Previous word"
      >
        ‹
      </button>
      <button
        className="page-button page-button-right"
        type="button"
        onClick={nextWord}
        disabled={completed}
        aria-label="Next word"
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
          <div className="focus-reading-stack">
            <div className="focus-word-row">
              <button
                className="focus-word"
                style={{ '--word-scale': getWordScale(displayedWord) }}
                type="button"
                aria-pressed={isShowingSyllables}
              >
                {displayedWord}
              </button>
            </div>

            <div className="phrase-row">
              <div className="paragraph-strip" aria-label="Frase completa">
                {words.map((word, index) => (
                  <span className={index === wordIndex ? 'active-paragraph-word' : ''} key={`${word}-${index}`}>
                    {word}
                  </span>
                ))}
              </div>
              <button
                className="speaker-button phrase-speaker-button"
                type="button"
                onClick={playPageAudio}
                aria-label="Ler frase em voz alta"
                title="Ler frase em voz alta"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                  <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                  <path d="M16 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 6a8 8 0 0 1 0 12" />
                </svg>
              </button>
              {audioStatus && <span className="audio-status">{audioStatus}</span>}
            </div>
          </div>
        )}
      </section>

      {!completed && (
        <footer className="reader-footer">
          <div className="word-controls" aria-label="Page controls">
            <button
              className="secondary-button control-button"
              type="button"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              ‹ Page
            </button>
            <div className="word-progress">
              {pageIndex + 1} / {story.pages.length}
            </div>
            <button
              className="primary-button control-button"
              type="button"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex === story.pages.length - 1}
            >
              Page ›
            </button>
          </div>
        </footer>
      )}
    </main>
  );
}

function getWordScale(word: string) {
  const letters = Math.max(word.length, 1);
  return `${Math.min(16, Math.max(4.5, 92 / letters))}vw`;
}

function buildWordTimeline(words: string[], duration: number): WordTiming[] {
  if (words.length === 0) {
    return [];
  }

  const weights = words.map((word) => {
    const letters = Math.max(word.replace(/[^\p{L}\p{N}]/gu, '').length, 1);
    const punctuationPause = /[.!?:;]$/.test(word) ? 1.3 : /[,]$/.test(word) ? 0.65 : 0;
    return letters * 0.42 + 0.55 + punctuationPause;
  });
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let elapsed = 0;

  return weights.map((weight, index) => {
    elapsed += (weight / totalWeight) * duration;
    return { end: index === weights.length - 1 ? duration : elapsed };
  });
}

function getTimelineWordIndex(timeline: WordTiming[], currentTime: number) {
  if (timeline.length === 0) {
    return 0;
  }

  const index = timeline.findIndex((item) => currentTime <= item.end);
  return index === -1 ? timeline.length - 1 : index;
}

function getStorySlug(story: Story) {
  return story.slug || story.id;
}

function getStorySlugFromPath() {
  const match = window.location.pathname.match(/^\/stories\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getSyllableToggleAriaLabel(story: Story, isActive: boolean) {
  if (getStoryLanguage(story) === 'en-US') {
    return isActive ? 'Hide syllables' : 'Show syllables';
  }

  return isActive ? 'Ocultar sílabas' : 'Ativar sílabas';
}

function getStoryLanguage(story: Story): LanguageFilter {
  return story.language === 'en-US' ? 'en-US' : 'pt-BR';
}

function getLanguageLabel(story: Story) {
  return getStoryLanguage(story) === 'en-US' ? 'English' : 'Portuguese';
}
