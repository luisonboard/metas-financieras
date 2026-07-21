import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

export default function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      setRegistration(reg ?? null)
    },
  })

  useEffect(() => {
    if (!registration) return
    const checkForUpdate = () => {
      registration.update().catch(() => {})
    }
    const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
    window.addEventListener('focus', checkForUpdate)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', checkForUpdate)
    }
  }, [registration])

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-neutral-900 px-4 py-3 text-white shadow-xl dark:bg-neutral-800">
      <p className="text-sm font-medium">Nueva versión disponible</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg px-3 py-1.5 text-sm text-neutral-300 hover:text-white"
        >
          Después
        </button>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}
