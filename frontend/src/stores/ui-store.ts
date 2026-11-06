import { create } from 'zustand'
import { persist } from 'zustand/middleware'
export type Theme = 'dark' | 'light' | 'system'
interface UIState {
  theme: Theme
  collapsed: boolean
  commandOpen: boolean
  taskCreateOpen: boolean
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setCommandOpen: (open: boolean) => void
  setTaskCreateOpen: (open: boolean) => void
}
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      collapsed: false,
      commandOpen: false,
      taskCreateOpen: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setTaskCreateOpen: (taskCreateOpen) => set({ taskCreateOpen }),
    }),
    { name: 'flowwork-ui', partialize: ({ theme, collapsed }) => ({ theme, collapsed }) },
  ),
)
