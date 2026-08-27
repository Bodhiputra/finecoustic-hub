'use client';

import { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { KOL_GUIDELINES_SECTIONS } from '@/lib/kol-guidelines-content';

function CopyButton({ text, label }) {
  const { toast } = useToast();
  const { t } = useLocale();

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('hub.kolGuidelines.copied'));
    } catch {
      toast.error(t('common.somethingWrong'));
    }
  }, [text, toast, t]);

  return (
    <button type="button" className="kol-guide-copy" onClick={copy} aria-label={label}>
      <Icon name="copy" size={14} />
      <span>{t('hub.kolGuidelines.copy')}</span>
    </button>
  );
}

function GuideBlock({ block }) {
  switch (block.type) {
    case 'lead':
      return <p className="kol-guide-lead">{block.text}</p>;

    case 'paragraph':
      return <p className="kol-guide-p">{block.text}</p>;

    case 'subheading':
      return <h3 className="kol-guide-h3">{block.text}</h3>;

    case 'callout':
      return (
        <div className={`kol-guide-callout is-${block.tone || 'neutral'}`}>
          {block.text}
        </div>
      );

    case 'split':
      return (
        <div className="kol-guide-split">
          {block.items.map(item => (
            <div key={item.title} className={`kol-guide-panel is-${item.tone || 'neutral'}`}>
              <h4 className="kol-guide-panel-title">{item.title}</h4>
              <ul className="kol-guide-list">
                {item.bullets.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );

    case 'checklist':
      return (
        <div className={`kol-guide-panel is-${block.tone || 'neutral'}`}>
          {block.title ? <h4 className="kol-guide-panel-title">{block.title}</h4> : null}
          <ul className="kol-guide-list">
            {block.items.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      );

    case 'example':
      return (
        <figure className="kol-guide-example">
          <figcaption className="kol-guide-example-label">{block.label}</figcaption>
          <blockquote className="kol-guide-example-text">{block.text}</blockquote>
          <CopyButton text={block.text} label={block.label} />
        </figure>
      );

    case 'steps':
      return (
        <div className="kol-guide-steps-wrap">
          {block.title ? <h3 className="kol-guide-h3">{block.title}</h3> : null}
          <ol className="kol-guide-steps">
            {block.steps.map(step => (
              <li key={step.title} className="kol-guide-step">
                <h4 className="kol-guide-step-title">{step.title}</h4>
                {step.body ? <p className="kol-guide-p">{step.body}</p> : null}
                {step.links?.length ? (
                  <ul className="kol-guide-links">
                    {step.links.map(link => (
                      <li key={link.href}>
                        <strong>{link.label}:</strong>{' '}
                        <a href={link.href} target="_blank" rel="noopener noreferrer">
                          {link.href}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {step.listLabel ? <p className="kol-guide-step-label">{step.listLabel}</p> : null}
                {step.bullets?.length ? (
                  <ul className="kol-guide-list">
                    {step.bullets.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {step.body2 ? <p className="kol-guide-p">{step.body2}</p> : null}
                {step.template ? (
                  <div className="kol-guide-template">
                    <pre>{step.template}</pre>
                    <CopyButton text={step.template} label={step.title} />
                  </div>
                ) : null}
                {step.exampleLabel ? <p className="kol-guide-step-label">{step.exampleLabel}</p> : null}
                {step.example ? (
                  <figure className="kol-guide-example is-nested">
                    <blockquote className="kol-guide-example-text">{step.example}</blockquote>
                    <CopyButton text={step.example} label={step.title} />
                  </figure>
                ) : null}
                {step.body3 ? <p className="kol-guide-p">{step.body3}</p> : null}
                {step.example2 ? (
                  <figure className="kol-guide-example is-nested">
                    <blockquote className="kol-guide-example-text">{step.example2}</blockquote>
                    <CopyButton text={step.example2} label={step.title} />
                  </figure>
                ) : null}
                {step.notesLabel ? <p className="kol-guide-step-label">{step.notesLabel}</p> : null}
                {step.notesIntro ? <p className="kol-guide-p">{step.notesIntro}</p> : null}
                {step.notes?.length ? (
                  <ul className="kol-guide-notes">
                    {step.notes.map(note => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
                {step.notesOutro ? <p className="kol-guide-p">{step.notesOutro}</p> : null}
                {step.bulletsLabel2 ? <p className="kol-guide-step-label">{step.bulletsLabel2}</p> : null}
                {step.bullets2?.length ? (
                  <ul className="kol-guide-list">
                    {step.bullets2.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
                {step.footer ? (
                  <>
                    {step.footerLabel ? <p className="kol-guide-step-label">{step.footerLabel}</p> : null}
                    <p className="kol-guide-footnote">{step.footer}</p>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      );

    case 'cards':
      return (
        <div className="kol-guide-cards">
          {block.items.map(card => (
            <article key={card.title} className="kol-guide-card">
              <h4 className="kol-guide-card-title">{card.title}</h4>
              {card.sections?.length ? (
                card.sections.map(section => (
                  <div key={section.label} className="kol-guide-card-section">
                    <p className="kol-guide-card-section-label">{section.label}</p>
                    {section.bullets?.length ? (
                      <ul className="kol-guide-list">
                        {section.bullets.map(line => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                    {section.text ? <p className="kol-guide-p">{section.text}</p> : null}
                  </div>
                ))
              ) : (
                <>
                  {card.subtitle ? <p className="kol-guide-card-sub">{card.subtitle}</p> : null}
                  <ul className="kol-guide-list">
                    {card.bullets.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
        </div>
      );

    case 'rules':
      return (
        <ul className="kol-guide-rules">
          {block.items.map(rule => (
            <li key={rule}>
              <Icon name="checkSquare" size={14} />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      );

    default:
      return null;
  }
}

export default function KolGuidelinesPage() {
  const { t } = useLocale();
  const [activeId, setActiveId] = useState(KOL_GUIDELINES_SECTIONS[0]?.id || '');

  const activeSection = useMemo(
    () => KOL_GUIDELINES_SECTIONS.find(section => section.id === activeId) || KOL_GUIDELINES_SECTIONS[0],
    [activeId]
  );

  if (!activeSection) return null;

  return (
    <div className="kol-guidelines-page">
      <header className="kol-guidelines-header">
        <p className="kol-guidelines-subtitle">{t('hub.kolGuidelines.subtitle')}</p>
      </header>

      <div className="kol-guidelines-layout">
        <aside className="kol-guidelines-nav" aria-label={t('hub.kolGuidelines.sectionsLabel')}>
          <p className="kol-guidelines-nav-label">{t('hub.kolGuidelines.sectionsLabel')}</p>
          <nav className="kol-guidelines-nav-list">
            {KOL_GUIDELINES_SECTIONS.map((section, index) => (
              <button
                key={section.id}
                type="button"
                className={`kol-guidelines-nav-link${activeSection.id === section.id ? ' is-active' : ''}`}
                onClick={() => setActiveId(section.id)}
                aria-current={activeSection.id === section.id ? 'page' : undefined}
              >
                <span className="kol-guidelines-nav-num">{index + 1}</span>
                <span className="kol-guidelines-nav-copy">
                  <span className="kol-guidelines-nav-title">{section.title}</span>
                  <span className="kol-guidelines-nav-summary">{section.summary}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <article className="kol-guidelines-panel" aria-labelledby="kol-guidelines-panel-title">
          <header className="kol-guidelines-panel-head">
            <h2 id="kol-guidelines-panel-title" className="kol-guidelines-panel-title">
              {activeSection.title}
            </h2>
            <p className="kol-guidelines-panel-summary">{activeSection.summary}</p>
          </header>

          <div className="kol-guidelines-panel-body">
            {activeSection.blocks.map((block, index) => (
              <GuideBlock key={`${activeSection.id}-${index}`} block={block} />
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
