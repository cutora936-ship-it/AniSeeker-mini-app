import { useAccount } from '../account/current';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import {
  colors, judge, levels, makePrompts, readRecords, recordKey, saveRecord, summarize,
  type Level, type LevelId, type Prompt, type RecordScore, type Response,
} from '../stroop/game';
import { createSound, readSound, storeSound } from '../stroop/sound';
import { ActivityIcon } from '../training/ActivityIcon';
import { useSavedTraining, useTrainingCheckpoint } from '../training/useCheckpoint';
import { useTrainingClock, useTrainingDelay, useTrainingDisplay } from '../training/time';
import './Stroop.css';

type PlaySound = (cue: 'tap' | 'correct' | 'wrong' | 'finish') => void;
type Summary = ReturnType<typeof summarize>;
type Save = {
  levelId: LevelId; limit: number; prompts: readonly Prompt[]; responses: Response[];
  turn: number; selected: number | null; elapsed: number; roundStart: number;
};
type View = 'intro' | 'playing' | 'results';
const feedbackMs = 520;
const levelIds = Object.keys(levels) as LevelId[];
const durationFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function seconds(ms: number | null) {
  return ms === null ? '—' : `${durationFormat.format(ms / 1000)} с`;
}

function colorStyle(index: number): CSSProperties {
  return { '--ink': colors[index].ink } as CSSProperties;
}

function Word({ prompt }: { prompt: Prompt }) {
  return <span className="stroop-word" style={colorStyle(prompt.ink)}>{colors[prompt.word].name}</span>;
}

function Palette({ count, onPick, outcome }: {
  count: number;
  onPick: (index: number) => void;
  outcome?: { selected: number | null; ink: number };
}) {
  return (
    <div className="stroop-palette" data-extended={count > 4} role="group" aria-label="Цвет букв">
      {colors.slice(0, count).map((color, i) => (
        <button key={color.name} type="button" className="stroop-color" style={colorStyle(i)}
          data-answer={outcome && (outcome.ink === i ? 'correct' : outcome.selected === i ? 'wrong' : undefined)}
          aria-disabled={Boolean(outcome)} onClick={() => { if (!outcome) onPick(i); }}>
          <span className="stroop-swatch" aria-hidden="true" />
          {color.name}
        </button>
      ))}
    </div>
  );
}

function Demo({ play }: { play: PlaySound }) {
  const [correct, setCorrect] = useState<boolean | null>(null);
  return (
    <section className="stroop-demo stroop-panel" aria-labelledby="stroop-demo-title">
      <h2 id="stroop-demo-title">Попробуй на примере</h2>
      <Word prompt={{ word: 2, ink: 0 }} />
      <Palette count={3} onPick={(index) => {
        setCorrect(index === 0);
        play(index === 0 ? 'correct' : 'wrong');
      }} />
      <p className="stroop-demo__hint" role="status">
        {correct === null ? 'Какого цвета буквы?' : correct ? 'Верно. Буквы красные.' : 'Посмотри на буквы. Они красные.'}
      </p>
    </section>
  );
}

function Timer({ limit, elapsed, stopped }: { limit: number; elapsed: () => number; stopped: number | null }) {
  const time = useTrainingDisplay(elapsed, limit > 0 && stopped === null);
  if (!limit) return <>Без лимита</>;
  const remaining = Math.ceil(Math.max(0, limit - (stopped ?? time)) / 100) / 10;
  return <>{remaining.toFixed(1).replace('.', ',')} с</>;
}

function Session({ levelId, limit, prompts, saved, play, onFinish }: {
  levelId: LevelId;
  limit: number;
  prompts: readonly Prompt[];
  saved?: Save;
  play: PlaySound;
  onFinish: (result: Summary) => void;
}) {
  const level = levels[levelId];
  const [responses, setResponses] = useState<Response[]>(() => saved?.responses ?? []);
  const [selected, setSelected] = useState<number | null>(() => saved?.selected ?? null);
  const [turn, setTurn] = useState(() => saved?.turn ?? 0);
  const [roundStart, setRoundStart] = useState(() => saved?.roundStart ?? 0);
  const clock = useTrainingClock(saved?.elapsed ?? 0, true);
  const answered = useRef(Boolean(responses[turn]));
  const prompt = prompts[turn];
  const response = responses[turn];
  const roundElapsed = useCallback(() => clock.elapsed() - roundStart, [clock, roundStart]);
  const checkpoint = useMemo<Save>(() => ({
    levelId, limit, prompts, responses, turn, selected, elapsed: 0, roundStart,
  }), [levelId, limit, prompts, responses, turn, selected, roundStart]);
  const complete = useTrainingCheckpoint('stroop', checkpoint, {
    label: `Раунд ${turn + 1} из ${level.rounds}`,
    value: responses.length, total: level.rounds, difficulty: level.name,
  }, data => ({ ...data, elapsed: clock.elapsed() }));

  function submit(index: number | null) {
    if (answered.current) return;
    answered.current = true;
    const result = judge(prompt, index, roundElapsed(), limit);
    setSelected(result.kind === 'timeout' ? null : index);
    setResponses((previous) => [...previous, result]);
    if (result.kind !== 'timeout') play(result.kind);
  }

  const used = saved?.turn === turn ? saved.elapsed - saved.roundStart : 0;
  useTrainingDelay(!response && limit ? Math.max(0, limit - used) : null, () => submit(null), turn);
  useTrainingDelay(response ? feedbackMs : null, () => {
    if (!response) return;
    if (turn + 1 === level.rounds) {
      complete();
      onFinish(summarize(responses, roundStart + response.elapsed));
    } else {
      answered.current = false;
      setRoundStart(clock.elapsed());
      setTurn(turn + 1);
    }
  }, turn);

  const correct = responses.filter(({ kind }) => kind === 'correct').length;
  const errors = responses.filter(({ kind }) => kind === 'wrong').length;
  const stopped = response?.elapsed ?? null;

  return (
    <div className="stroop-session">
      <dl className="stroop-stats stroop-panel">
        <div><dt>Раунд</dt><dd>{turn + 1} / {level.rounds}</dd></div>
        <div><dt>Верно</dt><dd>{correct}</dd></div>
        <div><dt>Ошибки</dt><dd>{errors}</dd></div>
        <div><dt>Таймер</dt><dd><Timer key={turn} limit={limit} elapsed={roundElapsed} stopped={stopped} /></dd></div>
      </dl>
      <div className="stroop-progress" role="progressbar" aria-label="Прогресс игры"
        aria-valuenow={responses.length} aria-valuemax={level.rounds}>
        <span style={{ transform: `scaleX(${responses.length / level.rounds})` }} />
      </div>
      <div className="stroop-target stroop-panel" data-result={response?.kind}>
        <div key={turn} className="stroop-stimulus">
          <Word prompt={prompt} />
        </div>
        <p className="stroop-feedback" role="status">
          {response?.kind === 'correct' ? 'Верно'
            : response?.kind === 'wrong' ? `Неверно · ${colors[prompt.ink].name}`
              : response?.kind === 'timeout' ? `Пропуск · ${colors[prompt.ink].name}` : 'Выбери цвет букв'}
        </p>
      </div>
      <Palette count={level.colors} onPick={submit} outcome={response && { selected, ink: prompt.ink }} />
    </div>
  );
}

function Best({ record, level }: { record?: RecordScore; level: Level }) {
  return (
    <div className="stroop-record stroop-panel">
      <ActivityIcon activity="stroop" />
      <div><strong>Личный рекорд</strong>
        <p>{record ? `${record.correct} из ${level.rounds} верно${record.average === null ? '' : ` · ${seconds(record.average)} в среднем`}` : 'Появится после первой партии'}</p>
      </div>
    </div>
  );
}

export default function Stroop({ onBack }: { onBack: () => void }) {
  const { storage } = useAccount();
  const initial = useSavedTraining<Save>('stroop');
  const [saved, setSaved] = useState(initial);
  const [view, setView] = useState<View>(() => saved ? 'playing' : 'intro');
  const [levelId, setLevel] = useState<LevelId>(() => saved?.levelId ?? 'beginner');
  const [untimed, setUntimed] = useState(() => saved?.limit === 0);
  const [prompts, setPrompts] = useState<readonly Prompt[]>(() => saved?.prompts ?? []);
  const [records, setRecords] = useState(() => readRecords(storage));
  const [result, setResult] = useState<Summary | null>(null);
  const [enabled, setEnabled] = useState(() => readSound(storage));
  const [audio] = useState(createSound);
  const screen = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const level = levels[levelId];
  const limit = view === 'playing' && saved ? saved.limit : untimed ? 0 : level.seconds * 1000;
  const key = recordKey(levelId, limit > 0);

  useEffect(() => () => audio.close(), [audio]);
  useLayoutEffect(() => {
    screen.current?.scrollTo({ top: 0, behavior: 'instant' });
    title.current?.focus({ preventScroll: true });
  }, [view]);

  function sound(cue: Parameters<PlaySound>[0]) {
    if (enabled) audio.play(cue);
  }

  function activateSound() {
    if (enabled) audio.unlock();
  }

  function start() {
    sound('tap');
    setSaved(undefined);
    setPrompts(makePrompts(level));
    setView('playing');
  }

  function finish(summary: Summary) {
    setRecords(saveRecord(storage, records, key, summary));
    setResult(summary);
    setView('results');
    sound('finish');
  }

  return (
    <section className="subscreen stroop" data-theme="gold" data-view={view} ref={screen} aria-labelledby="stroop-title"
      onClickCapture={activateSound} onChangeCapture={activateSound}>
      <div className="stroop-heading">
        <h1 id="stroop-title" ref={title} tabIndex={-1}>{view === 'results' ? 'Результат игры' : 'Конфликт восприятия'}</h1>
        <button type="button" className="icon-button stroop-sound" aria-label="Звук" aria-pressed={enabled} onClick={() => {
          if (enabled) audio.close();
          else {
            audio.unlock();
            audio.play('tap');
          }
          setEnabled(!enabled);
          storeSound(storage, !enabled);
        }}><Icon name={enabled ? 'soundOn' : 'soundOff'} /></button>
      </div>

      {view === 'intro' && <>
        <p className="stroop-lead">Определи цвет букв и игнорируй значение слова. Иногда они совпадают. Игра основана на эффекте Струпа.</p>
        <Demo play={sound} />
        <fieldset className="stroop-levels">
          <legend>Сложность</legend>
          {levelIds.map((id) => {
            const item = levels[id];
            return (
              <label className="stroop-level stroop-panel" key={id} data-selected={id === levelId}>
                <input type="radio" name="stroop-level" checked={id === levelId} onChange={() => {
                  setLevel(id);
                  sound('tap');
                }} />
                <span><strong>{item.name}</strong>
                  <small>{item.colors === 4 ? '4 цвета' : `${item.colors} цветов`} · {item.rounds} раундов</small>
                  <small>{item.seconds ? `${item.seconds} с на ответ` : 'Без лимита'}</small>
                </span>
              </label>
            );
          })}
        </fieldset>
        <label className="stroop-timing stroop-panel">
          <input type="checkbox" checked={!level.seconds || untimed} disabled={!level.seconds} onChange={(event) => {
            setUntimed(event.target.checked);
            sound('tap');
          }} /> Играть без ограничения времени
        </label>
        <Best record={records[key]} level={level} />
        <button type="button" className="stroop-action stroop-primary" onClick={start}>Начать игру <Icon name="right" /></button>
      </>}

      {view === 'playing' && <Session levelId={levelId} limit={limit} prompts={prompts} saved={saved} play={sound} onFinish={finish} />}

      {view === 'results' && result && <div className="stroop-results">
        <section className="stroop-summary stroop-panel" aria-label="Статистика">
          <p>{level.name} · {limit ? `${level.seconds} с на ответ` : 'Без лимита'}</p>
          <dl className="stroop-counts">
            <div><dt>Верно</dt><dd>{result.correct}</dd></div>
            <div><dt>Ошибки</dt><dd>{result.wrong}</dd></div>
            <div><dt>Пропуски</dt><dd>{result.skipped}</dd></div>
            <div><dt>Точность</dt><dd>{result.accuracy}%</dd></div>
          </dl>
          <dl className="stroop-times">
            <div><dt>Средний правильный ответ</dt><dd>{seconds(result.average)}</dd></div>
            <div><dt>Лучшая реакция</dt><dd>{seconds(result.best)}</dd></div>
            <div><dt>Общее время</dt><dd>{seconds(result.duration)}</dd></div>
          </dl>
        </section>
        <Best record={records[key]} level={level} />
        <button type="button" className="stroop-action stroop-primary" onClick={start}>Играть снова <Icon name="restart" /></button>
        <div className="stroop-result-actions">
          <button type="button" className="stroop-action stroop-panel" onClick={() => { sound('tap'); setView('intro'); }}>Изменить сложность</button>
          <button type="button" className="stroop-action stroop-panel" onClick={onBack}>Вернуться к персонажу</button>
        </div>
        <section className="stroop-explanation stroop-panel">
          <h2>Эффект Струпа</h2>
          <p>Чтение запускается автоматически. Когда слово обозначает один цвет, а буквы окрашены в другой, эти подсказки конкурируют. Чтобы назвать цвет букв, обычно требуется больше времени.</p>
        </section>
      </div>}
    </section>
  );
}
