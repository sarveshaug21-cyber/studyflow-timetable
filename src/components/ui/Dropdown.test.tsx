import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Dropdown } from './Dropdown';
import type { DropdownItem } from './Dropdown';

const items: DropdownItem[] = [
  { label: 'Edit', value: 'edit' },
  { label: 'Delete', value: 'delete', destructive: true },
];

function renderDropdown() {
  return render(
    <Dropdown trigger={<button aria-label="More options">···</button>} items={items} onSelect={() => {}} />,
  );
}

function openMenu() {
  act(() => {
    screen.getByRole('button', { name: 'More options' }).click();
  });
}

describe('Dropdown', () => {
  it('renders the trigger but keeps the menu closed by default', () => {
    renderDropdown();
    expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens the menu and reveals items when the trigger is activated', () => {
    renderDropdown();
    openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('closes the menu when an item is clicked', () => {
    renderDropdown();
    openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    act(() => {
      screen.getByRole('menuitem', { name: 'Edit' }).click();
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('invokes onSelect with the item value when a menu item is chosen', () => {
    const onSelect = vi.fn();
    render(
      <Dropdown trigger={<button aria-label="More options">···</button>} items={items} onSelect={onSelect} />,
    );
    openMenu();
    act(() => {
      screen.getByRole('menuitem', { name: 'Delete' }).click();
    });
    expect(onSelect).toHaveBeenCalledWith('delete');
  });
});
