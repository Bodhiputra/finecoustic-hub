import { NextResponse } from 'next/server';
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

  // Large multipart uploads — auth is enforced in the route handler; skip middleware
  // so Next.js does not buffer/truncate the body (10MB default).
  if (pathname === '/api/appdev/upload') {
    return NextResponse.next();
  }

  const hubPassword = (process.env.OPS_HUB_PASSWORD || '').trim();
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
      return NextResponse.next();
    }

    if (!appdevPassword) return NextResponse.next();
    if (access.hasAppdev) return NextResponse.next();

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(new URL('/appdev', request.url));
  }

  // —— Main hub realm ——
  if (pathname === '/api/auth/login' || pathname === '/api/auth/logout' || pathname === '/api/auth/me') {
    return NextResponse.next();
  }

  if (pathname === '/' || pathname === '/login') {
    return NextResponse.next();
  }

  if (!hubPassword) return NextResponse.next();
  if (access.hasHub) return NextResponse.next();

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
