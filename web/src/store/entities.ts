import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Workspace, Channel, BrandKit } from '@/types';

interface EntitiesState {
  // Current selections
  currentWorkspace: Workspace | null;
  currentChannel: Channel | null;
  currentBrandKit: BrandKit | null;

  // Collections
  workspaces: Workspace[];
  channels: Channel[];
  brandkits: BrandKit[];

  // Loading states
  loading: {
    workspaces: boolean;
    channels: boolean;
    brandkits: boolean;
  };

  // Actions
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  setCurrentChannel: (channel: Channel | null) => void;
  setCurrentBrandKit: (brandkit: BrandKit | null) => void;

  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;

  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (id: string, updates: Partial<Channel>) => void;
  removeChannel: (id: string) => void;

  setBrandkits: (brandkits: BrandKit[]) => void;
  addBrandkit: (brandkit: BrandKit) => void;
  updateBrandkit: (id: string, updates: Partial<BrandKit>) => void;
  removeBrandkit: (id: string) => void;

  setLoading: (key: keyof EntitiesState['loading'], value: boolean) => void;
}

export const useEntitiesStore = create<EntitiesState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentWorkspace: null,
      currentChannel: null,
      currentBrandKit: null,

      workspaces: [],
      channels: [],
      brandkits: [],

      loading: {
        workspaces: false,
        channels: false,
        brandkits: false,
      },

      // Current selections actions
      setCurrentWorkspace: (workspace) => {
        set({ currentWorkspace: workspace });
        
        // Reset current channel when workspace changes
        const { currentChannel } = get();
        if (currentChannel && workspace?.id !== currentChannel.workspaceId) {
          set({ currentChannel: null });
        }
      },

      setCurrentChannel: (channel) => {
        set({ currentChannel: channel });
        
        // Auto-set brandkit when channel changes
        if (channel?.brandKitId) {
          const { brandkits } = get();
          const brandkit = brandkits.find(bk => bk.id === channel.brandKitId);
          if (brandkit) {
            set({ currentBrandKit: brandkit });
          }
        }
      },

      setCurrentBrandKit: (brandkit) => {
        set({ currentBrandKit: brandkit });
      },

      // Workspace actions
      setWorkspaces: (workspaces) => set({ workspaces }),
      addWorkspace: (workspace) => {
        const { workspaces } = get();
        set({ workspaces: [...workspaces, workspace] });
      },
      updateWorkspace: (id, updates) => {
        const { workspaces } = get();
        set({
          workspaces: workspaces.map(ws => 
            ws.id === id ? { ...ws, ...updates } : ws
          ),
        });
      },
      removeWorkspace: (id) => {
        const { workspaces } = get();
        set({ workspaces: workspaces.filter(ws => ws.id !== id) });
      },

      // Channel actions
      setChannels: (channels) => set({ channels }),
      addChannel: (channel) => {
        const { channels } = get();
        set({ channels: [...channels, channel] });
      },
      updateChannel: (id, updates) => {
        const { channels } = get();
        set({
          channels: channels.map(ch => 
            ch.id === id ? { ...ch, ...updates } : ch
          ),
        });
      },
      removeChannel: (id) => {
        const { channels } = get();
        set({ channels: channels.filter(ch => ch.id !== id) });
      },

      // BrandKit actions
      setBrandkits: (brandkits) => set({ brandkits }),
      addBrandkit: (brandkit) => {
        const { brandkits } = get();
        set({ brandkits: [...brandkits, brandkit] });
      },
      updateBrandkit: (id, updates) => {
        const { brandkits } = get();
        set({
          brandkits: brandkits.map(bk => 
            bk.id === id ? { ...bk, ...updates } : bk
          ),
        });
      },
      removeBrandkit: (id) => {
        const { brandkits } = get();
        set({ brandkits: brandkits.filter(bk => bk.id !== id) });
      },

      // Loading actions
      setLoading: (key, value) => {
        set(state => ({
          loading: { ...state.loading, [key]: value },
        }));
      },
    }),
    { name: 'entities-store' }
  )
);