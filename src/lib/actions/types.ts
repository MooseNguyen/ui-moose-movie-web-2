export type ActionError =
  'invalid_input' | 'not_found' | 'rate_limit' | 'network' | 'unknown';

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: ActionError };
