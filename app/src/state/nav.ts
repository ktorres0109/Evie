/**
 * Navigation: four tabs, a stack of pushed screens above them, and the log
 * sheet. Kept in one tiny store so the hardware back button and the tab bar
 * agree on what is on top.
 */
import { create } from 'zustand'

export type OwnerTab = 'today' | 'calendar' | 'insights' | 'you'
export type PartnerTab = 'p-today' | 'p-support' | 'p-shared' | 'p-you'
export type AnyTab = OwnerTab | PartnerTab

export type Route =
  | { name: 'why' }
  | { name: 'fertility' }
  | { name: 'fertility-setup' }
  | { name: 'method' }
  | { name: 'life' }
  | { name: 'pregnancy' }
  | { name: 'privacy' }
  | { name: 'partner' }
  | { name: 'partner-pair' }
  | { name: 'companion' }
  | { name: 'history' }
  | { name: 'appearance' }
  | { name: 'notifications' }
  | { name: 'lock' }
  | { name: 'about' }
  | { name: 'articles' }
  | { name: 'article'; slug: string }
  | { name: 'doctor-report' }

export type QuickKind = 'flow' | 'mood' | 'pain' | 'discharge'

interface NavState {
  tab: AnyTab
  stack: Route[]
  /** The day the full log sheet is open for. */
  logDate: string | null
  /** A one-category half sheet opened from the quick-log row. */
  quick: { kind: QuickKind; date: string } | null
  setTab: (tab: AnyTab) => void
  push: (route: Route) => void
  pop: () => void
  openLog: (date: string) => void
  closeLog: () => void
  openQuick: (kind: QuickKind, date: string) => void
  closeQuick: () => void
}

export const useNav = create<NavState>((set) => ({
  tab: 'today',
  stack: [],
  logDate: null,
  quick: null,
  setTab: (tab) => set({ tab, stack: [] }),
  push: (route) => set((s) => ({ stack: [...s.stack, route] })),
  pop: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  openLog: (logDate) => set({ logDate, quick: null }),
  closeLog: () => set({ logDate: null }),
  openQuick: (kind, date) => set({ quick: { kind, date } }),
  closeQuick: () => set({ quick: null }),
}))
