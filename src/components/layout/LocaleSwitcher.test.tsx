import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { LocaleSwitcher } from './LocaleSwitcher';

const replace = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/movie/123',
  useRouter: () => ({ replace }),
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replace.mockClear();
    window.history.pushState({}, '', '/vi/movie/123?page=2');
  });

  it('switches locale keeping the pathname and query string', async () => {
    const user = userEvent.setup();
    renderWithIntl(<LocaleSwitcher />, 'vi');

    await user.click(screen.getByRole('button', { name: 'Ngôn ngữ' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'English' }));

    expect(replace).toHaveBeenCalledWith('/movie/123?page=2', {
      locale: 'en',
    });
  });

  it('does nothing when the current locale is chosen', async () => {
    const user = userEvent.setup();
    renderWithIntl(<LocaleSwitcher />, 'vi');

    await user.click(screen.getByRole('button', { name: 'Ngôn ngữ' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Tiếng Việt' }));

    expect(replace).not.toHaveBeenCalled();
  });
});
