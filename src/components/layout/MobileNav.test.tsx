import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { MobileNav } from './MobileNav';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/movie',
  Link: ({ href, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    // Navigation is not under test; keep jsdom on the page.
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        props.onClick?.(event);
      }}
    />
  ),
}));

const contentRendered = vi.hoisted(() => vi.fn());
vi.mock('./MobileNavSheet', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./MobileNavSheet')>();
  return {
    MobileNavSheet: (
      props: React.ComponentProps<typeof mod.MobileNavSheet>
    ) => {
      contentRendered(props);
      return <mod.MobileNavSheet {...props} />;
    },
  };
});

beforeEach(() => contentRendered.mockClear());

const trigger = () => screen.getByRole('button', { name: 'Open menu' });

describe('MobileNav', () => {
  it('renders only an accessible trigger until needed', () => {
    renderWithIntl(<MobileNav />);

    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(contentRendered).not.toHaveBeenCalled();
  });

  it('loads the menu when the trigger gets focus, without opening it', async () => {
    renderWithIntl(<MobileNav />);

    act(() => trigger().focus());

    await waitFor(() =>
      expect(contentRendered).toHaveBeenCalledWith(
        expect.objectContaining({ open: false })
      )
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens from the keyboard, closes on Escape and returns focus', async () => {
    const user = userEvent.setup();
    renderWithIntl(<MobileNav />);
    const button = trigger();

    await user.tab();
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog', { name: 'Menu' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(dialog).getByRole('link', { name: 'Movies' })
    ).toHaveAttribute('aria-current', 'page');

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after choosing a link and from its localized close button', async () => {
    const user = userEvent.setup();
    renderWithIntl(<MobileNav />);

    await user.click(trigger());
    const dialog = await screen.findByRole('dialog', { name: 'Menu' });
    await user.click(within(dialog).getByRole('link', { name: 'TV Series' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );

    await user.click(trigger());
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Close menu',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(trigger()).toHaveFocus();
  });
});
