import type { UserStorage } from '../account/storage';
import { Chess, type Move, type Square } from 'chess.js';
import { strategyPuzzles, type StrategyPuzzle } from '../data/strategyPuzzles';

import { strategyStorageKey } from './catalog';

export { strategyStorageKey };

export interface StrategyProgress {
  puzzleId: string;
  moves: readonly string[];
  completed: readonly string[];
}

export type Attempt =
  | { status: 'playing' | 'won' | 'lost' }
  | { status: 'reply'; move: string };

export function evaluateAttempt(puzzle: StrategyPuzzle, moves: readonly string[]): Attempt {
  const branches = puzzle.lines.filter((line) =>
    moves.length <= line.length && moves.every((move, index) => line[index] === move),
  );
  if (!branches.length) return { status: 'lost' };
  if (branches.some((line) => line.length === moves.length)) return { status: 'won' };
  if (moves.length % 2 === 1) return { status: 'reply', move: branches[0][moves.length] };
  return { status: 'playing' };
}

export function moveFromCoordinates(game: Chess, move: string): Move {
  return game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
}

export function recordMove(progress: StrategyProgress, puzzle: StrategyPuzzle, move: string): StrategyProgress {
  const moves = [...progress.moves, move];
  const completed = evaluateAttempt(puzzle, moves).status === 'won' && !progress.completed.includes(puzzle.id)
    ? [...progress.completed, puzzle.id]
    : progress.completed;
  return { ...progress, moves, completed };
}

export function decodeProgress(raw: string | null): StrategyProgress {
  let saved: Partial<StrategyProgress> | null = null;
  try {
    saved = JSON.parse(raw ?? 'null');
  } catch {
    // Invalid storage can be replaced with a fresh attempt.
  }

  const completed = strategyPuzzles.filter((puzzle) =>
    Array.isArray(saved?.completed) && saved.completed.includes(puzzle.id),
  ).map((puzzle) => puzzle.id);
  const puzzle = strategyPuzzles.find(({ id }) => id === saved?.puzzleId)
    ?? strategyPuzzles.find(({ id }) => !completed.includes(id))
    ?? strategyPuzzles[strategyPuzzles.length - 1];
  let restored: StrategyProgress = { puzzleId: puzzle.id, moves: [], completed };

  try {
    if (saved?.puzzleId !== puzzle.id || !Array.isArray(saved.moves)) return restored;
    const game = new Chess(puzzle.fen);
    for (const move of saved.moves) {
      if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) break;
      const attempt = evaluateAttempt(puzzle, restored.moves);
      if (attempt.status !== 'playing' && (attempt.status !== 'reply' || attempt.move !== move)) break;
      const applied = moveFromCoordinates(game, move);
      if (applied.lan !== move) break;
      restored = recordMove(restored, puzzle, move);
    }
  } catch {
    // Resume from the last valid position in this attempt.
  }

  return restored;
}

export function readStrategyProgress(storage: UserStorage): StrategyProgress {
  try {
    return decodeProgress(storage.getItem(strategyStorageKey));
  } catch {
    return decodeProgress(null);
  }
}

export function replayPosition(puzzle: StrategyPuzzle, moves: readonly string[]) {
  const game = new Chess(puzzle.fen);
  const pieceIds = new Map<Square, Square>();
  for (const piece of game.board().flat()) {
    if (piece) pieceIds.set(piece.square, piece.square);
  }

  let lastMove: Move | undefined;
  for (const coordinates of moves) {
    const move = moveFromCoordinates(game, coordinates);
    lastMove = move;
    const pieceId = pieceIds.get(move.from) ?? move.from;
    pieceIds.delete(move.from);
    if (move.isEnPassant()) pieceIds.delete(`${move.to[0]}${move.from[1]}` as Square);
    pieceIds.set(move.to, pieceId);

    if (move.isKingsideCastle() || move.isQueensideCastle()) {
      const rank = move.from[1];
      const short = move.isKingsideCastle();
      const rookFrom = `${short ? 'h' : 'a'}${rank}` as Square;
      const rookTo = `${short ? 'f' : 'd'}${rank}` as Square;
      pieceIds.set(rookTo, pieceIds.get(rookFrom) ?? rookFrom);
      pieceIds.delete(rookFrom);
    }
  }

  return { game, pieceIds, lastMove };
}
