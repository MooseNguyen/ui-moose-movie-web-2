import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { MediaRowSkeleton } from './MediaRowSkeleton';

describe('MediaRowSkeleton', () => {
  it('announces loading to screen readers', () => {
    renderWithIntl(<MediaRowSkeleton />);
    expect(screen.getByText('Loading…')).toHaveClass('sr-only');
  });
});
