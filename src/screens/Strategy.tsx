import { useAccount } from '../account/current';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Chess, Move, Square } from 'chess.js';
import { Icon } from '../components/Icon';
import { strategyPuzzles, type StrategyPuzzle } from '../data/strategyPuzzles';
import { ChessBoard, pieceImage, pieceNames } from '../strategy/ChessBoard';
import {
  evaluateAttempt, readStrategyProgress, recordMove, replayPosition, strategyStorageKey,
} from '../strategy/progress';
import { useSavedTraining, useTrainingCheckpoint } from '../training/useCheckpoint';
import { useTrainingDelay } from '../training/time';
import './Strategy.css';

function StrategyDialog({ title, children, cancel }: {
  title: string;
  children: ReactNode;
  cancel?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog className="strategy-dialog surface" ref={dialog} aria-labelledby="strategy-dialog-title"
      onKeyDown={(event) => { if (cancel && event.key === 'Escape') event.stopPropagation(); }}
      onCancel={(event) => { event.preventDefault(); cancel?.(); }}>
      <h2 id="strategy-dialog-title">{title}</h2>
      {children}
    </dialog>
  );
}

function failureMessage(puzzle: StrategyPuzzle, game: Chess, move: Move | undefined, plies: number) {
  const { goal } = puzzle;
  if (goal.kind === 'mate') {
    if (game.isStalemate()) return 'Получился пат. У соперника нет легальных ходов, но его король вне шаха.';
    if (game.isInsufficientMaterial()) return 'Получилась ничья. Оставшихся фигур недостаточно для мата.';
    if (goal.turns === 1) {
      if (!game.isCheck()) return 'Этот ход не объявляет шах. Для мата король должен быть под шахом без легального ответа.';
      const defense = game.moves()[0];
      if (defense) return `Шах можно отразить ходом ${defense}, поэтому это ещё не мат.`;
    }
    return `${puzzle.failure} ${puzzle.hint}`;
  }
  if (goal.kind === 'win-piece' && move) {
    if (plies === 1 && (move.piece !== goal.piece || !game.isCheck())) {
      return `Ход ${move.san} не даёт нужного шаха. Начни комбинацию шахом указанной фигурой.`;
    }
    if (plies > 1) {
      const recapture = game.moves({ verbose: true }).find((reply) => reply.to === move.to && reply.captured);
      if (move.captured === goal.target && recapture) {
        return `После ${move.san} соперник может взять атакующую фигуру ходом ${recapture.san}. В условии её нужно сохранить.`;
      }
      return `Ход ${move.san} не завершает комбинацию. На втором ходу нужно взять цель той же фигурой, которая объявила шах.`;
    }
  }
  return move ? `Ход ${move.san}. ${puzzle.failure}` : puzzle.failure;
}

export default function Strategy({ onBack }: { onBack: () => void }) {
  const { storage } = useAccount();
  const saved = useSavedTraining<{ puzzleId: string; selected: Square | null; target: Square | null; hintOpen: boolean }>('strategy');
  const [progress, setProgress] = useState(() => readStrategyProgress(storage));
  const [selected, setSelected] = useState<Square | null>(() => saved?.puzzleId === progress.puzzleId ? saved.selected : null);
  const [promotionTarget, setPromotionTarget] = useState<Square | null>(() => saved?.puzzleId === progress.puzzleId ? saved.target : null);
  const [hintOpen, setHintOpen] = useState(() => saved?.puzzleId === progress.puzzleId && saved.hintOpen);
  const [resultOpen, setResultOpen] = useState(false);
  const [restartCount, setRestartCount] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const puzzleIndex = strategyPuzzles.findIndex(({ id }) => id === progress.puzzleId);
  const puzzle = strategyPuzzles[puzzleIndex];
  const attempt = useMemo(() => evaluateAttempt(puzzle, progress.moves), [puzzle, progress.moves]);
  const { game, pieceIds, lastMove } = useMemo(
    () => replayPosition(puzzle, progress.moves), [puzzle, progress.moves],
  );
  const color = puzzle.fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const legalMoves = useMemo(() => selected && attempt.status === 'playing'
    ? game.moves({ square: selected, verbose: true })
    : [], [attempt.status, game, selected]);
  const promotion = promotionTarget ? legalMoves.filter((move) => move.to === promotionTarget) : [];
  const targets = [...new Set(legalMoves.map((move) => move.to))];
  const outcome = attempt.status === 'won' || attempt.status === 'lost' ? attempt.status : null;
  const reply = attempt.status === 'reply' ? attempt.move : null;
  const nextPuzzle = strategyPuzzles[puzzleIndex + 1];
  const checkpoint = useMemo(() => progress.completed.length === strategyPuzzles.length ? null
    : { puzzleId: progress.puzzleId, selected, target: promotionTarget, hintOpen },
    [progress, selected, promotionTarget, hintOpen]);
  useTrainingCheckpoint('strategy', checkpoint, {
    label: `Испытание ${puzzleIndex + 1} из ${strategyPuzzles.length}`,
    value: progress.completed.length, total: strategyPuzzles.length, difficulty: puzzle.level,
  });

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    try {
      storage.setItem(strategyStorageKey, JSON.stringify(progress));
    } catch {
      // Training stays available when local storage is blocked.
    }
  }, [progress, storage]);

  useTrainingDelay(reply ? 450 : null, () => {
    if (reply) setProgress((current) => current === progress ? recordMove(current, puzzle, reply) : current);
  }, progress);

  const resultDelay = outcome ? (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 290) : null;
  useTrainingDelay(resultDelay, () => setResultOpen(true), progress);

  function play(move: Move) {
    setSelected(null);
    setPromotionTarget(null);
    setProgress((current) => current === progress ? recordMove(current, puzzle, move.lan) : current);
  }

  function chooseSquare(square: Square) {
    if (attempt.status !== 'playing') return;
    const matching = legalMoves.filter((move) => move.to === square);
    if (matching.length > 1) {
      setPromotionTarget(square);
    } else if (matching.length === 1) {
      play(matching[0]);
    } else if (game.get(square)?.color === color) {
      setSelected(square === selected ? null : square);
    }
  }

  function start(id: string) {
    setProgress((current) => ({ ...current, puzzleId: id, moves: [] }));
    setSelected(null);
    setPromotionTarget(null);
    setHintOpen(false);
    setResultOpen(false);
    setRestartCount((count) => count + 1);
    panel.current?.scrollTo({ top: 0, behavior: 'instant' });
    if (resultOpen) {
      window.requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
    }
  }

  const won = outcome === 'won';

  return (
    <section className="subscreen strategy" aria-labelledby="strategy-title" ref={panel}>
      <div className="strategy-header">
        <h1 id="strategy-title" ref={title} tabIndex={-1}>Стратегия</h1>
        <div className="strategy-progress">
          <div className="strategy-progress__line">
            <p>Испытание <strong>{puzzleIndex + 1} / {strategyPuzzles.length}</strong></p>
            <span className="strategy-level">{puzzle.level}</span>
          </div>
          <progress aria-label={`Пройдено ${progress.completed.length} из ${strategyPuzzles.length} испытаний`}
            value={progress.completed.length} max={strategyPuzzles.length} />
        </div>
      </div>

      <div className="strategy-task surface">
        <div className="strategy-task__header">
          <h2>{puzzle.title}</h2>
          <span className="strategy-turn">
            <span aria-hidden="true" data-side={color} />{color === 'w' ? 'За белых' : 'За чёрных'}
          </span>
        </div>
        <p>{puzzle.prompt}</p>
      </div>

      <ChessBoard key={restartCount} game={game} color={color} pieceIds={pieceIds} lastMove={lastMove}
        selected={selected} targets={targets} locked={attempt.status !== 'playing'} onSquare={chooseSquare} />

      <div className="strategy-controls">
        <button type="button" className="strategy-control surface" aria-expanded={hintOpen}
          aria-controls="strategy-hint" onClick={() => setHintOpen((shown) => !shown)}>
          <Icon name="hint" />Подсказка
        </button>
        <button type="button" className="strategy-control surface" onClick={() => start(puzzle.id)}>
          <Icon name="restart" />Перезапуск
        </button>
      </div>
      <p className="strategy-hint" id="strategy-hint" hidden={!hintOpen}>{puzzle.hint}</p>
      <p className="strategy-live" role="status">{reply ? 'Ход соперника…' : ''}</p>

      {promotion.length > 0 && (
        <StrategyDialog title="Превращение пешки" cancel={() => setPromotionTarget(null)}>
          <p>Выбери фигуру.</p>
          <div className="strategy-promotion">
            {promotion.map((move) => move.promotion && (
              <button className="strategy-control surface" type="button" key={move.lan}
                onClick={() => play(move)} aria-label={pieceNames[move.promotion]}>
                <img src={pieceImage(color, move.promotion)} alt="" />
              </button>
            ))}
          </div>
        </StrategyDialog>
      )}

      {resultOpen && outcome && (
        <StrategyDialog title={won ? (nextPuzzle ? 'Испытание пройдено' : 'Все испытания пройдены') : 'Испытание не пройдено'}>
          <p>{won ? puzzle.success : failureMessage(puzzle, game, lastMove, progress.moves.length)}</p>
          <button type="button" className="strategy-result-action"
            onClick={() => won && !nextPuzzle ? onBack() : start(won && nextPuzzle ? nextPuzzle.id : puzzle.id)}>
            {won ? (nextPuzzle ? 'Следующее испытание' : 'К досье') : 'Попробовать снова'}
            {won && <Icon name="right" />}
          </button>
          {won && !nextPuzzle && (
            <button type="button" className="strategy-control surface strategy-result-retry" onClick={() => start(puzzle.id)}>
              <Icon name="restart" />Сыграть ещё раз
            </button>
          )}
        </StrategyDialog>
      )}
    </section>
  );
}
