import { useAccount } from '../account/current';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { bodyLanguageQuestions } from '../data/bodyLanguageQuestions';
import { createRound, readResults, saveAttempt } from '../body-language/session';
import { useSavedTraining, useTrainingCheckpoint } from '../training/useCheckpoint';
import './BodyLanguage.css';

type Round = ReturnType<typeof createRound>;
type Save = { questions: { id: string; answerOrder: number[] }[]; answers: number[]; index: number };

function restoreRound(saved?: Save): Round {
  if (!saved) return [];
  const questions = new Map(bodyLanguageQuestions.map((question) => [question.id, question]));
  return saved.questions.flatMap(({ id, answerOrder }) => {
    const question = questions.get(id);
    return question ? [{ question, answerOrder }] : [];
  });
}

export default function BodyLanguage({ onBack }: { onBack: () => void }) {
  const { storage } = useAccount();
  const saved = useSavedTraining<Save>('body-language');
  const [round, setRound] = useState(() => restoreRound(saved));
  const [answers, setAnswers] = useState<number[]>(() => saved?.answers ?? []);
  const [index, setIndex] = useState(() => saved?.index ?? 0);
  const [results, setResults] = useState(() => readResults(storage));
  const page = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const started = round.length > 0;
  const current = round[index];
  const finished = started && !current;
  const selected = answers[index];
  const checkpoint = useMemo<Save | null>(() => current
    ? { questions: round.map(({ question, answerOrder }) => ({ id: question.id, answerOrder })), answers, index }
    : null, [current, round, answers, index]);
  useTrainingCheckpoint('body-language', checkpoint, {
    label: `Вопрос ${index + 1} из ${round.length}`, value: answers.length, total: round.length,
  });

  useLayoutEffect(() => {
    page.current?.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [index, started]);

  useLayoutEffect(() => {
    if (selected === undefined) return;
    feedback.current?.focus({ preventScroll: true });
    feedback.current?.parentElement?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  function start() {
    const previous = round.map(({ question }) => question.id);
    setRound(createRound(bodyLanguageQuestions, previous));
    setAnswers([]);
    setIndex(0);
  }

  function answer(choice: number) {
    if (!current) return;
    setAnswers((previous) => previous.length === index ? [...previous, choice] : previous);
  }

  const correct = answers.reduce((total, choice, i) => total + Number(choice === round[i]?.question.correct), 0);

  function next() {
    if (selected === undefined) return;
    if (index + 1 === round.length) {
      setResults(saveAttempt(storage, { correct, total: round.length }, results));
    }
    setIndex(index + 1);
  }

  return (
    <section ref={page} className="subscreen body-language" data-theme="gold" aria-labelledby="body-language-title">
      <h1 id="body-language-title" ref={heading} tabIndex={-1}>{finished ? 'Результат тренировки' : 'Язык тела'}</h1>

      {!started && (
        <>
          <p className="body-language-intro">Замечай жесты, мимику и детали ситуации. Учись проверять свои догадки о том, что происходит в разговоре.</p>
          <section className="body-language-panel surface" aria-labelledby="body-language-rules">
            <div className="body-language-panel__title">
              <span className="body-language-icon"><Icon name="bodyLanguage" /></span>
              <div>
                <h2 id="body-language-rules">{bodyLanguageQuestions.length} вопросов</h2>
                <p>По одному ответу на вопрос</p>
              </div>
            </div>
            <ol className="body-language-rules">
              <li>Рассмотри иллюстрацию и прочитай, что происходит.</li>
              <li>Выбери объяснение или реакцию, которые лучше учитывают ситуацию.</li>
              <li>Прочитай разбор и переходи дальше.</li>
            </ol>
            <p className="body-language-note">У одного жеста может быть несколько значений. Учитывай слова человека, обстановку и то, что происходило до жеста.</p>
          </section>
          <button type="button" className="body-language-button body-language-button--primary" onClick={start}>
            Начать тренировку <Icon name="right" />
          </button>
        </>
      )}

      {current && (
        <article className="body-language-question">
          <div className="body-language-progress">
            <span>Вопрос <strong>{index + 1} из {round.length}</strong></span>
            <progress value={answers.length} max={round.length} aria-label="Прогресс тренировки" />
          </div>
          <img key={current.question.id} className="body-language-art" src={current.question.image}
            alt={current.question.imageAlt} width={480} height={480} decoding="async" />
          <p className="body-language-situation">{current.question.situation}</p>
          <h2 id="body-language-prompt">{current.question.prompt}</h2>
          <div className="body-language-options" role="group" aria-labelledby="body-language-prompt">
            {current.answerOrder.map((choice, position) => {
              const status = selected === undefined ? undefined
                : choice === current.question.correct ? 'correct' : selected === choice ? 'wrong' : undefined;
              return (
                <button key={choice} type="button" className="body-language-option surface"
                  data-status={status} disabled={selected !== undefined} onClick={() => answer(choice)}>
                  <span className="body-language-option__mark" aria-hidden="true">
                    {status === 'correct' ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" /></svg>
                    ) : status === 'wrong' ? <Icon name="close" /> : 'АБВГ'[position]}
                  </span>
                  <span>
                    {current.question.answers[choice]}
                    {status && <small>{status === 'correct' ? 'Правильный ответ' : 'Твой ответ'}</small>}
                  </span>
                </button>
              );
            })}
          </div>
          {selected !== undefined && (
            <div className="body-language-response">
              <div className="body-language-panel body-language-feedback surface" tabIndex={-1} ref={feedback}>
                <h2>{selected === current.question.correct ? 'Верно' : 'Разберём ответ'}</h2>
                <p>{current.question.explanation}</p>
              </div>
              <button type="button" className="body-language-button body-language-button--primary" onClick={next}>
                {index + 1 === round.length ? 'Посмотреть результат' : 'Следующий вопрос'} <Icon name="right" />
              </button>
            </div>
          )}
        </article>
      )}

      {finished && (
        <>
          <section className="body-language-panel body-language-results surface" aria-label="Итоги">
            <dl className="body-language-stats">
              <div><dt>Правильно</dt><dd>{correct}</dd></div>
              <div><dt>Ошибок</dt><dd>{round.length - correct}</dd></div>
              <div><dt>Точность</dt><dd>{Math.round(100 * correct / round.length)}%</dd></div>
            </dl>
            <p>Лучший результат <strong>{results.best && `${results.best.correct} из ${results.best.total}`}</strong></p>
          </section>
          <section className="body-language-review" aria-labelledby="body-language-review">
            <h2 id="body-language-review">Разбор ошибок</h2>
            {correct === round.length ? <p>Все ответы верны.</p> : round.map(({ question }, i) => (
              answers[i] !== question.correct && (
                <details key={question.id} className="body-language-panel surface">
                  <summary>{i + 1}. {question.prompt}</summary>
                  <p>{question.situation}</p>
                  <p><strong>Твой ответ</strong> {question.answers[answers[i]]}</p>
                  <p><strong>Правильный ответ</strong> {question.answers[question.correct]}</p>
                  <p>{question.explanation}</p>
                </details>
              )
            ))}
          </section>
          <button type="button" className="body-language-button body-language-button--primary" onClick={start}>
            Пройти заново <Icon name="restart" />
          </button>
          <button type="button" className="body-language-button surface" onClick={onBack}>Вернуться к персонажу</button>
        </>
      )}
    </section>
  );
}
