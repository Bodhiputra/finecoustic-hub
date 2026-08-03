'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import ProductOverview from '@/components/products/ProductOverview';
import ProductIssuesBoard from '@/components/products/ProductIssuesBoard';
import ProductIssuePanel from '@/components/products/ProductIssuePanel';
import ProductRefinementsList from '@/components/products/ProductRefinementsList';
import ProductRefinementPanel from '@/components/products/ProductRefinementPanel';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { usePrompt } from '@/hooks/usePrompt';
import { useToast } from '@/hooks/useToast';
import { API_V1, unwrapData } from '@/lib/api/routes';
import {
  PRODUCT_TABS,
  productUrl,
} from '@/lib/products';

const TAB_LABELS = {
  overview: 'Overview',
  issues: 'Issues',
  refinements: 'Refinements',
};

export default function ProductsWorkspace({
  initialProducts = null,
  initialDetail = null,
  productSku = '',
  activeTab = 'overview',
  displayName = '',
  isManager = false,
}) {
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const { requestPrompt, promptDialog } = usePrompt();
  const { toast, toastStack } = useToast();

  const [products, setProducts] = useState(() => initialProducts ?? []);
  const [detail, setDetail] = useState(initialDetail);
  const [loading, setLoading] = useState(initialProducts == null);
  const [busy, setBusy] = useState(false);
  const [savingOverview, setSavingOverview] = useState(false);
  const [overviewEditing, setOverviewEditing] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState(null);
  const [panelItem, setPanelItem] = useState(null);
  const [panelKind, setPanelKind] = useState('issue');
  const [savingItem, setSavingItem] = useState(false);
  const [issuesView, setIssuesView] = useState('board');

  const tab = PRODUCT_TABS.includes(activeTab) ? activeTab : 'overview';
  const sku = String(productSku || '').trim().toUpperCase();

  const refreshProducts = useCallback(async () => {
    const res = await fetch(API_V1.products, { credentials: 'same-origin' });
    if (!res.ok) return false;
    const body = await res.json();
    const data = unwrapData(body);
    setProducts(Array.isArray(data?.products) ? data.products : []);
    return true;
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!sku) return false;
    const res = await fetch(API_V1.product(sku), { credentials: 'same-origin' });
    if (!res.ok) return false;
    const body = await res.json();
    const data = unwrapData(body);
    setDetail(data);
    setOverviewDraft(data?.product || null);
    return data;
  }, [sku]);

  useEffect(() => {
    if (initialProducts != null) return;
    setLoading(true);
    refreshProducts().finally(() => setLoading(false));
  }, [initialProducts, refreshProducts]);

  useEffect(() => {
    if (!sku) {
      setDetail(null);
      setOverviewDraft(null);
      setOverviewEditing(false);
      return;
    }
    if (initialDetail?.product?.sku === sku) {
      setDetail(initialDetail);
      setOverviewDraft(initialDetail.product);
      return;
    }
    refreshDetail();
  }, [sku, initialDetail, refreshDetail]);

  useEffect(() => {
    setOverviewEditing(false);
    setPanelItem(null);
  }, [sku, tab]);

  const issues = useMemo(
    () => (detail?.items || []).filter(item => item.kind === 'issue'),
    [detail]
  );
  const refinements = useMemo(
    () => (detail?.items || []).filter(item => item.kind === 'refinement'),
    [detail]
  );

  async function addProduct() {
    const rawSku = await requestPrompt({
      title: 'Add product',
      label: 'SKU (e.g. FBS1)',
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!rawSku) return;
    const name = await requestPrompt({
      title: 'Add product',
      label: 'Display name',
      defaultValue: rawSku.trim().toUpperCase(),
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    });
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.products, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ sku: rawSku.trim(), name: name.trim() }),
      });
      if (res.ok) {
        await refreshProducts();
        toast.success('Product created');
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveOverview() {
    if (!sku || !overviewDraft) return;
    setSavingOverview(true);
    try {
      const res = await fetch(API_V1.product(sku), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: overviewDraft.name,
          description: overviewDraft.description,
          price_display: overviewDraft.price_display,
          image_url: overviewDraft.image_url,
          launched_at: overviewDraft.launched_at || null,
          status: overviewDraft.status,
          specs: { md: overviewDraft.specs?.md || '' },
        }),
      });
      if (res.ok) {
        await refreshDetail();
        setOverviewEditing(false);
        toast.success('Saved');
      } else {
        toast.error(t('common.somethingWrong'));
      }
    } finally {
      setSavingOverview(false);
    }
  }

  function openNewItem(kind) {
    setPanelKind(kind);
    setPanelItem({
      _draft: true,
      kind,
      product_sku: sku,
      title: '',
      body: '',
      source: 'other',
      status: kind === 'refinement' ? 'idea' : 'open',
      assignee: '',
      comments: [],
    });
  }

  function openIssue(item) {
    setPanelKind('issue');
    setPanelItem(item);
  }

  function openRefinement(item) {
    setPanelKind('refinement');
    setPanelItem(item);
  }

  async function saveItem(draft, { closeOnSave = false } = {}) {
    setSavingItem(true);
    try {
      const isNew = !draft.id || draft._draft;
      const res = await fetch(
        isNew ? API_V1.productItems(sku) : API_V1.productItem(draft.id),
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            kind: draft.kind,
            title: draft.title,
            body: draft.body,
            source: draft.source,
            status: draft.status,
            assignee: draft.assignee,
          }),
        }
      );
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const body = await res.json();
      const data = unwrapData(body);
      const saved = data?.item;
      const refreshed = await refreshDetail();
      await refreshProducts();

      if (closeOnSave || draft.kind === 'refinement') {
        setPanelItem(null);
      } else if (saved) {
        setPanelItem(saved);
      } else if (refreshed?.items) {
        const match = refreshed.items.find(i => i.id === draft.id);
        if (match) setPanelItem(match);
      }
    } finally {
      setSavingItem(false);
    }
  }

  async function updateIssueStatus(item, status) {
    const res = await fetch(API_V1.productItem(item.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await refreshDetail();
      await refreshProducts();
    }
  }

  async function deleteItem(id) {
    const ok = await requestConfirm({
      title: 'Delete item',
      message: 'Remove this item permanently?',
      confirmLabel: 'Delete',
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    const res = await fetch(API_V1.productItem(id), { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) {
      setPanelItem(null);
      await refreshDetail();
      await refreshProducts();
    }
  }

  if (loading) {
    return <p className="internal-empty-hint">Loading products…</p>;
  }

  if (!sku) {
    return (
      <div className="products-catalog">
        <header className="products-catalog-head">
          <div>
            <h1 className="products-catalog-title">{t('hub.products.catalogTitle')}</h1>
            <p className="products-catalog-desc">{t('hub.products.catalogDesc')}</p>
          </div>
          {isManager ? (
            <button type="button" className="appdev-btn-primary" onClick={addProduct} disabled={busy}>
              <Icon name="plus" size={16} />
              {t('hub.products.addProduct')}
            </button>
          ) : null}
        </header>
        {!products.length ? (
          <div className="products-section-empty">
            <Icon name="box" size={28} />
            <p>{t('hub.products.noProducts')}</p>
          </div>
        ) : (
          <div className="products-grid">
            {products.map(product => (
              <Link key={product.sku} href={productUrl(product.sku)} className="products-card">
                <div className="products-card-media">
                  {product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image_url} alt={product.name} />
                  ) : (
                    <span className="products-card-placeholder">{product.sku}</span>
                  )}
                </div>
                <div className="products-card-body">
                  <span className="products-card-name">{product.name}</span>
                  <span className="products-card-sku">{product.sku}</span>
                  {product.open_issue_count > 0 ? (
                    <span className="products-card-badge">
                      {product.open_issue_count} open {product.open_issue_count === 1 ? 'issue' : 'issues'}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
        {confirmDialog}
        {promptDialog}
        {toastStack}
      </div>
    );
  }

  if (!detail?.product) {
    return (
      <div className="products-section-empty">
        <p>{t('hub.products.notFound')}</p>
        <Link href="/products" className="products-back-link">
          <Icon name="arrowLeft" size={14} />
          {t('hub.products.backToCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <div className="products-workspace">
      <header className="products-workspace-nav">
        <Link href="/products" className="products-back-link">
          <Icon name="arrowLeft" size={14} />
          {t('hub.products.backToCatalog')}
        </Link>
        {tab !== 'overview' ? (
          <p className="products-workspace-subtitle">
            {detail.product.name}
            <span className="products-workspace-sku">{detail.product.sku}</span>
          </p>
        ) : null}
        <nav className="internal-dept-view-tabs products-workspace-tabs" role="tablist" aria-label="Product sections">
          {PRODUCT_TABS.map(id => (
            <Link
              key={id}
              href={productUrl(sku, { tab: id })}
              className={`internal-dept-view-tab${tab === id ? ' is-active' : ''}`}
              role="tab"
              aria-selected={tab === id}
            >
              {TAB_LABELS[id] || id}
            </Link>
          ))}
        </nav>
      </header>

      <div className="products-workspace-body">
      {tab === 'overview' && (
        <ProductOverview
          product={detail.product}
          draft={overviewDraft}
          editing={overviewEditing}
          saving={savingOverview}
          canEdit={isManager}
          onEdit={() => {
            setOverviewDraft({ ...detail.product });
            setOverviewEditing(true);
          }}
          onCancelEdit={() => {
            setOverviewDraft(detail.product);
            setOverviewEditing(false);
          }}
          onDraftChange={setOverviewDraft}
          onSave={saveOverview}
        />
      )}

      {tab === 'issues' && (
        <ProductIssuesBoard
          sku={sku}
          issues={issues}
          view={issuesView}
          onViewChange={setIssuesView}
          onIssueClick={openIssue}
          onStatusChange={updateIssueStatus}
          onAddIssue={() => openNewItem('issue')}
        />
      )}

      {tab === 'refinements' && (
        <ProductRefinementsList
          refinements={refinements}
          onAdd={() => openNewItem('refinement')}
          onOpen={openRefinement}
        />
      )}
      </div>

      {panelItem && panelKind === 'issue' ? (
        <ProductIssuePanel
          item={panelItem}
          onClose={() => setPanelItem(null)}
          onSave={draft => saveItem({ ...draft, kind: 'issue' })}
          onDelete={panelItem.id ? deleteItem : null}
          displayName={displayName}
          saving={savingItem}
        />
      ) : null}

      {panelItem && panelKind === 'refinement' ? (
        <ProductRefinementPanel
          item={panelItem}
          onClose={() => setPanelItem(null)}
          onSave={draft => saveItem({ ...draft, kind: 'refinement' }, { closeOnSave: true })}
          onDelete={panelItem.id ? deleteItem : null}
          saving={savingItem}
        />
      ) : null}

      {confirmDialog}
      {promptDialog}
      {toastStack}
    </div>
  );
}
