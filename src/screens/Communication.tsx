import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { newRun, replay, skills, takeChoice, type Message, type Run } from '../communication/engine';
import { readSave, writeSave, type Saved } from '../communication/storage';
import type { Role, Story } from '../communication/types';
import { stories } from '../data/communication';
import './Communication.css';

type State = ReturnType<typeof replay>;
type View = 'home' | 'choose' | 'chat' | 'archive' | 'review';
const clock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

function Confirm({ title, children, cancel, confirm, action, cancelLabel }: {
  title: string; children: ReactNode; cancel: () => void; confirm: () => void; action: string; cancelLabel: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);
  return (
    <dialog ref={dialog} className="communication-dialog surface" data-theme="blue"
      aria-labelledby="communication-confirm-title" onKeyDown={(event) => {
        if (event.key === 'Escape') event.stopPropagation();
      }} onCancel={(event) => { event.preventDefault(); cancel(); }}>
      <h2 id="communication-confirm-title">{title}</h2>
      <p>{children}</p>
      <button className="communication-button communication-button--primary" type="button" onClick={cancel}>{cancelLabel}</button>
      <button className="communication-button surface" type="button" onClick={confirm}>{action}</button>
    </dialog>
  );
}

const Bubble = memo(function Bubble({ message, name }: { message: Message; name: string }) {
  return (
    <li className="communication-message" data-by={message.by}>
      <span className="communication-sr">{message.by === 'player' ? 'Твой персонаж' : name}. </span>
      <p>{message.text}</p>
      <time>{clock.format(message.at)}</time>
    </li>
  );
});

function Chat({ story, run, state, onChoice, onReview }: {
  story: Story; run: Run; state: State; onChoice: (index: number) => void; onReview: () => void;
}) {
  const [shown, setShown] = useState(state.guide);
  const [limit, setLimit] = useState(26);
  const thread = useRef<HTMLDivElement>(null);
  const earlierAnchor = useRef<{ height: number; top: number }>(null);
  const revealing = shown < state.history.length;
  const skip = () => setShown(state.history.length);
  const first = Math.max(0, shown - limit);

  useEffect(() => {
    if (!revealing) return;
    const timer = window.setTimeout(() => setShown(shown + 1), shown === state.guide ? 320 : 260);
    return () => window.clearTimeout(timer);
  }, [revealing, shown, state.guide]);

  useLayoutEffect(() => {
    const element = thread.current;
    if (!element) return;
    const anchor = earlierAnchor.current;
    element.scrollTop = anchor ? anchor.top + element.scrollHeight - anchor.height : element.scrollHeight;
    earlierAnchor.current = null;
  }, [shown, limit]);

  function showEarlier() {
    const element = thread.current;
    if (!element) return;
    earlierAnchor.current = { height: element.scrollHeight, top: element.scrollTop };
    setLimit((count) => count + 26);
  }

  return (
    <div className="communication-chat">
      <header className="communication-contact">
        <img src={story.person.avatar} alt="" width={42} height={42} />
        <div><h1>{story.person.name}</h1><p>Глава {run.openedChapter + 1} · {story.chapters[run.openedChapter]}</p></div>
      </header>
      <div className="communication-thread" ref={thread} role="region" tabIndex={0} aria-label="Переписка">
        {first > 0 && <button type="button" className="communication-earlier" onClick={showEarlier}>Показать более ранние сообщения</button>}
        <ol aria-label="Сообщения" aria-live="polite" aria-relevant="additions">
          {state.history.slice(first, shown).map((message, index) => <Bubble key={first + index} name={story.person.name} message={message} />)}
        </ol>
      </div>
      <div className="communication-replies">
        {revealing ? (
          <button type="button" className="communication-typing" onClick={skip}>
            <span aria-hidden="true">···</span> Печатает <strong>Показать сразу</strong>
          </button>
        ) : state.gate ? (
          <button className="communication-button communication-button--primary" type="button" onClick={onReview}>
            Разбор главы <Icon name="right" />
          </button>
        ) : (
          <div className="communication-options" role="group" aria-label="Варианты ответа">
            {state.next?.choices.map((choice, index) => (
              <button type="button" key={index} className="communication-reply surface" onClick={() => onChoice(index)}>
                {choice.text}<Icon name="right" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Review({ story, state, chapter }: { story: Story; state: State; chapter?: number }) {
  const chosen = chapter === undefined ? state.chosen : state.chosen.filter((item) => item.chapter === chapter);
  return (
    <section className="communication-review" aria-label="Разбор ответов">
      <p className="communication-meta">Разбор опирается на реплики в этой истории.</p>
      {Object.entries(skills).map(([id, label]) => {
        const examples = chosen.filter(({ choice }) => choice.note?.skill === id);
        const keep = examples.find(({ choice }) => !choice.note?.revise);
        const rethink = examples.find(({ choice }) => choice.note?.revise);
        return (
          <details className="communication-review__item surface" key={id}>
            <summary>{label}{examples.length > 0 && <span>{examples.length}</span>}</summary>
            {keep && <div><strong>Что сработало</strong><blockquote>{keep.choice.text}</blockquote><p>{keep.choice.note?.text}</p></div>}
            {rethink && <div><strong>Что можно изменить</strong><blockquote>{rethink.choice.text}</blockquote><p>{rethink.choice.note?.text}</p></div>}
            {!keep && !rethink && <p>Для этого навыка в разборе пока нет отмеченных реплик.</p>}
          </details>
        );
      })}
      {chapter !== undefined && (
        <details className="communication-review__item surface">
          <summary>Переписка главы</summary>
          <ol className="communication-transcript">
            {state.history.filter((message) => message.chapter === chapter).map((message, index) => (
              <Bubble key={index} name={story.person.name} message={message} />
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

export default function Communication({ onBack }: { onBack: () => void }) {
  const [save, setSave] = useState(() => readSave(stories));
  const [view, setView] = useState<View>(() => save.run ? 'home' : 'choose');
  const [role, setRole] = useState<Role | null>(() => save.run?.role ?? null);
  const [archived, setArchived] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<'restart' | number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const run = save.run;
  const story = run ? stories[run.role] : undefined;
  const state = useMemo(() => story && run ? replay(story, run) : null, [story, run]);
  const completed = run && state ? run.openedChapter + Number(state.gate) : 0;
  const chapter = archived ?? run?.openedChapter ?? 0;
  const currentView = view === 'chat' && run?.finished ? 'review' : view;
  const ending = currentView === 'review' && archived === null && run?.finished ? state?.ending : undefined;

  useLayoutEffect(() => {
    panel.current?.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [currentView, archived, ending]);

  function update(next: Saved) {
    setSave(writeSave(next, next.run ? stories[next.run.role] : undefined));
  }

  function start() {
    if (!role) return;
    update({ ...save, run: newRun(role) });
    setArchived(null);
    setView('chat');
  }

  function send(index: number) {
    if (!story || !run) return;
    const next = takeChoice(story, run, index);
    if (next !== run) update({ ...save, run: next });
    setConfirm(null);
  }

  function nextChapter() {
    if (!run || !state) return;
    if (state.ending) {
      if (run.finished) return;
      const endingId = state.ending;
      const known = save.endings.some((item) => item.role === run.role && item.ending === endingId);
      update({
        ...save,
        run: { ...run, finished: true },
        endings: known ? save.endings : [...save.endings, {
          role: run.role, ending: endingId, decisions: run.decisions.length, completedAt: Date.now(),
        }],
      });
    } else if (state.next) {
      update({ ...save, run: { ...run, openedChapter: state.next.chapter } });
      setView('chat');
    }
  }

  const title = currentView === 'archive' ? 'Пройденные главы'
    : ending && story ? story.endings[ending].title
      : currentView === 'review' && story ? story.chapters[chapter]
        : 'Неожиданное сообщение';

  return (
    <section className="subscreen communication" data-theme="blue" data-view={currentView}
      aria-label="Искусство общения" ref={panel}>
      {currentView !== 'chat' && <h1 ref={heading} tabIndex={-1}>{title}</h1>}

      {(currentView === 'home' || currentView === 'choose') && (
        <p className="communication-meta">Вымышленная интерактивная история. Все реплики Алисы и Алекса написаны заранее.</p>
      )}

      {currentView === 'choose' && (
        <>
          <p className="communication-premise">Вчера вы познакомились у Ники. Сегодня приходит сообщение, с которого начинается ваша история.</p>
          <fieldset className="communication-roles">
            <legend>Пол игрового персонажа</legend>
            {(['male', 'female'] as const).map((option) => (
              <label key={option} className="communication-role surface">
                <input type="radio" name="communication-role" checked={role === option} onChange={() => setRole(option)} />
                <img src={stories[option].person.avatar} width={48} height={48} alt="" />
                <span><strong>{option === 'male' ? 'Мужской' : 'Женский'}</strong><small>Переписка с {option === 'male' ? 'Алисой' : 'Алексом'}</small></span>
              </label>
            ))}
          </fieldset>
          {role && <p className="communication-meta">{stories[role].person.detail}</p>}
          {role && <button type="button" className="communication-button communication-button--primary" onClick={start}>Начать историю <Icon name="right" /></button>}
          {run && <button type="button" className="communication-button surface" onClick={() => setView('home')}>К сохранённой истории</button>}
        </>
      )}

      {currentView === 'home' && run && story && (
        <>
          <div className="communication-contact communication-contact--home surface">
            <img src={story.person.avatar} width={48} height={48} alt="" />
            <div><h2>{story.person.name}</h2><p>{run.finished ? 'История завершена' : `Глава ${run.openedChapter + 1} из ${story.chapters.length}`}</p></div>
          </div>
          <button type="button" className="communication-button communication-button--primary" onClick={() => setView('chat')}>
            {run.finished ? 'Открыть итоги' : 'Продолжить историю'} <Icon name="right" />
          </button>
          <button type="button" className="communication-button surface" onClick={() => setConfirm('restart')}>Начать заново</button>
          <button type="button" className="communication-button surface" onClick={() => setView('archive')}>Пройденные главы</button>
        </>
      )}

      {currentView === 'chat' && state && run && story && (
        <>
          <p className="communication-fiction">Вымышленная переписка · заранее написанный сюжет</p>
          <Chat key={`${run.started}-${run.openedChapter}-${run.decisions.length}`} story={story} run={run} state={state}
            onChoice={(choice) => state.next?.choices[choice].warning ? setConfirm(choice) : send(choice)}
            onReview={() => setView('review')} />
        </>
      )}

      {currentView === 'archive' && story && (
        <>
          {completed === 0 && <p className="communication-meta">Здесь появятся главы после прохождения.</p>}
          <ol className="communication-chapters">
            {story.chapters.slice(0, completed).map((name, index) => (
              <li key={name}><button type="button" className="communication-button surface" onClick={() => {
                setArchived(index);
                setView('review');
              }}><span>{index + 1}. {name}</span><Icon name="right" /></button></li>
            ))}
          </ol>
          {save.endings.length > 0 && <section className="communication-endings">
            <h2>Открытые концовки</h2>
            <ul>{save.endings.map(({ role, ending }) => (
              <li key={`${role}-${ending}`}>{stories[role].person.name} · {stories[role].endings[ending].title}</li>
            ))}</ul>
          </section>}
          <button type="button" className="communication-button surface" onClick={() => setView('home')}>К истории</button>
        </>
      )}

      {currentView === 'review' && story && state && (
        <>
          {ending ? <p className="communication-ending surface">{story.endings[ending].text}</p>
            : <p className="communication-meta">Глава {chapter + 1} · Разбор решений</p>}
          <Review story={story} state={state} chapter={ending ? undefined : chapter} />
          <div className="communication-review-actions">
            {archived !== null ? (
              <button type="button" className="communication-button surface" onClick={() => {
                setArchived(null);
                setView('archive');
              }}>К списку глав</button>
            ) : ending ? (
              <>
                <button type="button" className="communication-button communication-button--primary" onClick={() => setView('archive')}>Пройденные главы</button>
                <button type="button" className="communication-button surface" onClick={() => setConfirm('restart')}>Начать заново</button>
                <button type="button" className="communication-button surface" onClick={onBack}>Вернуться к персонажу</button>
              </>
            ) : (
              <>
                <button type="button" className="communication-button communication-button--primary" onClick={nextChapter}>
                  {state.ending ? 'Открыть финал' : 'Следующая глава'} <Icon name="right" />
                </button>
                <button type="button" className="communication-button surface" onClick={() => setView('home')}>К истории</button>
              </>
            )}
          </div>
        </>
      )}

      {confirm === 'restart' && <Confirm title="Начать заново?" cancelLabel="Сохранить прохождение" action="Выбрать персонажа"
        cancel={() => setConfirm(null)} confirm={() => { setConfirm(null); setView('choose'); }}>
        Новая история заменит текущую переписку. Открытые концовки сохранятся.
      </Confirm>}
      {typeof confirm === 'number' && <Confirm title="Может, передумаешь?" cancelLabel="Выбрать другой ответ" action="Отправить как есть"
        cancel={() => setConfirm(null)} confirm={() => send(confirm)}>{state?.next?.choices[confirm]?.warning}</Confirm>}
    </section>
  );
}
