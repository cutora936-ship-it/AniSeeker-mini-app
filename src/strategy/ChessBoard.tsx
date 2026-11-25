import { useRef, useState, type KeyboardEvent } from 'react';
import { SQUARES, type Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

const artwork = import.meta.glob<string>('../assets/chessnut/*.svg', {
  eager: true,
  import: 'default',
});
const blackSquares = [...SQUARES].reverse();

export const pieceNames: Record<PieceSymbol, string> = {
  k: 'король',
  q: 'ферзь',
  r: 'ладья',
  b: 'слон',
  n: 'конь',
  p: 'пешка',
};

export function pieceImage(color: Color, type: PieceSymbol) {
  return artwork[`../assets/chessnut/${color}${type.toUpperCase()}.svg`];
}

interface ChessBoardProps {
  game: Chess;
  color: Color;
  pieceIds: ReadonlyMap<Square, Square>;
  lastMove?: Move;
  selected: Square | null;
  targets: readonly Square[];
  locked: boolean;
  onSquare: (square: Square) => void;
}

export function ChessBoard({ game, color, pieceIds, lastMove, selected, targets, locked, onSquare }: ChessBoardProps) {
  const squares = color === 'w' ? SQUARES : blackSquares;
  const [focused, setFocused] = useState<Square>(color === 'w' ? 'a1' : 'h8');
  const cells = useRef(new Map<Square, HTMLButtonElement>());
  const checkedKing = game.isCheck()
    ? game.board().flat().find((piece) => piece?.type === 'k' && piece.color === game.turn())?.square
    : undefined;

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const row = Math.floor(index / 8);
    const file = index % 8;
    const destination: Partial<Record<string, number>> = {
      ArrowLeft: row * 8 + Math.max(0, file - 1),
      ArrowRight: row * 8 + Math.min(7, file + 1),
      ArrowUp: Math.max(0, row - 1) * 8 + file,
      ArrowDown: Math.min(7, row + 1) * 8 + file,
      Home: row * 8,
      End: row * 8 + 7,
    };
    const target = destination[event.key];
    if (target === undefined) return;
    event.preventDefault();
    cells.current.get(squares[target])?.focus();
  }

  return (
    <div className="strategy-board-frame surface">
      <div className="strategy-board">
        <div className="strategy-board__grid" role="grid" aria-label="Шахматная доска" aria-disabled={locked}>
          {Array.from({ length: 8 }, (_, row) => (
            <div className="strategy-board__row" role="row" key={row}>
              {squares.slice(row * 8, row * 8 + 8).map((square, file) => {
                const piece = game.get(square);
                const legal = targets.includes(square);
                const label = [
                  square,
                  piece && `${pieceNames[piece.type]} ${piece.color === 'w' ? 'белых' : 'чёрных'}`,
                  legal && 'допустимый ход',
                  square === checkedKing && 'шах',
                ].filter(Boolean).join(', ');

                return (
                  <div role="gridcell" key={square} className="strategy-board__cell">
                    <button type="button" className="strategy-board__square"
                      data-square={square} data-tone={(row + file) % 2 ? 'dark' : 'light'}
                      data-last={Boolean(lastMove && (square === lastMove.from || square === lastMove.to))}
                      data-check={square === checkedKing}
                      aria-label={label} aria-pressed={square === selected} tabIndex={focused === square ? 0 : -1}
                      ref={(element) => {
                        if (element) cells.current.set(square, element);
                        else cells.current.delete(square);
                      }}
                      onClick={() => onSquare(square)} onFocus={() => setFocused(square)}
                      onKeyDown={(event) => moveFocus(event, row * 8 + file)}>
                      {legal && <span aria-hidden="true" className={piece ? 'strategy-board__capture' : 'strategy-board__target'} />}
                      {file === 0 && <span aria-hidden="true" className="strategy-board__rank">{square[1]}</span>}
                      {row === 7 && <span aria-hidden="true" className="strategy-board__file">{square[0]}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="strategy-board__artwork" aria-hidden="true">
          {squares.map((square, index) => {
            const piece = game.get(square);
            return piece ? (
              <span className="strategy-board__piece" key={pieceIds.get(square) ?? square}
                style={{ transform: `translate(${(index % 8) * 100}%, ${Math.floor(index / 8) * 100}%)` }}>
                <img src={pieceImage(piece.color, piece.type)} alt="" draggable={false} />
              </span>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}
