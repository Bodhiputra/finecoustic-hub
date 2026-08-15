'use client';

import { useCallback, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  ACTIVE_SKUS,
  calcMetrics,
  formatDataDate,
  inventoryDataUpdatedAt,
  productName,
  shopifyDataUpdatedAt,
  shopifyQty,
} from '@/lib/ops';

export default function OpsStockPanel({
  initialOps,
  shopifyConfigured = false,
  shopifySnapshot = null,
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [ops, setOps] = useState(initialOps);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(shopifyDataUpdatedAt(initialOps));

  const metrics = useMemo(() => calcMetrics(ops), [ops]);
  const inventoryDataUpdated = formatDataDate(inventoryDataUpdatedAt(ops));
  const shopifyDataUpdated = formatDataDate(lastSyncAt);

  const pullFromShopify = useCallback(async () => {
    setPulling(true);
    try {
      const res = await fetch(API_V1.opsShopifyPull, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = body?.error || 'sync_failed';
        const msgKey = `hub.ops.shopify.errors.${code}`;
        const msg = t(msgKey);
        toast.error(msg === msgKey ? t('hub.ops.shopify.errors.sync_failed') : msg);
        return;
      }
      const data = unwrapData(body);
      if (data?.ops) setOps(data.ops);
      if (data?.synced_at) setLastSyncAt(data.synced_at.slice(0, 10));
      toast.success(t('hub.ops.shopify.pullSuccess'));
    } catch {
      toast.error(t('hub.ops.shopify.errors.sync_failed'));
    } finally {
      setPulling(false);
    }
  }, [t, toast]);

  const pushToShopify = useCallback(async () => {
    setPushing(true);
    try {
      const res = await fetch(API_V1.opsShopifyPush, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = body?.error || 'sync_failed';
        const msgKey = `hub.ops.shopify.errors.${code}`;
        const msg = t(msgKey);
        toast.error(msg === msgKey ? t('hub.ops.shopify.errors.sync_failed') : msg);
        return;
      }
      const data = unwrapData(body);
      if (data?.ops) setOps(data.ops);
      if (data?.synced_at) setLastSyncAt(data.synced_at.slice(0, 10));
      const okCount = (data?.results || []).filter(r => r.ok).length;
      toast.success(t('hub.ops.shopify.pushSuccess').replace('{count}', String(okCount)));
    } catch {
      toast.error(t('hub.ops.shopify.errors.sync_failed'));
    } finally {
      setPushing(false);
    }
  }, [t, toast]);

  function shopHint(sku, shop) {
    if (!shopifyConfigured) return t('hub.ops.shopify.notConfigured');
    if (shopifySnapshot?.meta?.synced_at) return t('hub.ops.shopify.syncedFromStore');
    const axia = metrics.metrics[sku]?.axiaAfterOrders;
    if (axia != null && shop != null && axia !== shop) {
      return t('hub.ops.shopify.outOfSync');
    }
    return t('hub.ops.shopify.inSync');
  }

  return (
    <section className="view active">
      <div className="ops-stock-head wrap-row">
        <p className="data-updated-label">
          {t('hub.ops.shopify.inventoryUpdated')}: {inventoryDataUpdated}
          {' · '}
          {t('hub.ops.shopify.shopifyUpdated')}: {shopifyDataUpdated}
        </p>
        <div className="ops-stock-sync-actions">
          <button
            type="button"
            className="hub-btn hub-btn--secondary"
            onClick={pullFromShopify}
            disabled={pulling || pushing || !shopifyConfigured}
            title={shopifyConfigured ? t('hub.ops.shopify.pullButton') : t('hub.ops.shopify.notConfigured')}
          >
            <Icon name="refresh" size={15} />
            <span>{pulling ? t('hub.ops.shopify.pulling') : t('hub.ops.shopify.pullButton')}</span>
          </button>
          <button
            type="button"
            className="hub-btn hub-btn--primary"
            onClick={pushToShopify}
            disabled={pulling || pushing || !shopifyConfigured}
            title={shopifyConfigured ? t('hub.ops.shopify.pushButton') : t('hub.ops.shopify.notConfigured')}
          >
            <Icon name="upload" size={15} />
            <span>{pushing ? t('hub.ops.shopify.pushing') : t('hub.ops.shopify.pushButton')}</span>
          </button>
        </div>
      </div>

      {!shopifyConfigured && (
        <p className="ops-stock-sync-hint personal-hub-hint">{t('hub.ops.shopify.notConfiguredHint')}</p>
      )}

      <div className="stock-cards">
        {ACTIVE_SKUS.map(sku => {
          const m = metrics.metrics[sku];
          const shop = shopifyQty(shopifySnapshot, ops, sku);
          return (
            <article key={sku} className="stock-card">
              <h3>{productName(ops, sku)}</h3>
              <div className="stock-card-locations">
                <div>
                  <span className="stock-location-label">{t('hub.ops.shopify.axiaAvailable')}</span>
                  <span className="stock-location-value">{m.axiaAfterOrders ?? '—'}</span>
                  <span className="stock-location-hint">
                    {m.warehouseQty} {t('hub.ops.shopify.inWarehouse')} · {m.b2bShipped} {t('hub.ops.shopify.shipped')}
                  </span>
                </div>
                <div>
                  <span className="stock-location-label">{t('hub.ops.shopify.onlineStore')}</span>
                  <span className="stock-location-value">{shop != null ? shop : '—'}</span>
                  <span className={`stock-location-hint${m.axiaAfterOrders != null && shop != null && m.axiaAfterOrders !== shop ? ' is-warn' : ''}`}>
                    {shopHint(sku, shop)}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
