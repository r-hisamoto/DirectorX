import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Settings, Palette } from 'lucide-react';
import { workspaceApi, channelApi, brandkitApi } from '@/lib/api';
import { useEntitiesStore } from '@/store/entities';

interface SelectorProps<T> {
  value: T | null;
  options: T[];
  onSelect: (option: T) => void;
  getLabel: (option: T) => string;
  placeholder: string;
  icon?: React.ReactNode;
}

function Selector<T extends { id: string }>({
  value,
  options,
  onSelect,
  getLabel,
  placeholder,
  icon,
}: SelectorProps<T>) {
  return (
    <div className="relative">
      <button className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary">
        {icon && <span className="w-4 h-4 text-gray-500">{icon}</span>}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 truncate">
          {value ? getLabel(value) : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>
      
      {/* TODO: Implement dropdown menu */}
    </div>
  );
}

export function Header() {
  const {
    currentWorkspace,
    currentChannel,
    currentBrandKit,
    workspaces,
    channels,
    brandkits,
    setCurrentWorkspace,
    setCurrentChannel,
    setCurrentBrandKit,
    setWorkspaces,
    setChannels,
    setBrandkits,
    setLoading,
  } = useEntitiesStore();

  // Load workspaces
  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      setLoading('workspaces', true);
      try {
        const response = await workspaceApi.getAll();
        return response.data.data || [];
      } finally {
        setLoading('workspaces', false);
      }
    },
  });

  // Load channels for current workspace
  const { data: channelsData } = useQuery({
    queryKey: ['channels', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      
      setLoading('channels', true);
      try {
        const response = await channelApi.getAll(currentWorkspace.id);
        return response.data.data || [];
      } finally {
        setLoading('channels', false);
      }
    },
    enabled: !!currentWorkspace,
  });

  // Load brandkits
  const { data: brandkitsData } = useQuery({
    queryKey: ['brandkits'],
    queryFn: async () => {
      setLoading('brandkits', true);
      try {
        const response = await brandkitApi.getAll();
        return response.data.data || [];
      } finally {
        setLoading('brandkits', false);
      }
    },
  });

  // Update store when data is loaded
  useEffect(() => {
    if (workspacesData) {
      setWorkspaces(workspacesData);
      
      // Auto-select first workspace if none selected
      if (!currentWorkspace && workspacesData.length > 0) {
        setCurrentWorkspace(workspacesData[0]);
      }
    }
  }, [workspacesData, currentWorkspace, setWorkspaces, setCurrentWorkspace]);

  useEffect(() => {
    if (channelsData) {
      setChannels(channelsData);
      
      // Auto-select first channel if none selected
      if (!currentChannel && channelsData.length > 0) {
        setCurrentChannel(channelsData[0]);
      }
    }
  }, [channelsData, currentChannel, setChannels, setCurrentChannel]);

  useEffect(() => {
    if (brandkitsData) {
      setBrandkits(brandkitsData);
      
      // Auto-select default brandkit if none selected
      if (!currentBrandKit && brandkitsData.length > 0) {
        const defaultBrandKit = brandkitsData.find(bk => bk.id === 'default') || brandkitsData[0];
        setCurrentBrandKit(defaultBrandKit);
      }
    }
  }, [brandkitsData, currentBrandKit, setBrandkits, setCurrentBrandKit]);

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      {/* Left: Logo and title */}
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          DirectorX
        </h1>
        <div className="text-sm text-gray-500 dark:text-gray-400 font-jp">
          アプリ内完結型動画制作OS
        </div>
      </div>

      {/* Center: Selectors */}
      <div className="flex items-center space-x-4">
        <Selector
          value={currentWorkspace}
          options={workspaces}
          onSelect={setCurrentWorkspace}
          getLabel={(ws) => ws.name}
          placeholder="ワークスペース選択"
          icon={<Settings />}
        />
        
        <span className="text-gray-300 dark:text-gray-600">/</span>
        
        <Selector
          value={currentChannel}
          options={channels}
          onSelect={setCurrentChannel}
          getLabel={(ch) => ch.name}
          placeholder="チャンネル選択"
        />
        
        <span className="text-gray-300 dark:text-gray-600">/</span>
        
        <Selector
          value={currentBrandKit}
          options={brandkits}
          onSelect={setCurrentBrandKit}
          getLabel={(bk) => bk.name}
          placeholder="ブランドキット選択"
          icon={<Palette />}
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => {
            // ⌘Kのキーイベントを発生させる
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              ctrlKey: true,
              bubbles: true
            }));
          }}
          className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          ⌘K コマンド
        </button>
      </div>
    </header>
  );
}