// Client-safe on purpose: imported by the SearchBox input. route-params.ts
// cannot be imported from client code because it reads list constants from
// the server-only TMDB module, so the shared limit lives here and
// route-params re-exports it for server code.

/** One limit for the search input, the search page and the Server Action. */
export const MAX_QUERY_LENGTH = 100;
