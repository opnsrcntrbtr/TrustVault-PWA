import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SortDropdown from '../SortDropdown';

describe('SortDropdown', () => {
  it('shows the current selection', () => {
    render(<SortDropdown value="updated-desc" onChange={() => {}} />);
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument();
    expect(screen.getByText('Recently Updated')).toBeInTheDocument();
  });

  it('renders every sort option, including the new ones, when opened', () => {
    render(<SortDropdown value="title-asc" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const listbox = within(screen.getByRole('listbox'));
    ['Title A-Z', 'Title Z-A', 'Recently Updated', 'Recently Created', 'Recently Used', 'Favorites First', 'Weakest First'].forEach(
      (label) => { expect(listbox.getByText(label)).toBeInTheDocument(); }
    );
  });

  it('fires onChange with the selected option value', () => {
    const onChange = vi.fn();
    render(<SortDropdown value="title-asc" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(screen.getByRole('listbox')).getByText('Weakest First'));
    expect(onChange).toHaveBeenCalledWith('security-asc');
  });
});
