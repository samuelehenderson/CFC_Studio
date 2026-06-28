import { useEffect, useState } from 'react';
import { modules, findLesson } from '../engine/lessons';
import { useChartStore } from '../store/chartStore';

/** Learn tab: curriculum navigation + the guided lesson runtime with the
 *  behavioral auto-checker. */
export function LearnView() {
  const activeLessonId = useChartStore((s) => s.activeLessonId);
  const completed = useChartStore((s) => s.completedLessons);
  const setActiveLesson = useChartStore((s) => s.setActiveLesson);

  // default-select the first lesson
  useEffect(() => {
    if (!activeLessonId) setActiveLesson(modules[0].lessons[0].id);
  }, [activeLessonId, setActiveLesson]);

  const lesson = findLesson(activeLessonId ?? '');
  const total = modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="tabview">
      <div className="tabview-inner" style={{ maxWidth: 1100 }}>
        <h1>Learn CFC</h1>
        <p className="lede">
          Build CFC by doing. Each lesson loads a starter chart; you wire it up in the Editor, then
          press <b>Check my work</b> — the auto-checker runs your chart against a scripted scenario
          and grades it on behavior, so any correct solution passes. {completed.length}/{total}{' '}
          complete.
        </p>

        <div className="ref-layout">
          <div className="ref-list">
            {modules.map((m) => (
              <div key={m.id}>
                <div className="ref-cat">{m.title}</div>
                {m.lessons.map((l) => (
                  <button
                    key={l.id}
                    className={`ref-item${activeLessonId === l.id ? ' active' : ''}`}
                    onClick={() => setActiveLesson(l.id)}
                  >
                    <span style={{ width: 16 }}>{completed.includes(l.id) ? '✓' : '○'}</span>
                    <span>{l.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {lesson ? <LessonDetail lessonId={lesson.id} /> : <div>Select a lesson.</div>}
        </div>
      </div>
    </div>
  );
}

function LessonDetail({ lessonId }: { lessonId: string }) {
  const lesson = findLesson(lessonId)!;
  const startLesson = useChartStore((s) => s.startLesson);
  const checkLesson = useChartStore((s) => s.checkLesson);
  const results = useChartStore((s) => s.lessonResults);
  const completed = useChartStore((s) => s.completedLessons);
  const setTab = useChartStore((s) => s.setTab);
  const usesPlant = lesson.checks.some((c) => c.run.plantModelId);

  const [hintsShown, setHintsShown] = useState(0);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    setHintsShown(0);
    setStarted(false);
  }, [lessonId]);

  const allPass = results && results.length > 0 && results.every((r) => r.pass);

  return (
    <div className="ref-detail lesson-detail">
      <h2>
        {lesson.title}
        {completed.includes(lesson.id) && <span className="prov confirmed">✓ Completed</span>}
      </h2>
      <p className="muted" style={{ color: 'var(--text-dim)' }}>{lesson.objective}</p>

      {lesson.ppcl && (
        <div className="lesson-ppcl">
          <div className="ppcl-tag">PPCL to reproduce</div>
          <pre>{lesson.ppcl}</pre>
        </div>
      )}

      <div className="lesson-actions">
        <button
          className="primary"
          onClick={() => {
            startLesson(lesson.id);
            setStarted(true);
          }}
        >
          {started ? 'Reload starter chart' : 'Start lesson'}
        </button>
        <button onClick={() => setTab('editor')}>Go to Editor →</button>
        {usesPlant && <button onClick={() => setTab('plant')}>Open Plant →</button>}
      </div>

      <ol className="lesson-steps">
        {lesson.instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <div className="lesson-hints">
        {lesson.hints.slice(0, hintsShown).map((h, i) => (
          <div className="hint" key={i}>
            <b>Hint {i + 1}:</b> {h}
          </div>
        ))}
        {hintsShown < lesson.hints.length && (
          <button onClick={() => setHintsShown((n) => n + 1)}>
            {hintsShown === 0 ? 'Show a hint' : 'Show another hint'} ({lesson.hints.length - hintsShown} left)
          </button>
        )}
      </div>

      <hr />
      <button className="primary" onClick={checkLesson}>
        Check my work
      </button>

      {results && (
        <div className="lesson-results">
          {results.map((r) => (
            <div key={r.id} className={`check ${r.pass ? 'pass' : 'fail'}`}>
              <span className="mark">{r.pass ? '✓' : '✗'}</span>
              {r.label}
            </div>
          ))}
          {allPass ? (
            <div className="lesson-success">🎉 {lesson.successText}</div>
          ) : (
            <div className="lesson-retry">
              Not quite — adjust your chart in the Editor and check again. Stuck? Reveal a hint above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
