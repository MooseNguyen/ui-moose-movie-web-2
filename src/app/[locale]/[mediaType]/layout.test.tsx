import { notFound } from 'next/navigation';
import MediaTypeLayout from './layout';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const props = (mediaType: string) =>
  ({
    children: 'content',
    params: Promise.resolve({ locale: 'en', mediaType }),
  }) as unknown as LayoutProps<'/[locale]/[mediaType]'>;

// The guard lives in the layout, above loading.tsx's Suspense boundary: it
// runs before the shell is flushed, so the response is a real 404 status
// (a notFound() inside the page would arrive after loading.tsx and become a
// soft 404 with status 200).
describe('[mediaType] layout', () => {
  beforeEach(() => {
    vi.mocked(notFound).mockClear();
  });

  it.each(['movie', 'tv'])('renders children for %s', async (mediaType) => {
    expect(await MediaTypeLayout(props(mediaType))).toBe('content');
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each(['anime', 'Movie', '1', 'discover'])('404s for %s', async (v) => {
    await expect(MediaTypeLayout(props(v))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
