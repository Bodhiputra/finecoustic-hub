'use client';

import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';

export default function KolWeibinColumnActions({
  exportableCount = 0,
  selectMode = false,
  selectedExportCount = 0,
  onEnterSelectMode,
  onExitSelectMode,
  onExportSelected,
  onExportAll,
  compact = false,
}) {
  const { t } = useLocale();
  const showExportAll = exportableCount > 0;

  return (
    <div className={`kol-weibin-col-actions${compact ? ' is-compact' : ''}`}>
      {!selectMode ? (
        <button
          type="button"
          className="kol-weibin-col-btn kol-weibin-col-btn--select"
          onClick={onEnterSelectMode}
        >
          {t('hub.campaignKol.enterSelectMode')}
        </button>
      ) : (
        <>
          <button
            type="button"
            className="kol-weibin-col-btn"
            onClick={onExportSelected}
            disabled={selectedExportCount === 0}
          >
            <Icon name="download" size={14} />
            <span>
              {t('hub.campaignKol.weibinExportSelected').replace('{count}', String(selectedExportCount))}
            </span>
          </button>
          <button
            type="button"
            className="kol-weibin-col-btn kol-weibin-col-btn--ghost"
            onClick={onExitSelectMode}
          >
            {t('hub.campaignKol.exitSelectMode')}
          </button>
        </>
      )}
      {showExportAll ? (
        <button
          type="button"
          className="kol-weibin-col-btn"
          onClick={onExportAll}
          title={t('hub.campaignKol.weibinExportAll')}
        >
          <Icon name="download" size={14} />
          <span>{t('hub.campaignKol.weibinExportAll')}</span>
        </button>
      ) : null}
    </div>
  );
}
