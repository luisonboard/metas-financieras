import { create } from 'zustand'

const TOAST_DURATION_MS = 4000

interface ToastItem {
  id: string
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (message) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, message }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, TOAST_DURATION_MS)
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
