import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // `[.]` instead of an escaped dot: escapes inside this string literal are
  // easy to lose (`'\.'` collapses to `.`), which silently narrows the matcher.
  matcher: '/((?!api|trpc|_next|_vercel|.*[.].*).*)',
};
