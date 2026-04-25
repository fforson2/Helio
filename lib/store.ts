"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Property, SavedProperty } from "@/types/property";
import { BuyerPreferences, UserProfile } from "@/types/user";
import { ChatMessage } from "@/types/session";

interface PropertyStore {
  properties: Property[];
  filteredIds: string[];
  selectedPropertyId: string | null;
  savedProperties: SavedProperty[];
  comparisonIds: string[];
  filters: Partial<BuyerPreferences>;
  setProperties: (props: Property[]) => void;
  setFilteredIds: (ids: string[]) => void;
  selectProperty: (id: string | null) => void;
  saveProperty: (id: string, notes?: string) => void;
  unsaveProperty: (id: string) => void;
  isPropertySaved: (id: string) => boolean;
  addToComparison: (id: string) => void;
  removeFromComparison: (id: string) => void;
  clearComparison: () => void;
  setFilters: (filters: Partial<BuyerPreferences>) => void;
}

export const usePropertyStore = create<PropertyStore>()(
  persist(
    (set, get) => ({
      properties: [],
      filteredIds: [],
      selectedPropertyId: null,
      savedProperties: [],
      comparisonIds: [],
      filters: {},
      setProperties: (props) =>
        set({ properties: props, filteredIds: props.map((p) => p.id) }),
      setFilteredIds: (ids) => set({ filteredIds: ids }),
      selectProperty: (id) => set({ selectedPropertyId: id }),
      saveProperty: (id, notes) => {
        const existing = get().savedProperties.find((s) => s.propertyId === id);
        if (!existing) {
          set((state) => ({
            savedProperties: [
              ...state.savedProperties,
              { propertyId: id, savedAt: new Date().toISOString(), notes },
            ],
          }));
        }
      },
      unsaveProperty: (id) =>
        set((state) => ({
          savedProperties: state.savedProperties.filter(
            (s) => s.propertyId !== id
          ),
        })),
      isPropertySaved: (id) =>
        get().savedProperties.some((s) => s.propertyId === id),
      addToComparison: (id) => {
        const { comparisonIds } = get();
        if (comparisonIds.length >= 3 || comparisonIds.includes(id)) return;
        set({ comparisonIds: [...comparisonIds, id] });
      },
      removeFromComparison: (id) =>
        set((state) => ({
          comparisonIds: state.comparisonIds.filter((cid) => cid !== id),
        })),
      clearComparison: () => set({ comparisonIds: [] }),
      setFilters: (filters) => set({ filters }),
    }),
    {
      name: "helio-property-store",
      partialize: (state) => ({
        savedProperties: state.savedProperties,
        comparisonIds: state.comparisonIds,
        filters: state.filters,
      }),
    }
  )
);

interface UserStore {
  profile: UserProfile | null;
  onboardingComplete: boolean;
  setProfile: (profile: UserProfile) => void;
  completeOnboarding: () => void;
  updatePreferences: (prefs: Partial<BuyerPreferences>) => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      profile: null,
      onboardingComplete: false,
      setProfile: (profile) => set({ profile }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      updatePreferences: (prefs) => {
        const { profile } = get();
        if (!profile) return;
        set({
          profile: {
            ...profile,
            preferences: { ...profile.preferences, ...prefs } as BuyerPreferences,
          },
        });
      },
    }),
    { name: "helio-user-store" }
  )
);

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId: string;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  setLoading: (loading: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  messages: [],
  isLoading: false,
  sessionId: `session_${Date.now()}`,
  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  clearMessages: () => set({ messages: [] }),
}));

interface UIStore {
  sidebarOpen: boolean;
  mapMode: "standard" | "satellite";
  activeTab: "map" | "list" | "compare" | "assistant" | "reports" | "saved";
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setMapMode: (mode: "standard" | "satellite") => void;
  setActiveTab: (tab: UIStore["activeTab"]) => void;
}

export const useUIStore = create<UIStore>()((set) => ({
  sidebarOpen: true,
  mapMode: "standard",
  activeTab: "map",
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setMapMode: (mode) => set({ mapMode: mode }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
