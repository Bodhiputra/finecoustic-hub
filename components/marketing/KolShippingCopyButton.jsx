'use client';

import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { hasKolShippingClipboard, kolShippingClipboardText } from '@/lib/kol-pool';

/** Copy KOL pool shipping address in carrier-friendly English format. */
export default function KolShippingCopyButton({
  record,
  className = 'kol-pool-shipping-btn',
  size = 16,
  showLabel = false,
}) {
  const { t } = useLocale();
  const { toast } = useToast();

  if (!record || !hasKolShippingClipboard(record)) return null;

  async function handleCopy(e) {
    e?.stopPropagation?.();
    const text = kolShippingClipboardText(record);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('hub.kol.shippingCopied'));
    } catch {
      toast.error(t('common.somethingWrong'));
    }
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={t('hub.kol.shippingCopy')}
      title={t('hub.kol.shippingCopy')}
      onClick={handleCopy}
    >
      <Icon name="copy" size={size} />
      {showLabel ? <span>{t('hub.kol.shippingCopy')}</span> : null}
    </button>
  );
}
