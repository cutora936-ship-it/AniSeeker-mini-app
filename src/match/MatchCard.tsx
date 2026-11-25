import { Symbol } from './Symbol';
import { symbolNames, type SymbolPlacement } from './round';
import type { Feedback } from './useMatch';

export function MatchCard({ symbols, index, feedback, onAnswer }: {
  symbols: readonly SymbolPlacement[];
  index: number;
  feedback: Feedback | null;
  onAnswer: (card: number, id: number) => void;
}) {
  return (
    <div className="match-disc" role="group" aria-label={index === 0 ? 'Верхняя карточка' : 'Нижняя карточка'}>
      {symbols.map(({ id, x, y, angle, scale }) => (
        <button key={id} type="button" className="match-target" aria-label={symbolNames[id]} data-symbol={id}
          data-feedback={feedback?.card === index && feedback.id === id ? (feedback.correct ? 'correct' : 'wrong') : undefined}
          aria-disabled={Boolean(feedback)} style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onAnswer(index, id)}>
          <span className="match-target__art" style={{ transform: `rotate(${angle}deg) scale(${scale})` }}>
            <Symbol id={id} />
          </span>
        </button>
      ))}
    </div>
  );
}
