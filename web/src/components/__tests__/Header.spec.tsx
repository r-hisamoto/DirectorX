import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '../Header';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Header', () => {
  it('renders DirectorX title', () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <Header />
      </QueryClientProvider>
    );

    expect(screen.getByText('DirectorX')).toBeInTheDocument();
    expect(screen.getByText('アプリ内完結型動画制作OS')).toBeInTheDocument();
  });

  it('renders selectors', () => {
    const queryClient = createTestQueryClient();
    
    render(
      <QueryClientProvider client={queryClient}>
        <Header />
      </QueryClientProvider>
    );

    expect(screen.getByText('ワークスペース選択')).toBeInTheDocument();
    expect(screen.getByText('チャンネル選択')).toBeInTheDocument();
    expect(screen.getByText('ブランドキット選択')).toBeInTheDocument();
  });
});