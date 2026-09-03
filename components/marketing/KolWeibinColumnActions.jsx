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
  shortLabels = false,
}) {
  const { t } = useLocale();
  const showExportAll = exportableCount > 0;
  const selectLabel = t(shortLabels ? 'hub.campaignKol.enterSelectModeShort' : 'hub.campaignKol.enterSelectMode');
  const exportAllLabel = t(shortLabels ? 'hub.campaignKol.weibinExportAllShort' : 'hub.campaignKol.weibinExportAll');
  const exportSelectedLabel = t(
    shortLabels ? 'hub.campaignKol.weibinExportSelectedShort' : 'hub.campaignKol.weibinExportSelected'
  ).replace('{count}', String(selectedExportCount));
  const exportAllTitle = t('hub.campaignKol.weibinExportAll');

  return (
    <div className={`kol-weibin-col-actions${compact ? ' is-compact' : ''}${shortLabels ? ' is-short' : ''}`}>
      {!selectMode ? (
        <button
          type="button"
          className="kol-weibin-col-btn kol-weibin-col-btn--select"
          onClick={onEnterSelectMode}
        >
          {selectLabel}
        </button>
      ) : (
        <>
          <button
            type="button"
            className="kol-weibin-col-btn"
            onClick={onExportSelected}
            disabled={selectedExportCount === 0}
            title={t('hub.campaignKol.weibinExportSelected').replace('{count}', String(selectedExportCount))}
          >
            <Icon name="download" size={14} />
            <span>{exportSelectedLabel}</span>
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
          title={exportAllTitle}
        >
          <Icon name="download" size={14} />
          <span>{exportAllLabel}</span>
        </button>
      ) : null}
    </div>
  );
}
