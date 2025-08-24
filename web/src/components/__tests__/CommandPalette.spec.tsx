import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../CommandPalette';

describe('CommandPalette', () => {
  const mockOnClose = jest.fn();
  const mockOnCommand = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnCommand.mockClear();
  });

  it('renders when open', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onCommand={mockOnCommand}
      />
    );

    expect(screen.getByPlaceholderText(/コマンドを検索/)).toBeInTheDocument();
    expect(screen.getByText('素材')).toBeInTheDocument();
    expect(screen.getByText('台本')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <CommandPalette
        isOpen={false}
        onClose={mockOnClose}
        onCommand={mockOnCommand}
      />
    );

    expect(screen.queryByPlaceholderText(/コマンドを検索/)).not.toBeInTheDocument();
  });

  it('filters commands by search input', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onCommand={mockOnCommand}
      />
    );

    const searchInput = screen.getByPlaceholderText(/コマンドを検索/);
    fireEvent.change(searchInput, { target: { value: '台本' } });

    expect(screen.getByText('台本を生成')).toBeInTheDocument();
    expect(screen.queryByText('素材を追加')).not.toBeInTheDocument();
  });

  it('executes command on click', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onCommand={mockOnCommand}
      />
    );

    const command = screen.getByText('台本を生成');
    fireEvent.click(command);

    expect(mockOnCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        label: '台本を生成',
        category: 'script',
      })
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows command count', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onCommand={mockOnCommand}
      />
    );

    expect(screen.getByText(/件のコマンド/)).toBeInTheDocument();
  });
});