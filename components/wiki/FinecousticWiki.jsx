'use client';

import KnowledgeBank from '@/components/knowledge/KnowledgeBank';
import { finecousticWikiUrl } from '@/lib/knowledge';

/** Finecoustic company wiki — same page store as knowledge bank, branded UI at /about. */
export default function FinecousticWiki({ deptBase = '/about', pageId = '' }) {
  return (
    <KnowledgeBank
      departmentId="finecoustic"
      deptBase={deptBase}
      pageId={pageId}
      i18nPrefix="wiki"
      pageUrl={finecousticWikiUrl}
      welcomeClassName="finecoustic-wiki-welcome"
    />
  );
}
