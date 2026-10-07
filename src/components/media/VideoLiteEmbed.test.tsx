import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { VideoLiteEmbed } from './VideoLiteEmbed';
import type { Video } from '@/lib/tmdb/types';

const video: Video = {
  key: 'abc123',
  name: 'Official Trailer',
  type: 'Trailer',
  official: true,
};
const getIframe = () => document.querySelector('iframe');

describe('VideoLiteEmbed', () => {
  it('renders a thumbnail button and no iframe initially', () => {
    renderWithIntl(<VideoLiteEmbed video={video} />);
    expect(getIframe()).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Play: Official Trailer' })
    ).toHaveAttribute('type', 'button');
    const img = document.querySelector('img')!;
    expect(decodeURIComponent(img.getAttribute('src')!)).toContain(
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
    );
    expect(img).toHaveAttribute('alt', '');
    expect(screen.getByText('Official Trailer')).toBeVisible();
  });

  it('uses the Vietnamese accessible name', () => {
    renderWithIntl(<VideoLiteEmbed video={video} />, 'vi');
    expect(
      screen.getByRole('button', { name: 'Phát: Official Trailer' })
    ).toBeInTheDocument();
  });

  it('renders the autoplay iframe and focuses it after a click', async () => {
    const user = userEvent.setup();
    renderWithIntl(<VideoLiteEmbed video={video} />);
    await user.click(screen.getByRole('button'));
    const iframe = getIframe()!;
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1'
    );
    expect(iframe).toHaveAttribute('title', 'Official Trailer');
    expect(iframe).toHaveFocus();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the iframe with the keyboard (Enter)', async () => {
    const user = userEvent.setup();
    renderWithIntl(<VideoLiteEmbed video={video} />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(getIframe()).not.toBeNull();
  });
});
