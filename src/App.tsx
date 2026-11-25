import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Icon } from './components/Icon';
import { Navigation, type Tab } from './components/Navigation';
import { characters, searchCharacters, type Character } from './data/characters';
import { useFavorites } from './hooks/useFavorites';
import { usePageMotion } from './motion/usePageMotion';
import { useTelegram } from './platform/telegram';
import type { ProfileEditorState } from './profile/ProfileEditor';
import { CharacterDetail } from './screens/CharacterDetail';
import { Feed } from './screens/Feed';
import { CharacterList, EmptyState } from './screens/Library';
import { Profile } from './screens/Profile';

const Strategy = lazy(() => import('./screens/Strategy'));
const MatchGame = lazy(() => import('./screens/MatchGame'));

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Character | null>(null);
  const [activity, setActivity] = useState<'strategy' | 'match' | null>(null);
  const [matchPlaying, setMatchPlaying] = useState(false);
  const [profileEditor, setProfileEditor] = useState<ProfileEditorState>('closed');
  const { favoriteIds, toggleFavorite } = useFavorites();
  const searchInput = useRef<HTMLInputElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const restoreActionFocus = useRef(false);
  const feedIndex = useRef(0);
  const searchShown = searchOpen && !detail;
  const main = usePageMotion(activity ?? (detail ? 'detail' : searchShown ? 'search' : tab));

  const goBack = useCallback(() => {
    if (profileEditor !== 'closed') {
      if (profileEditor === 'editing') setProfileEditor('closed');
      return;
    }
    if (activity) {
      setActivity(null);
      setMatchPlaying(false);
      return;
    }
    restoreActionFocus.current = true;
    if (detail) {
      setDetail(null);
    } else {
      setSearchOpen(false);
      setQuery('');
    }
  }, [detail, activity, profileEditor]);

  const overlayOpen = Boolean(detail || searchOpen || profileEditor !== 'closed');
  const user = useTelegram(overlayOpen ? goBack : undefined);

  useLayoutEffect(() => {
    if (searchShown) {
      searchInput.current?.focus({ preventScroll: true });
    } else if (!detail && restoreActionFocus.current) {
      actionButton.current?.focus({ preventScroll: true });
    }
    restoreActionFocus.current = false;
  }, [detail, searchShown]);

  useEffect(() => {
    if (!overlayOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [goBack, overlayOpen]);

  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    setDetail(null);
    setActivity(null);
    setMatchPlaying(false);
    setProfileEditor('closed');
    setSearchOpen(false);
    setQuery('');
  }, []);

  const rememberFeedIndex = useCallback((index: number) => {
    feedIndex.current = index;
  }, []);

  function openSearch() {
    // Commit the input before the tap loses activation in mobile WebViews.
    flushSync(() => setSearchOpen(true));
  }

  const favoriteCharacters = useMemo(() => favoriteIds
    .map((id) => characters.find((character) => character.id === id))
    .filter((character): character is Character => Boolean(character)), [favoriteIds]);
  const results = searchShown ? searchCharacters(characters, query) : [];
  const listProps = {
    favoriteIds,
    onFavorite: toggleFavorite,
    onOpen: setDetail,
  };
  const availableActivity = detail?.observation ? 'match' : detail?.strategy ? 'strategy' : null;

  return (
    <div className={matchPlaying ? 'app app--match-playing' : 'app'} data-search={searchShown}>
      <header className="topbar" data-theme={activity === 'match' ? 'crimson' : undefined}>
        <div className="topbar__leading">
          <div className="wordmark" aria-label="AniSeeker" aria-hidden={searchShown}>Ani<span>Seeker</span></div>
          <div className="search-field glass" role="search" inert={!searchShown} aria-hidden={!searchShown}>
            <Icon name="search" />
            <input ref={searchInput} type="search" inputMode="search" enterKeyHint="search"
              placeholder="Имя персонажа" aria-label="Поиск по имени персонажа"
              value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        {detail || searchOpen ? (
          <button key="back" type="button" className="icon-button glass topbar__action"
            aria-label={detail ? 'Вернуться' : 'Закрыть поиск'} onClick={goBack}>
            <Icon name={detail ? 'back' : 'close'} />
          </button>
        ) : (
          <button key="search" ref={actionButton} type="button" className="icon-button glass topbar__action"
            aria-label="Открыть поиск" onClick={openSearch}>
            <Icon name="search" />
          </button>
        )}
      </header>
      <main className="main" ref={main}>
        {detail ? (
          <>
            <CharacterDetail character={detail} hidden={activity !== null}
              onOpenActivity={availableActivity ? () => setActivity(availableActivity) : undefined} />
            {activity && (
              <Suspense fallback={<p className="subscreen" role="status">Загрузка тренажёра…</p>}>
                {activity === 'strategy' ? <Strategy onBack={goBack} /> : (
                  <MatchGame onBack={goBack} onPlayingChange={setMatchPlaying} />
                )}
              </Suspense>
            )}
          </>
        ) : searchOpen ? (
          <section className="subscreen" aria-labelledby="search-title">
            <h1 id="search-title">Поиск</h1>
            {results.length ? (
              <CharacterList characters={results} {...listProps} />
            ) : (
              <EmptyState icon="search" title="Персонажи не найдены">
                Попробуйте изменить запрос.
              </EmptyState>
            )}
          </section>
        ) : tab === 'favorites' ? (
          <section className="subscreen" aria-labelledby="favorites-title">
            <h1 id="favorites-title">Избранное</h1>
            {favoriteCharacters.length ? (
              <CharacterList characters={favoriteCharacters} {...listProps} />
            ) : (
              <EmptyState icon="bookmark" title="Здесь пока пусто">
                Сохраните персонажа, чтобы вернуться к его досье.
              </EmptyState>
            )}
          </section>
        ) : tab === 'profile' ? (
          <Profile user={user} editor={profileEditor} onEditorChange={setProfileEditor} />
        ) : (
          <Feed characters={characters} initialIndex={feedIndex.current} onIndexChange={rememberFeedIndex}
            {...listProps} />
        )}
      </main>
      {!matchPlaying && <Navigation current={tab} onChange={changeTab} />}
    </div>
  );
}
