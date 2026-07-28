'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { taskDueDate } from '@/lib/internal';

const STAGES = ['todo', 'in_progress', 'done'];

export default function InternalFlowchart({ tasks, onTaskClick }) {
  const { t } = useLocale();

  const byStage = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] };
    for (const task of tasks) {
      if (map[task.status]) map[task.status].push(task);
    }
    return map;
  }, [tasks]);

  return (
    <section className="internal-flowchart">
      <p className="internal-flowchart-hint">{t('hub.internal.flowchartHint')}</p>
      <div className="internal-flowchart-track">
        {STAGES.map((stage, i) => (
          <div key={stage} className="internal-flowchart-stage-wrap">
            {i > 0 && <div className="internal-flowchart-connector" aria-hidden="true" />}
            <div className={`internal-flowchart-stage is-${stage}`}>
              <header className="internal-flowchart-stage-head">
                <span className="internal-flowchart-node-dot" />
                <h3>{t(`hub.internal.status${stage === 'todo' ? 'Todo' : stage === 'in_progress' ? 'InProgress' : 'Done'}`)}</h3>
              </header>
              <div className="internal-flowchart-nodes">
                {byStage[stage].length === 0 ? (
                  <span className="internal-flowchart-empty">{t('hub.internal.noTasks')}</span>
                ) : (
                  byStage[stage].map((task, idx) => (
                    <div key={task.id} className="internal-flowchart-node-row">
                      {idx > 0 && <div className="internal-flowchart-node-line" aria-hidden="true" />}
                      <button
                        type="button"
                        className="internal-flowchart-node"
                        onClick={() => onTaskClick(task)}
                      >
                        <span className="internal-flowchart-node-title">{task.title}</span>
                        {taskDueDate(task) && <span className="internal-flowchart-node-meta">{taskDueDate(task)}</span>}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
