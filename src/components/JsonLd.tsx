type Props = { data: Record<string, unknown> };

/**
 * Structured data for search engines. `<` is escaped as `<` (still valid
 * JSON) so no value from TMDB can close the script element early.
 */
export function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
