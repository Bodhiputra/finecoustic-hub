'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function HubSidebarBrand({
  title,
  homeHref = '/',
  homeLabel = 'Home',
}) {
  return (
    <div className="hub-sidebar-brand">
      <div className="brand">
        <Link href={homeHref} className="brand-logo-link" aria-label={homeLabel}>
          <Image className="brand-logo" src="/FLogo.png" alt="" width={36} height={36} />
        </Link>
        <div className="hub-sidebar-brand-text">
          <strong>{title}</strong>
        </div>
      </div>
    </div>
  );
}
