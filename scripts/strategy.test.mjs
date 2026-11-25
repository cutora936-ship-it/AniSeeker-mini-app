import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess, validateFen } from 'chess.js';
import { strategyLevels, strategyPuzzles } from '../src/data/strategyPuzzles.ts';

function replay(fen, line) {
  const game = new Chess(fen);
  const played = line.map((coordinates) => {
    const move = game.move({
      from: coordinates.slice(0, 2),
      to: coordinates.slice(2, 4),
      promotion: coordinates[4],
    });
    assert.equal(move.lan, coordinates);
    return move;
  });
  return { game, played };
}

function mateSolver(attacker) {
  const memo = new Map();

  function canForceMate(fen, turns) {
    const key = fen.split(' ').slice(0, 4).join(' ') + ':' + turns;
    if (memo.has(key)) return memo.get(key);

    const game = new Chess(fen);
    let result;
    if (game.turn() === attacker) {
      result = turns > 0 && game.moves({ verbose: true }).some((move) => canForceMate(move.after, turns - 1));
    } else if (turns === 0) {
      result = game.isCheckmate();
    } else {
      const replies = game.moves({ verbose: true });
      result = replies.length > 0
        ? replies.every((move) => canForceMate(move.after, turns))
        : game.isCheck();
    }
    memo.set(key, result);
    return result;
  }

  return canForceMate;
}

function canTakeAndKeepPiece(move, from, target) {
  return move.from === from && move.captured === target &&
    !new Chess(move.after).moves({ verbose: true }).some((reply) => reply.to === move.to && reply.captured);
}

function achievesGoal(move, goal, played) {
  switch (goal.kind) {
    case 'take':
      return move.piece === goal.piece && move.to === goal.square && Boolean(move.captured);
    case 'interpose':
      return move.from !== goal.from && !move.captured;
    case 'safe-retreat': {
      if (move.from !== goal.square || move.captured) return false;
      const reply = new Chess(move.after);
      return !reply.isCheck() && !reply.moves({ verbose: true }).some((counter) => counter.to === move.to && counter.captured);
    }
    case 'double-attack': {
      const next = new Chess(move.after);
      return move.piece === goal.piece && goal.targets.every((square) => next.attackers(square, move.color).includes(move.to));
    }
    case 'recapture': {
      if (move.piece !== goal.piece || move.captured) return false;
      const capture = new Chess(move.after).moves({ verbose: true }).find(
        (reply) => reply.from === goal.from && reply.to === goal.square && reply.captured,
      );
      return Boolean(capture && new Chess(capture.after).moves({ verbose: true }).some(
        (counter) => counter.from === move.to && counter.to === goal.square && counter.captured,
      ));
    }
    case 'win-piece': {
      if (played.length) return canTakeAndKeepPiece(move, played[0].to, goal.target);

      if (move.piece !== goal.piece || !move.san.endsWith('+') || move.captured === goal.target) return false;
      const replies = new Chess(move.after).moves({ verbose: true });
      return replies.length > 0 && replies.every((reply) => new Chess(reply.after).moves({ verbose: true }).some(
        (counter) => canTakeAndKeepPiece(counter, move.to, goal.target),
      ));
    }
    default:
      throw new Error(`Unknown goal: ${goal.kind}`);
  }
}

test('30 distinct legal FENs in five groups of six', () => {
  assert.equal(strategyPuzzles.length, 30);
  const positions = new Set();
  const ids = new Set();
  for (const puzzle of strategyPuzzles) {
    assert.equal(validateFen(puzzle.fen).ok, true, puzzle.id);
    assert.ok(!ids.has(puzzle.id), puzzle.id);
    ids.add(puzzle.id);
    const game = new Chess(puzzle.fen);
    const position = puzzle.fen.split(' ').slice(0, 4).join(' ');
    assert.ok(!positions.has(position), puzzle.id);
    positions.add(position);
    assert.ok(!game.isGameOver(), puzzle.id);
    const defendingKing = game.board().flat().find((piece) => piece?.type === 'k' && piece.color !== game.turn());
    assert.ok(defendingKing && !game.isAttacked(defendingKing.square, game.turn()), puzzle.id);
  }
  for (const level of strategyLevels) {
    assert.equal(strategyPuzzles.filter((puzzle) => puzzle.level === level).length, 6);
  }
});

for (const puzzle of strategyPuzzles) {
  test(`${puzzle.id} · ${puzzle.title}`, () => {
    const original = new Chess(puzzle.fen);
    const canForceMate = mateSolver(original.turn());
    assert.ok(puzzle.lines.length);
    const visited = new Set();
    const uniqueLines = new Set();
    for (const line of puzzle.lines) {
      assert.equal(line.length % 2, 1);
      assert.ok(!uniqueLines.has(line.join(' ')));
      uniqueLines.add(line.join(' '));

      const { game: final } = replay(puzzle.fen, line);
      if (puzzle.goal.kind === 'mate') {
        assert.ok(final.isCheckmate() && final.turn() !== original.turn());
        assert.ok(Math.ceil(line.length / 2) <= puzzle.goal.turns);
      }
      for (let index = 0; index < line.length; index++) {
        const prefix = line.slice(0, index);
        const key = prefix.join(' ');
        if (visited.has(key)) continue;
        visited.add(key);
        const { game, played } = replay(puzzle.fen, prefix);
        const branches = puzzle.lines.filter((candidate) => prefix.every((move, ply) => candidate[ply] === move));
        const actual = new Set(branches.map((candidate) => candidate[index]));
        if (index % 2) {
          assert.equal(actual.size, 1, 'The prepared reply must be deterministic');
          continue;
        }
        const moves = game.moves({ verbose: true });
        const goal = puzzle.goal;
        const expected = goal.kind === 'mate'
          ? moves.filter((move) => canForceMate(move.after, goal.turns - index / 2 - 1))
          : moves.filter((move) => achievesGoal(move, goal, played));
        assert.deepEqual(actual, new Set(expected.map((move) => move.lan)), `All correct moves after ${key || 'start'}`);
      }
    }
  });
}
