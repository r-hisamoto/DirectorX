import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHotkeys } from 'react-hotkeys-hook';
import { Studio } from './pages/Studio';
import { CommandPalette, useCommandPalette } from './components/CommandPalette';
import { ShortcutHelp } from './components/ShortcutHelp';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分
      cacheTime: 10 * 60 * 1000, // 10分
    },
  },
});

export function App() {
  const commandPalette = useCommandPalette();
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // ショートカットヘルプを開く (⌘?)
  useHotkeys('mod+/', (e) => {
    e.preventDefault();
    setShowShortcutHelp(true);
  }, { enableOnFormTags: ['INPUT', 'TEXTAREA'] });

  // ESCでヘルプを閉じる
  useHotkeys('escape', () => {
    if (showShortcutHelp) {
      setShowShortcutHelp(false);
    }
  }, { enableOnFormTags: ['INPUT', 'TEXTAREA'], enabled: showShortcutHelp });

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Routes>
            <Route path="/" element={<Studio />} />
            <Route path="/studio" element={<Studio />} />
          </Routes>

          {/* グローバルコンポーネント */}
          <CommandPalette
            isOpen={commandPalette.isOpen}
            onClose={commandPalette.close}
            onCommand={(command) => {
              console.log('Command executed:', command.label);
            }}
          />

          <ShortcutHelp
            isOpen={showShortcutHelp}
            onClose={() => setShowShortcutHelp(false)}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}