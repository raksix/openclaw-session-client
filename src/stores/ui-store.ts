import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  logPanelOpen: boolean;
  activeTab: "chat" | "iframe";
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleLogPanel: () => void;
  setLogPanelOpen: (open: boolean) => void;
  setActiveTab: (tab: "chat" | "iframe") => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  logPanelOpen: false,
  activeTab: "chat",
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleLogPanel: () => set((state) => ({ logPanelOpen: !state.logPanelOpen })),
  setLogPanelOpen: (open) => set({ logPanelOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
