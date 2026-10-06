import 'server-only';

export type TmdbErrorKind = 'not_found' | 'rate_limit' | 'network' | 'server' | 'invalid_response';

export class TmdbError extends Error {
  readonly kind: TmdbErrorKind;
  readonly status: number | null;
  readonly path: string;

  constructor(
    kind: TmdbErrorKind,
    path: string,
    status: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(`TMDB request failed (${kind}) for ${path}`, options);
    this.name = 'TmdbError';
    this.kind = kind;
    this.status = status;
    this.path = path;
  }
}
