import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkipLink } from '@/components/ui/SkipLink';
import { Dropdown } from '@/components/ui/Dropdown';

describe('SkipLink', () => {
  it('is hidden by default', () => {
    render(<SkipLink />);
    const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
    expect(skipLink).toHaveClass('sr-only');
  });

  it('has focus-visible class to reveal on focus', () => {
    render(<SkipLink />);
    const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
    expect(skipLink).toHaveClass('focus:not-sr-only');
    expect(skipLink).toHaveClass('focus:absolute');
    expect(skipLink).toHaveClass('focus:z-50');
  });

  it('links to main content anchor', () => {
    render(<SkipLink />);
    const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('is focusable via keyboard (tabindex)', () => {
    render(<SkipLink />);
    const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
    expect(skipLink.getAttribute('tabindex')).not.toBe('-1');
  });
});

describe('Dropdown keyboard navigation', () => {
  const items = [
    { label: 'Edit', value: 'edit' },
    { label: 'Delete', value: 'delete', destructive: true },
  ];

  it('opens menu when trigger is clicked', () => {
    render(
      <Dropdown
        trigger={<button aria-label="More options">···</button>}
        items={items}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes menu when Escape is pressed', () => {
    render(
      <Dropdown
        trigger={<button aria-label="More options">···</button>}
        items={items}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('invokes onSelect when Enter is pressed on a menu item', () => {
    const onSelect = vi.fn();
    render(
      <Dropdown
        trigger={<button aria-label="More options">···</button>}
        items={items}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    const editItem = screen.getByRole('menuitem', { name: 'Edit' });
    fireEvent.keyDown(editItem, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('edit');
  });

  it('invokes onSelect when Space is pressed on a menu item', () => {
    const onSelect = vi.fn();
    render(
      <Dropdown
        trigger={<button aria-label="More options">···</button>}
        items={items}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    const editItem = screen.getByRole('menuitem', { name: 'Edit' });
    fireEvent.keyDown(editItem, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith('edit');
  });

  it('invokes onSelect when a menu item is clicked', () => {
    const onSelect = vi.fn();
    render(
      <Dropdown
        trigger={<button aria-label="More options">···</button>}
        items={items}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onSelect).toHaveBeenCalledWith('edit');
  });
});
