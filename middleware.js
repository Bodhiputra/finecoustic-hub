import { NextResponse } from 'next/server';
import { isHubAuthEnabled } from '@/lib/auth';
import { resolveSessionAccess } from '@/lib/session-token';

function isPublicAsset(pathname) {
  return (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/fonts/') ||
    pathname === '/favicon.ico' ||
    pathname === '/FLogo.png'
  );
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  if (isPublicAsset(pathname)) return NextResponse.next();

  const withPathname = response => {
    const next = response ?? NextResponse.next();
    next.headers.set('x-hub-pathname', pathname);
    return next;
  };

  // Large multipart uploads — auth is enforced in the route handler; skip middleware
  // so Next.js does not buffer/truncate the body (10MB default).
  if (pathname === '/api/appdev/upload' || pathname === '/api/v1/internal/upload') {
    return withPathname(NextResponse.next());
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.HUB_DEV_BYPASS_AUTH === '1'
  ) {
    return withPathname(NextResponse.next());
  }

  const appdevPassword = (process.env.APPDEV_PASSWORD || '').trim();
  const access = await resolveSessionAccess(request.cookies);

  // —— App development realm (isolated) ——
  if (pathname.startsWith('/appdev') || pathname.startsWith('/api/appdev') || pathname.startsWith('/api/auth/appdev')) {
    if (pathname === '/appdev/login') {
      return NextResponse.redirect(new URL('/appdev', request.url));
    }

    if (
      pathname === '/appdev' ||
      pathname.startsWith('/api/auth/appdev/login') ||
      pathname.startsWith('/api/auth/appdev/signup') ||
      pathname.startsWith('/api/auth/appdev/logout')
    ) {
      return withPathname(NextResponse.next());
    }

    if (!appdevPassword) return withPathname(NextResponse.next());
    if (access.hasAppdev) return withPathname(NextResponse.next());

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(new URL('/appdev', request.url));
  }

  // —— Main hub realm ——
  if (
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/me' ||
    pathname.startsWith('/api/auth/hub/') ||
    pathname === '/api/public/preorder-survey' ||
    pathname === '/api/public/preorder-reserved' ||
    pathname === '/api/public/preorder-register' ||
    pathname.startsWith('/api/shopify-proxy/')
  ) {
    return withPathname(NextResponse.next());
  }

  if (pathname === '/' || pathname === '/login') {
    return withPathname(NextResponse.next());
  }

  if (!isHubAuthEnabled()) return withPathname(NextResponse.next());
  if (access.hasHub) return withPathname(NextResponse.next());

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const home = new URL('/', request.url);
  home.searchParams.set('from', pathname);
  return NextResponse.redirect(home);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
