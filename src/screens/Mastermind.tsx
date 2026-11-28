import { useAccount } from '../account/current';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { displayTime } from '../match/records';
import {
  generateSecret, getLevelProgress, levels, readProgress, rememberSecret, saveResult, scoreGuess,
  type Clue, type LevelId,
} from '../mastermind/game';
import { palette, Peg } from '../mastermind/Peg';
import { useSavedTraining, useTrainingCheckpoint } from '../training/useCheckpoint';
import { useTrainingClock, useTrainingDisplay } from '../training/time';
import './Mastermind.css';

type Guess = { colors: number[]; clue: Clue };
type Round = { secret: number[]; history: Guess[]; duration?: number };
type Save = { levelId: LevelId; round: Round; draft: (number | null)[]; selected: number | null; elapsed: number };
const exampleSecret = [0, 1, 2];
const exampleGuess = [0, 2, 3];

function Code({ colors }: { colors: readonly number[] }) {
  return (
    <span className="mastermind-code">
      {colors.map((color, index) => <Peg key={index} color={color} label />)}
    </span>
  );
}

function Clues({ clue }: { clue: Clue }) {
  return (
    <span className="mastermind-clues" role="img"
      aria-label={`На своих местах: ${clue.exact}. На других местах: ${clue.misplaced}.`}>
      <span aria-hidden="true"><i />{clue.exact}</span>
      <span aria-hidden="true"><i />{clue.misplaced}</span>
    </span>
  );
}

function ClueLegend() {
  return (
    <div className="mastermind-legend">
      <span><i aria-hidden="true" />Цвет на своём месте</span>
      <span><i aria-hidden="true" />Цвет на другом месте</span>
    </div>
  );
}

function Timer({ elapsed }: { elapsed: () => number }) {
  return <dd>{displayTime(useTrainingDisplay(elapsed, true))}</dd>;
}

function History({ history, playing }: { history: readonly Guess[]; playing: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    if (playing && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [history.length, playing]);

  return (
    <section className="mastermind-history surface" aria-labelledby="mastermind-history-title">
      <div className="mastermind-history__heading">
        <h2 id="mastermind-history-title">История попыток</h2>
        <ClueLegend />
      </div>
      {history.length > 0 ? (
        <ol className="mastermind-history__list" ref={list} tabIndex={playing ? 0 : undefined}
          aria-label="Предыдущие комбинации">
          {history.map(({ colors, clue }, index) => (
            <li className="mastermind-history__row" key={index}>
              <span className="mastermind-history__number" aria-label={`Попытка ${index + 1}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <Code colors={colors} />
              <Clues clue={clue} />
            </li>
          ))}
        </ol>
      ) : <p className="mastermind-history__empty">Здесь появятся твои комбинации и подсказки.</p>}
    </section>
  );
}

function Rules({ selected, onSelect, onStart }: {
  selected: LevelId;
  onSelect: (level: LevelId) => void;
  onStart: () => void;
}) {
  return (
    <>
      <p className="mastermind-intro">Раскрой секретный код с помощью логики и подсказок.</p>
      <section className="mastermind-rules surface" aria-labelledby="mastermind-rules-title">
        <h2 id="mastermind-rules-title">Как играть</h2>
        <p>Компьютер загадывает секретную комбинацию цветов. Разгадай её за ограниченное число попыток.</p>
        <ClueLegend />
        <div className="mastermind-example" aria-label="Пример проверки">
          <div><span>Пример кода</span><Code colors={exampleSecret} /></div>
          <div><span>Попытка</span><Code colors={exampleGuess} /><Clues clue={scoreGuess(exampleSecret, exampleGuess)} /></div>
        </div>
        <p>Подсказки показывают только количество совпадений. Сравнивай попытки, чтобы исключать неподходящие варианты.</p>
      </section>
      <fieldset className="mastermind-levels">
        <legend>Сложность</legend>
        {(Object.keys(levels) as LevelId[]).map((id) => {
          const level = levels[id];
          return (
            <label key={id} className="mastermind-level surface">
              <input type="radio" name="mastermind-level" value={id} checked={id === selected} onChange={() => onSelect(id)} />
              <span>
                <strong>{level.name}</strong>
                <small>{level.colors} {level.colors === 4 ? 'цвета' : 'цветов'} · код из {level.size} · {level.attempts} попыток</small>
                <small>{level.repeats ? 'Цвета могут повторяться' : 'Без повторов цветов'}</small>
              </span>
            </label>
          );
        })}
      </fieldset>
      <button className="mastermind-button mastermind-button--primary" type="button" onClick={onStart}>
        Начать игру <Icon name="right" />
      </button>
    </>
  );
}

export default function Mastermind({ onBack }: { onBack: () => void }) {
  const { storage } = useAccount();
  const saved = useSavedTraining<Save>('mastermind');
  const [levelId, setLevelId] = useState<LevelId>(() => saved?.levelId ?? 'beginner');
  const [round, setRound] = useState<Round | null>(() => saved?.round ?? null);
  const [progress, setProgress] = useState(() => readProgress(storage));
  const [draft, setDraft] = useState<(number | null)[]>(() => saved?.draft ?? []);
  const [selected, setSelected] = useState<number | null>(() => saved ? saved.selected : 0);
  const screen = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const level = levels[levelId];
  const phase = !round ? 'rules' : round.duration === undefined ? 'playing' : 'results';
  const clock = useTrainingClock(saved?.elapsed ?? 0, phase === 'playing');
  const checkpoint = useMemo<Save | null>(() => round && phase === 'playing'
    ? { levelId, round, draft, selected, elapsed: 0 }
    : null, [levelId, round, draft, selected, phase]);
  const attempts = round?.history.length ?? 0;
  useTrainingCheckpoint('mastermind', checkpoint, {
    label: `Попытка ${Math.min(attempts + 1, level.attempts)} из ${level.attempts}`,
    value: attempts, total: level.attempts, difficulty: level.name,
  }, (data) => ({ ...data, elapsed: clock.elapsed() }));
  const levelProgress = getLevelProgress(progress, levelId);
  const lastClue = round?.history.at(-1)?.clue;
  const won = lastClue?.exact === level.size;

  useEffect(() => {
    screen.current?.scrollTo({ top: 0, behavior: 'instant' });
    const target = phase === 'results' ? resultHeading.current : heading.current;
    target?.focus({ preventScroll: true });
  }, [phase]);

  function resetDraft() {
    setDraft(Array(level.size).fill(null));
    setSelected(0);
  }

  function start() {
    const secret = generateSecret(level, levelProgress.recent);
    setProgress(rememberSecret(storage, progress, levelId, secret));
    resetDraft();
    clock.reset();
    setRound({ secret, history: [] });
  }

  function choose(color: number) {
    if (selected === null || (!level.repeats && draft.some((value, index) => value === color && index !== selected))) return;
    const updated = [...draft];
    updated[selected] = color;
    const next = updated.indexOf(null, selected + 1);
    const first = next === -1 ? updated.indexOf(null) : next;
    setDraft(updated);
    setSelected(first < 0 ? null : first);
  }

  const lastFilled = draft.reduce<number>((last, color, index) => color === null ? last : index, -1);
  const removable = selected !== null && draft[selected] !== null ? selected : lastFilled;

  function remove() {
    if (removable < 0) return;
    setDraft(draft.map((color, index) => index === removable ? null : color));
    setSelected(removable);
  }

  function submit() {
    if (!round || round.duration !== undefined || draft.length !== level.size
      || !draft.every((color) => color !== null)) return;
    const clue = scoreGuess(round.secret, draft);
    const history = [...round.history, { colors: draft, clue }];
    const correct = clue.exact === level.size;
    if (correct || history.length === level.attempts) {
      const duration = clock.elapsed();
      setProgress(saveResult(storage, progress, levelId, correct, { attempts: history.length, duration }));
      setRound({ ...round, history, duration });
      return;
    }
    setRound({ ...round, history });
    resetDraft();
  }

  return (
    <section ref={screen} className="subscreen mastermind" data-phase={phase} aria-labelledby="mastermind-title">
      <h1 id="mastermind-title" ref={heading} tabIndex={-1}>Мастермайнд</h1>
      {phase === 'rules' && <Rules selected={levelId} onSelect={setLevelId} onStart={start} />}

      {round && phase === 'playing' && (
        <>
          <dl className="mastermind-stats surface">
            <div><dt>Попытка</dt><dd>{round.history.length + 1} / {level.attempts}</dd></div>
            <div><dt>Осталось</dt><dd>{level.attempts - round.history.length}</dd></div>
            <div><dt>Время</dt><Timer elapsed={clock.elapsed} /></div>
          </dl>
          <div className="mastermind-secret" role="group" aria-label={`Секретный код скрыт. Позиций ${level.size}`}>
            <span>Секретный код</span>
            <span className="mastermind-code" aria-hidden="true">
              {round.secret.map((_, index) => <span className="mastermind-hidden-peg" key={index} />)}
            </span>
          </div>
          <History history={round.history} playing />
          <div className="mastermind-composer surface">
            <div className="mastermind-composer__heading">
              <h2>Твоя комбинация</h2>
              {!level.repeats && <span>Без повторов</span>}
            </div>
            <div className="mastermind-draft" role="group" aria-label="Позиции комбинации">
              {draft.map((color, index) => (
                <button type="button" key={index} className="mastermind-slot"
                  aria-label={`Позиция ${index + 1}: ${color === null ? 'пусто' : palette[color].name}`}
                  aria-pressed={selected === index} onClick={() => setSelected(index)}>
                  {color === null ? <span aria-hidden="true">{index + 1}</span> : <Peg color={color} />}
                </button>
              ))}
            </div>
            <div className="mastermind-palette" role="group" aria-label="Доступные цвета"
              data-extended={level.colors > 6}>
              {palette.slice(0, level.colors).map(({ name }, color) => (
                <button className="mastermind-color" key={name} type="button" aria-label={name}
                  disabled={selected === null || (!level.repeats && draft.some((value, index) => value === color && index !== selected))}
                  onClick={() => choose(color)}><Peg color={color} /></button>
              ))}
            </div>
            <div className="mastermind-actions">
              <button className="mastermind-button surface" type="button" disabled={removable < 0} onClick={remove}
                aria-label="Удалить элемент"><Icon name="close" /></button>
              <button className="mastermind-button mastermind-button--primary" type="button"
                disabled={draft.some((color) => color === null)} onClick={submit}>Проверить</button>
            </div>
          </div>
          <span className="mastermind-announcement" role="status">
            {lastClue && `Попытка ${round.history.length}. На своих местах: ${lastClue.exact}. На других местах: ${lastClue.misplaced}.`}
          </span>
        </>
      )}

      {round?.duration !== undefined && (
        <>
          <section className="mastermind-result surface" aria-labelledby="mastermind-result-title">
            <div className="mastermind-result__heading">
              <Icon name="mastermind" />
              <h2 id="mastermind-result-title" ref={resultHeading} tabIndex={-1}>
                {won ? 'Код разгадан' : 'Попытки закончились'}
              </h2>
            </div>
            <div className="mastermind-secret mastermind-secret--revealed">
              <span>Правильная комбинация</span><Code colors={round.secret} />
            </div>
            <dl className="mastermind-result__stats">
              <div><dt>Сложность</dt><dd>{level.name}</dd></div>
              <div><dt>Попыток использовано</dt><dd>{round.history.length} / {level.attempts}</dd></div>
              <div><dt>Время</dt><dd>{displayTime(round.duration)}</dd></div>
              <div><dt>Личный рекорд</dt><dd>{levelProgress.best
                ? `${levelProgress.best.attempts} из ${level.attempts} · ${displayTime(levelProgress.best.duration)}`
                : 'Пока нет'}</dd></div>
              <div><dt>Побед на уровне</dt><dd>{levelProgress.wins} из {levelProgress.played}</dd></div>
            </dl>
          </section>
          <button className="mastermind-button mastermind-button--primary" type="button" onClick={start}>
            Следующая комбинация <Icon name="right" />
          </button>
          <div className="mastermind-result__actions">
            <button className="mastermind-button surface" type="button" onClick={() => setRound(null)}>Изменить сложность</button>
            <button className="mastermind-button surface" type="button" onClick={onBack}>Вернуться к персонажу</button>
          </div>
          <History history={round.history} playing={false} />
        </>
      )}
    </section>
  );
}
