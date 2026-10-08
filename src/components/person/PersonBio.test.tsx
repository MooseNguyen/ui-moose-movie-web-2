import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../../../tests/utils/render';
import { PersonBio } from './PersonBio';

const LONG = 'a'.repeat(601);

describe('PersonBio', () => {
  it('renders a short biography without a toggle', () => {
    renderWithIntl(
      <PersonBio text={'Line one.\nLine two.'} isFallback={false} />
    );

    const text = screen.getByText(/Line one\./);
    expect(text).toHaveClass('whitespace-pre-line');
    expect(text).not.toHaveClass('line-clamp-6');
    expect(text).not.toHaveAttribute('lang');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not clamp text of exactly 600 characters', () => {
    renderWithIntl(<PersonBio text={'a'.repeat(600)} isFallback={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clamps a long biography and toggles it', async () => {
    const user = userEvent.setup();
    renderWithIntl(<PersonBio text={LONG} isFallback={false} />);

    const text = screen.getByText(LONG);
    const button = screen.getByRole('button', { name: 'Show more' });
    expect(text).toHaveClass('line-clamp-6');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', text.id);

    await user.click(button);
    expect(text).not.toHaveClass('line-clamp-6');
    expect(button).toHaveAccessibleName('Show less');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveFocus();

    await user.click(button);
    expect(text).toHaveClass('line-clamp-6');
  });

  it('marks an English fallback biography on a Vietnamese page', () => {
    renderWithIntl(<PersonBio text="An actor." isFallback />, 'vi');

    expect(screen.getByText('An actor.')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('(Tiếng Anh)')).toBeInTheDocument();
  });

  it('shows a short message when there is no biography', () => {
    renderWithIntl(<PersonBio text="  " isFallback={false} />);
    expect(screen.getByText('No biography available.')).toBeInTheDocument();
  });
});
