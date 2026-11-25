import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { MatchCard } from '../match/MatchCard';
import { Symbol } from '../match/Symbol';
import { roundsPerGame } from '../match/round';
import { displayTime, type MatchResult } from '../match/records';
import { useMatch } from '../match/useMatch';
import './MatchGame.css';

function RecordLine({ best }: { best: MatchResult }) {
  return (
    <div className="match-record surface">
      <Icon name="observation" />
      <div><strong>Личный рекорд</strong><p>Ошибок {best.errors} · {displayTime(best.duration)}</p></div>
    </div>
  );
}

function MatchClock({ startedAt, finishedDuration }: { startedAt: number; finishedDuration?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (finishedDuration !== undefined) return;
    const timer = window.setInterval(() => setElapsed(performance.now() - startedAt), 100);
    return () => window.clearInterval(timer);
  }, [finishedDuration, startedAt]);

  return <dd>{displayTime(finishedDuration ?? elapsed)}</dd>;
}

export default function MatchGame({ onBack, onPlayingChange }: {
  onBack: () => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const { session, records, feedback, start, answer } = useMatch(onPlayingChange);
  const screen = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const phase = session.phase;

  useEffect(() => {
    screen.current?.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [phase]);

  return (
    <section data-theme="crimson" className={phase === 'playing' ? 'subscreen match match--playing' : 'subscreen match'}
      data-match-phase={phase} ref={screen} aria-labelledby="match-title">
      {session.phase === 'welcome' && (
        <>
          <h1 id="match-title" ref={heading} tabIndex={-1}>Совпадение</h1>
          <p className="match-intro">Тренировка наблюдательности, концентрации и скорости зрительного поиска.</p>
          <div className="match-illustration" aria-hidden="true">
            <div className="match-illustration__disc match-illustration__disc--left">
              <Symbol id={6} /><Symbol id={0} /><Symbol id={8} /><Symbol id={15} />
            </div>
            <div className="match-illustration__disc match-illustration__disc--right">
              <Symbol id={4} /><Symbol id={0} /><Symbol id={11} /><Symbol id={5} />
            </div>
          </div>
          <section className="match-rules surface" aria-labelledby="match-rules-title">
            <h2 id="match-rules-title">Правила игры</h2>
            <p>Перед тобой две карточки с различными символами. Среди них всегда есть ровно один одинаковый символ. Твоя задача — найти его и нажать на него как можно быстрее. После правильного ответа появится новая пара карточек. За неправильные ответы начисляются ошибки.</p>
            <p>Игра тренирует зрительный поиск, избирательное внимание и концентрацию.</p>
          </section>
          {records.best && <RecordLine best={records.best} />}
          <button type="button" className="match-primary" onClick={start}>Начать игру <Icon name="right" /></button>
        </>
      )}

      {session.phase === 'playing' && (
        <>
          <div className="match-play__header">
            <h1 id="match-title" ref={heading} tabIndex={-1}>Совпадение</h1>
            <p>Раунд {Math.min(session.hits + Number(!feedback?.correct), roundsPerGame)} / {roundsPerGame}</p>
          </div>
          <dl className="match-live-stats surface">
            <div><dt>Верно</dt><dd>{session.hits}</dd></div>
            <div><dt>Ошибки</dt><dd>{session.errors}</dd></div>
            <div><dt>Время</dt><MatchClock startedAt={session.startedAt} finishedDuration={session.finishedDuration} /></div>
          </dl>
          <progress className="match-progress" aria-label="Прогресс игры" value={session.hits} max={roundsPerGame} />
          <div className="match-board">
            {session.pair.cards.map((symbols, index) => (
              <MatchCard key={index} index={index} symbols={symbols} feedback={feedback} onAnswer={answer} />
            ))}
          </div>
          <span className="match-announcement" role="status">
            {feedback ? (feedback.correct ? 'Верно!' : 'Символы не совпадают. Попробуй ещё раз.') : ''}
          </span>
        </>
      )}

      {session.phase === 'results' && (
        <>
          <h1 id="match-title" ref={heading} tabIndex={-1}>Тренировка завершена</h1>
          {session.newRecord && <p className="match-new-record"><Icon name="observation" /> Новый личный рекорд</p>}
          <dl className="match-results surface">
            <div><dt>Совпадения</dt><dd>{session.result.hits} / {roundsPerGame}</dd></div>
            <div><dt>Ошибки</dt><dd>{session.result.errors}</dd></div>
            <div><dt>Точность</dt><dd>{Math.round(session.result.hits / (session.result.hits + session.result.errors) * 100)}%</dd></div>
            <div><dt>Общее время</dt><dd>{displayTime(session.result.duration)}</dd></div>
            <div><dt>Среднее за раунд</dt><dd>{displayTime(session.result.duration / roundsPerGame)}</dd></div>
          </dl>
          {records.best && <RecordLine best={records.best} />}
          <button type="button" className="match-primary" onClick={start}>Играть снова <Icon name="right" /></button>
          <button type="button" className="match-secondary surface" onClick={onBack}>Вернуться к персонажу</button>
        </>
      )}
    </section>
  );
}
