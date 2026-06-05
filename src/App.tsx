import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StoriesResponse, Story } from './types';
import { splitWords } from './storyUtils';
import { splitIntoSyllables } from './syllables';

type View = 'library' | 'mode-select' | 'reader';
type LanguageFilter = 'all' | 'en-US' | 'pt-BR';
type ReadingMode = 'read-aloud' | 'independent' | 'learning';
type ActiveSession = {
  storyId: string;
  mode: ReadingMode;
};
type WordTiming = {
  start?: number;
  end: number;
  text?: string;
};

export function App() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>('all');
  const [status, setStatus] = useState('Carregando histórias...');

  useEffect(() => {
    async function loadStories() {
      try {
        const response = await fetch('/data/stories.json');
        if (!response.ok) {
          throw new Error('Não foi possível carregar as histórias.');
        }

        const data = (await response.json()) as StoriesResponse;
        setStories(data.stories);
        setStatus('');
      } catch {
        setStatus('As histórias estão descansando um pouquinho. Atualize a página para tentar de novo.');
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
        setSelectedStoryId(null);
        setActiveSession(null);
        return;
      }

      const story = stories.find((candidate) => getStorySlug(candidate) === slug);
      setSelectedStoryId(story?.id ?? null);
      setActiveSession(null);
    }

    syncStoryFromPath();
    window.addEventListener('popstate', syncStoryFromPath);
    return () => window.removeEventListener('popstate', syncStoryFromPath);
  }, [stories]);

  const selectedStory = stories.find((story) => story.id === selectedStoryId) ?? null;
  const activeStory = stories.find((story) => story.id === activeSession?.storyId) ?? null;
  const view: View = activeSession && activeStory ? 'reader' : selectedStory ? 'mode-select' : 'library';

  useEffect(() => {
    updateDocumentShareMeta(selectedStory);
  }, [selectedStory]);

  function openStory(story: Story) {
    const nextPath = `/stories/${getStorySlug(story)}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setSelectedStoryId(story.id);
    setActiveSession(null);
  }

  function startReading(story: Story, mode: ReadingMode) {
    const nextPath = `/stories/${getStorySlug(story)}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }

    setSelectedStoryId(story.id);
    setActiveSession({ storyId: story.id, mode });
  }

  function backToLibrary() {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }

    setSelectedStoryId(null);
    setActiveSession(null);
  }

  function backToModeSelection() {
    setActiveSession(null);
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
          languageFilter={languageFilter}
          onLanguageFilterChange={setLanguageFilter}
          onOpenStory={openStory}
        />
      )}
      {view === 'mode-select' && selectedStory && (
        <StoryModeSelection story={selectedStory} onBackToLibrary={backToLibrary} onStartReading={startReading} />
      )}
      {view === 'reader' && activeStory && activeSession && (
        <StoryReader
          key={`${activeStory.id}-${activeSession.mode}`}
          story={activeStory}
          mode={activeSession.mode}
          onBackToLibrary={backToLibrary}
          onBackToModeSelection={backToModeSelection}
        />
      )}
    </>
  );
}

function StoryLibrary({
  stories,
  languageFilter,
  onLanguageFilterChange,
  onOpenStory,
}: {
  stories: Story[];
  languageFilter: LanguageFilter;
  onLanguageFilterChange: (language: LanguageFilter) => void;
  onOpenStory: (story: Story) => void;
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
        <p className="eyebrow">Palavras brilhantes</p>
        <h1 id="library-title">Escolha uma história</h1>
      </section>

      <div className="language-filter" aria-label="Filtrar histórias por idioma">
        <button
          className={languageFilter === 'all' ? 'active-language-filter' : ''}
          type="button"
          onClick={() => onLanguageFilterChange('all')}
        >
          Todas
        </button>
        <button
          className={languageFilter === 'en-US' ? 'active-language-filter' : ''}
          type="button"
          onClick={() => onLanguageFilterChange('en-US')}
        >
          Inglês
        </button>
        <button
          className={languageFilter === 'pt-BR' ? 'active-language-filter' : ''}
          type="button"
          onClick={() => onLanguageFilterChange('pt-BR')}
        >
          Português
        </button>
      </div>

      <section className="story-grid" aria-label="Histórias">
        {filteredStories.map((story) => (
          <article className="story-card" key={story.id}>
            <img src={story.coverImage} alt="" className="story-cover" />
            <div className="story-card-body">
              <div className="story-meta">
                <span>{getLanguageLabel(story)}</span>
                <span>{getLevelLabel(story)}</span>
              </div>
              <h2>{story.title}</h2>
              <p>{story.description}</p>
              <div className="story-actions">
                <button className="primary-button" type="button" onClick={() => onOpenStory(story)}>
                  Escolher modo
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function StoryModeSelection({
  story,
  onBackToLibrary,
  onStartReading,
}: {
  story: Story;
  onBackToLibrary: () => void;
  onStartReading: (story: Story, mode: ReadingMode) => void;
}) {
  return (
    <main className="mode-shell">
      <section className="mode-panel" aria-labelledby="mode-title">
        <button className="text-button mode-back-button" type="button" onClick={onBackToLibrary}>
          ‹ Histórias
        </button>
        <img src={story.coverImage} alt="" className="mode-cover" />
        <div className="mode-copy">
          <p className="eyebrow">{story.title}</p>
          <h1 id="mode-title">Como vamos ler?</h1>
          <p>{story.description}</p>
        </div>
        <div className="mode-options">
          <button className="mode-option mode-option-primary" type="button" onClick={() => onStartReading(story, 'read-aloud')}>
            <span className="mode-icon mode-icon-read-aloud" aria-hidden="true">
              <span className="story-buddy story-buddy-audio">
                <span className="buddy-headphone-band" />
                <span className="buddy-ear buddy-ear-left" />
                <span className="buddy-ear buddy-ear-right" />
                <span className="buddy-face">
                  <span className="buddy-eye buddy-eye-left" />
                  <span className="buddy-eye buddy-eye-right" />
                  <span className="buddy-smile" />
                </span>
                <span className="buddy-sound buddy-sound-one" />
                <span className="buddy-sound buddy-sound-two" />
              </span>
            </span>
            <span className="mode-option-copy">
              <span>Leia para mim</span>
              <small>O app narra a história inteira e vira as páginas sozinho.</small>
            </span>
          </button>
          <button className="mode-option" type="button" onClick={() => onStartReading(story, 'independent')}>
            <span className="mode-icon mode-icon-independent" aria-hidden="true">
              <span className="story-buddy story-buddy-book">
                <span className="buddy-book buddy-book-left">
                  <span className="book-line book-line-one" />
                  <span className="book-line book-line-two" />
                </span>
                <span className="buddy-book buddy-book-right">
                  <span className="book-eye book-eye-left" />
                  <span className="book-eye book-eye-right" />
                  <span className="book-smile" />
                </span>
                <span className="buddy-star" />
              </span>
            </span>
            <span className="mode-option-copy">
              <span>Eu consigo ler</span>
              <small>Para ler sozinho ou junto com a família, página por página.</small>
            </span>
          </button>
          <button className="mode-option" type="button" onClick={() => onStartReading(story, 'learning')}>
            <span className="mode-icon mode-icon-learning" aria-hidden="true">
              <span className="story-buddy story-buddy-letter">
                <span className="letter-card">
                  <span className="letter-a">A</span>
                  <span className="letter-smile" />
                </span>
                <span className="letter-syllable letter-syllable-one" />
                <span className="letter-syllable letter-syllable-two" />
                <span className="buddy-star buddy-star-small" />
              </span>
            </span>
            <span className="mode-option-copy">
              <span>Aprender a ler</span>
              <small>Mostra uma palavra grande por vez, com sílabas e áudio de apoio.</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}

function StoryReader({
  story,
  mode,
  onBackToLibrary,
  onBackToModeSelection,
}: {
  story: Story;
  mode: ReadingMode;
  onBackToLibrary: () => void;
  onBackToModeSelection: () => void;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [audioStatus, setAudioStatus] = useState('');
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [isShowingSyllables, setIsShowingSyllables] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioFrameRef = useRef<number | null>(null);
  const isAudioPausedRef = useRef(false);

  const isLearningMode = mode === 'learning';
  const isIndependentMode = mode === 'independent';
  const isReadAloudMode = mode === 'read-aloud';
  const currentPage = story.pages[pageIndex];
  const words = useMemo(() => splitWords(currentPage.paragraph), [currentPage.paragraph]);
  const activeWord = words[wordIndex] ?? '';
  const displayedWord = isShowingSyllables ? splitIntoSyllables(activeWord, story) : activeWord;

  useEffect(() => {
    isAudioPausedRef.current = isAudioPaused;
  }, [isAudioPaused]);

  const stopPageAudio = useCallback((shouldClearStatus = true) => {
    if (audioFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsAudioPaused(false);

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
    },
    [stopPageAudio, story.pages.length],
  );

  const previousPage = useCallback(() => {
    if (completed) {
      setCompleted(false);
      setPageIndex(story.pages.length - 1);
      setWordIndex(0);
      return;
    }

    goToPage(pageIndex - 1);
  }, [completed, goToPage, pageIndex, story.pages.length]);

  const nextPage = useCallback(() => {
    if (completed) {
      return;
    }

    if (pageIndex < story.pages.length - 1) {
      goToPage(pageIndex + 1);
      return;
    }

    stopPageAudio();
    setCompleted(true);
  }, [completed, goToPage, pageIndex, stopPageAudio, story.pages.length]);

  const previousWord = useCallback(() => {
    stopPageAudio();

    if (completed) {
      setCompleted(false);
      const lastPageIndex = story.pages.length - 1;
      const lastWords = splitWords(story.pages[lastPageIndex].paragraph);
      setPageIndex(lastPageIndex);
      setWordIndex(Math.max(lastWords.length - 1, 0));
      return;
    }

    if (wordIndex > 0) {
      setWordIndex(wordIndex - 1);
      return;
    }

    if (pageIndex > 0) {
      const nextPageIndex = pageIndex - 1;
      const previousPageWords = splitWords(story.pages[nextPageIndex].paragraph);
      setPageIndex(nextPageIndex);
      setWordIndex(Math.max(previousPageWords.length - 1, 0));
    }
  }, [completed, pageIndex, stopPageAudio, story.pages, wordIndex]);

  const nextWord = useCallback(() => {
    stopPageAudio();

    if (completed) {
      return;
    }

    if (wordIndex < words.length - 1) {
      setWordIndex(wordIndex + 1);
      return;
    }

    if (pageIndex < story.pages.length - 1) {
      setPageIndex(pageIndex + 1);
      setWordIndex(0);
      return;
    }

    setCompleted(true);
  }, [completed, pageIndex, stopPageAudio, story.pages.length, wordIndex, words.length]);

  const rereadStory = useCallback(() => {
    stopPageAudio();
    setCompleted(false);
    setPageIndex(0);
    setWordIndex(0);
  }, [stopPageAudio]);

  const playPageAudio = useCallback(
    async (shouldAutoAdvance = false) => {
      if (!currentPage.audio) {
        setAudioStatus('Áudio indisponível');
        window.setTimeout(() => setAudioStatus(''), 1600);
        return;
      }

      try {
        stopPageAudio(false);
        const playbackPageIndex = pageIndex;
        const playbackWords = [...words];
        const playbackTimings = currentPage.audioTimings
          ? await fetchAudioTimings(currentPage.audioTimings)
          : [];
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
        };

        const syncHighlight = () => {
          if (audioRef.current !== audio) {
            return;
          }

          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            if (timeline.length === 0) {
              timeline =
                playbackTimings.length === playbackWords.length
                  ? playbackTimings
                  : buildWordTimeline(playbackWords, audio.duration);
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
          setIsAudioPaused(false);
          setAudioStatus('');

          if (!shouldAutoAdvance) {
            return;
          }

          if (playbackPageIndex < story.pages.length - 1) {
            setPageIndex(playbackPageIndex + 1);
            setWordIndex(0);
            return;
          }

          setCompleted(true);
        });
        audio.addEventListener('error', () => {
          if (audioRef.current === audio) {
            audioRef.current = null;
          }
          setAudioStatus('Áudio indisponível');
          window.setTimeout(() => setAudioStatus(''), 1600);
        });

        setAudioStatus('Lendo...');
        setIsAudioPaused(false);
        updateHighlightedWord(0);
        await audio.play();
      } catch {
        stopPageAudio(false);
        setIsAudioPaused(false);
        setAudioStatus('Toque novamente');
        window.setTimeout(() => setAudioStatus(''), 1600);
      }
    },
    [currentPage.audio, currentPage.audioTimings, pageIndex, stopPageAudio, story.pages.length, words],
  );

  const pauseOrResumeReadAloud = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      void playPageAudio(true);
      return;
    }

    if (audio.paused) {
      void audio
        .play()
        .then(() => {
          setIsAudioPaused(false);
          setAudioStatus('Lendo...');
        })
        .catch(() => {
          setAudioStatus('Toque novamente');
          window.setTimeout(() => setAudioStatus(''), 1600);
        });
      return;
    }

    audio.pause();
    if (audioFrameRef.current !== null) {
      window.cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }
    setIsAudioPaused(true);
    setAudioStatus('Pausado');
  }, [playPageAudio]);

  useEffect(() => () => stopPageAudio(), [pageIndex, mode, stopPageAudio, story.id]);

  useEffect(() => {
    if (!isReadAloudMode || completed || isAudioPausedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void playPageAudio(true);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [completed, isReadAloudMode, pageIndex, playPageAudio]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (isLearningMode) {
          previousWord();
          return;
        }
        previousPage();
      }

      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (isLearningMode) {
          nextWord();
          return;
        }
        nextPage();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLearningMode, nextPage, nextWord, previousPage, previousWord]);

  return (
    <main className={`reader-shell mode-${mode}`}>
      <img className="reader-image" src={currentPage.image} alt={currentPage.alt} />
      <div className="reader-scrim" />

      <header className="reader-topbar">
        <button className="round-button home-button" type="button" onClick={onBackToModeSelection} aria-label="Voltar para modos">
          ‹
        </button>
        <div className="reader-title">
          <p className="reader-kicker">{story.title}</p>
          <p className="reader-count">
            {getModeLabel(mode)} · Página {pageIndex + 1} de {story.pages.length}
          </p>
        </div>
        {isLearningMode && (
          <div className="reader-actions">
            <button
              className={`syllable-action-button ${isShowingSyllables ? 'active-syllable-action-button' : ''}`}
              type="button"
              onClick={() => setIsShowingSyllables((current) => !current)}
              aria-pressed={isShowingSyllables}
              aria-label={getSyllableToggleAriaLabel(isShowingSyllables)}
              title={getSyllableToggleAriaLabel(isShowingSyllables)}
            >
              <span className="syllable-checkmark" aria-hidden="true" />
              <span>Sílabas</span>
            </button>
          </div>
        )}
      </header>

      <button
        className="page-button page-button-left"
        type="button"
        onClick={isLearningMode ? previousWord : previousPage}
        disabled={!completed && pageIndex === 0 && (isLearningMode ? wordIndex === 0 : true)}
        aria-label={isLearningMode ? 'Palavra anterior' : 'Página anterior'}
      >
        ‹
      </button>
      <button
        className="page-button page-button-right"
        type="button"
        onClick={isLearningMode ? nextWord : nextPage}
        disabled={completed}
        aria-label={isLearningMode ? 'Próxima palavra' : 'Próxima página'}
      >
        ›
      </button>

      <section className="focus-stage" aria-live="polite">
        {completed ? (
          <div className="completion-panel">
            <p className="eyebrow">Muito bem</p>
            <h1>Você terminou {story.title}!</h1>
            <div className="completion-actions">
              <button className="primary-button" type="button" onClick={rereadStory}>
                Ler de novo
              </button>
              <button className="secondary-button" type="button" onClick={onBackToLibrary}>
                Histórias
              </button>
            </div>
          </div>
        ) : (
          <div className={`focus-reading-stack ${isIndependentMode ? 'independent-reading-stack' : ''}`}>
            {isLearningMode && (
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
            )}

            <div className={`phrase-row ${isLearningMode ? '' : 'phrase-row-readable'}`}>
              <div className="paragraph-strip" aria-label="Frase completa">
                {words.map((word, index) => (
                  <span
                    className={!isIndependentMode && index === wordIndex ? 'active-paragraph-word' : ''}
                    key={`${word}-${index}`}
                  >
                    {word}
                  </span>
                ))}
              </div>
              {audioStatus && !isIndependentMode && <span className="audio-status">{audioStatus}</span>}
            </div>
          </div>
        )}
      </section>

      {!completed && (
        <footer className="reader-footer">
          <div className="word-controls" aria-label="Controles de página">
            <button
              className="secondary-button control-button"
              type="button"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              Anterior
            </button>
            {isReadAloudMode ? (
              <button
                className="primary-button control-button playback-button"
                type="button"
                onClick={pauseOrResumeReadAloud}
                aria-label={isAudioPaused ? 'Retomar leitura' : 'Pausar leitura'}
                title={isAudioPaused ? 'Retomar leitura' : 'Pausar leitura'}
              >
                <span className={`playback-icon ${isAudioPaused ? 'playback-icon-play' : 'playback-icon-pause'}`} aria-hidden="true">
                  {isAudioPaused ? (
                    <span className="playback-triangle" />
                  ) : (
                    <>
                      <span className="playback-bar" />
                      <span className="playback-bar" />
                    </>
                  )}
                </span>
              </button>
            ) : (
              <div className="word-progress">
                {pageIndex + 1} / {story.pages.length}
              </div>
            )}
            <button
              className="primary-button control-button"
              type="button"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={pageIndex === story.pages.length - 1}
            >
              Próxima
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

async function fetchAudioTimings(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Não foi possível carregar a sincronização do áudio.');
  }

  return (await response.json()) as WordTiming[];
}

function getTimelineWordIndex(timeline: WordTiming[], currentTime: number) {
  if (timeline.length === 0) {
    return 0;
  }

  if (currentTime <= (timeline[0].start ?? 0)) {
    return 0;
  }

  for (let index = 0; index < timeline.length; index += 1) {
    const current = timeline[index];
    const next = timeline[index + 1];

    if (currentTime >= (current.start ?? 0) && currentTime <= current.end) {
      return index;
    }

    if (next && currentTime > current.end && currentTime < (next.start ?? current.end)) {
      return index;
    }
  }

  return timeline.length - 1;
}

function getStorySlug(story: Story) {
  return story.slug || story.id;
}

function getStorySlugFromPath() {
  const match = window.location.pathname.match(/^\/stories\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function updateDocumentShareMeta(story: Story | null) {
  const defaultTitle = 'Palavras Brilhantes';
  const defaultDescription = 'Historias infantis interativas para ler, ouvir e aprender no seu ritmo.';
  const title = story ? `${story.title} | Palavras Brilhantes` : defaultTitle;
  const description = story?.description || defaultDescription;
  const image = story?.coverImage || '/stories/tres-porquinhos/cover.png';
  const url = story ? `/stories/${getStorySlug(story)}` : '/';

  document.title = title;
  setMetaContent('name', 'description', description);
  setMetaContent('property', 'og:title', title);
  setMetaContent('property', 'og:description', description);
  setMetaContent('property', 'og:image', toAbsoluteUrl(image));
  setMetaContent('property', 'og:url', toAbsoluteUrl(url));
  setMetaContent('name', 'twitter:title', title);
  setMetaContent('name', 'twitter:description', description);
  setMetaContent('name', 'twitter:image', toAbsoluteUrl(image));
}

function setMetaContent(attribute: 'name' | 'property', key: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }

  meta.content = content;
}

function toAbsoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, window.location.origin).toString();
}

function getSyllableToggleAriaLabel(isActive: boolean) {
  return isActive ? 'Ocultar sílabas' : 'Ativar sílabas';
}

function getStoryLanguage(story: Story): LanguageFilter {
  return story.language === 'en-US' ? 'en-US' : 'pt-BR';
}

function getLanguageLabel(story: Story) {
  return getStoryLanguage(story) === 'en-US' ? 'Inglês' : 'Português';
}

function getLevelLabel(story: Story) {
  const normalizedLevel = story.level.toLowerCase();

  if (normalizedLevel === 'beginner' || normalizedLevel === 'early') {
    return 'iniciante';
  }

  return story.level;
}

function getModeLabel(mode: ReadingMode) {
  if (mode === 'read-aloud') {
    return 'Leia para mim';
  }

  if (mode === 'independent') {
    return 'Eu consigo ler';
  }

  return 'Aprender a ler';
}
