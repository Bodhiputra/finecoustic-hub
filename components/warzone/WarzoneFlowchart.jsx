'use client';

import { useMemo } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { taskDueDate } from '@/lib/warzone';

const STAGES = ['todo', 'in_progress', 'done'];

export default function WarzoneFlowchart({ tasks, onTaskClick }) {
  const { t } = useLocale();

  const byStage = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] };
    for (const task of tasks) {
      if (map[task.status]) map[task.status].push(task);
    }
    return map;
  }, [tasks]);

  return (
    <section className="warzone-flowchart">
      <p className="warzone-flowchart-hint">{t('hub.warzone.flowchartHint')}</p>
      <div className="warzone-flowchart-track">
        {STAGES.map((stage, i) => (
          <div key={stage} className="warzone-flowchart-stage-wrap">
            {i > 0 && <div className="warzone-flowchart-connector" aria-hidden="true" />}
            <div className={`warzone-flowchart-stage is-${stage}`}>
              <header className="warzone-flowchart-stage-head">
                <span className="warzone-flowchart-node-dot" />
                <h3>{t(`hub.warzone.status${stage === 'todo' ? 'Todo' : stage === 'in_progress' ? 'InProgress' : 'Done'}`)}</h3>
              </header>
              <div className="warzone-flowchart-nodes">
                {byStage[stage].length === 0 ? (
                  <span className="warzone-flowchart-empty">{t('hub.warzone.noTasks')}</span>
                ) : (
                  byStage[stage].map((task, idx) => (
                    <div key={task.id} className="warzone-flowchart-node-row">
                      {idx > 0 && <div className="warzone-flowchart-node-line" aria-hidden="true" />}
                      <button
                        type="button"
                        className="warzone-flowchart-node"
                        onClick={() => onTaskClick(task)}
                      >
                        <span className="warzone-flowchart-node-title">{task.title}</span>
                        {taskDueDate(task) && <span className="warzone-flowchart-node-meta">{taskDueDate(task)}</span>}
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
