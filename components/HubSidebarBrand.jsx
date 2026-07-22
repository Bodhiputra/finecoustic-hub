'use client';

import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';

export default function HubSidebarBrand({
  title,
  backHref = null,
  backLabel = 'Back',
}) {
  return (
    <div className="hub-sidebar-brand">
      <div className="brand">
        {backHref ? (
          <Link href={backHref} className="brand-back" aria-label={backLabel}>
            <Icon name="arrowLeft" size={16} />
          </Link>
        ) : null}
        <Image className="brand-logo" src="/FLogo.png" alt="" width={36} height={36} />
        <div className="hub-sidebar-brand-text">
          <strong>{title}</strong>
        </div>
      </div>
    </div>
  );
}
