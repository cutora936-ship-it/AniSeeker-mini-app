import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { Navigation, type Tab } from './components/Navigation';
import { characters, searchCharacters, type Character } from './data/characters';
import { useFavorites } from './hooks/useFavorites';
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
  const [activeIndex, setActiveIndex] = useState(0);
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
    if (detail) {
      setDetail(null);
    } else {
      setSearchOpen(false);
      setQuery('');
    }

    restoreActionFocus.current = true;
  }, [detail, activity, profileEditor]);

  const overlayOpen = Boolean(detail || searchOpen || profileEditor !== 'closed');
  const user = useTelegram(overlayOpen ? goBack : undefined);

  useEffect(() => {
    if (searchOpen && !detail) {
      searchInput.current?.focus({ preventScroll: true });
    } else if (!detail && restoreActionFocus.current) {
      actionButton.current?.focus({ preventScroll: true });
    }
    restoreActionFocus.current = false;
  }, [detail, searchOpen]);

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

  function changeTab(next: Tab) {
    setTab(next);
    setDetail(null);
    setActivity(null);
    setMatchPlaying(false);
    setProfileEditor('closed');
    setSearchOpen(false);
    setQuery('');
  }

  const favoriteCharacters = favoriteIds
    .map((id) => characters.find((character) => character.id === id))
    .filter((character): character is Character => Boolean(character));
  const results = searchOpen ? searchCharacters(characters, query) : [];
  const listProps = { favoriteIds, onFavorite: toggleFavorite, onOpen: setDetail };
  const availableActivity = detail?.observation ? 'match' : detail?.strategy ? 'strategy' : null;

  return (
    <div className={matchPlaying ? 'app app--match-playing' : 'app'}>
      <header className="topbar" data-theme={activity === 'match' ? 'crimson' : undefined}>
        {searchOpen && !detail ? (
          <div className="search-field glass" role="search">
            <Icon name="search" />
            <input ref={searchInput} type="search" inputMode="search" enterKeyHint="search"
              placeholder="Имя персонажа" aria-label="Поиск по имени персонажа"
              value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        ) : (
          <div className="wordmark" aria-label="AniSeeker">Ani<span>Seeker</span></div>
        )}
        {detail || searchOpen ? (
          <button key="back" type="button" className="icon-button glass topbar__action"
            aria-label={detail ? 'Вернуться' : 'Закрыть поиск'} onClick={goBack}>
            <Icon name={detail ? 'back' : 'close'} />
          </button>
        ) : (
          <button key="search" ref={actionButton} type="button" className="icon-button glass topbar__action"
            aria-label="Открыть поиск" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
          </button>
        )}
      </header>
      <main className="main">
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
          <Feed characters={characters} activeIndex={activeIndex} setActiveIndex={setActiveIndex}
            {...listProps} />
        )}
      </main>
      {!matchPlaying && <Navigation current={tab} onChange={changeTab} />}
    </div>
  );
}
