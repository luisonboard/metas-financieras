import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../state/useAuthStore'

const inputClass =
  'w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50'

export default function AccountSection() {
  const isSupabaseConfigured = useAuthStore((s) => s.isSupabaseConfigured)
  const user = useAuthStore((s) => s.user)
  const isSyncing = useAuthStore((s) => s.isSyncing)
  const error = useAuthStore((s) => s.error)
  const pendingEmailConfirmation = useAuthStore((s) => s.pendingEmailConfirmation)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const signOut = useAuthStore((s) => s.signOut)
  const clearError = useAuthStore((s) => s.clearError)

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isSupabaseConfigured) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    if (mode === 'signIn') {
      await signIn(email, password)
    } else {
      await signUp(email, password)
    }
    setSubmitting(false)
  }

  if (user) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-neutral-900">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Conectado como</p>
        <p className="font-medium text-neutral-900 dark:text-neutral-50">{user.email}</p>
        {isSyncing && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Sincronizando…</p>}
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-4 w-full rounded-xl border border-neutral-300 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm dark:bg-neutral-900">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('signIn')
            clearError()
          }}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            mode === 'signIn'
              ? 'bg-emerald-500 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signUp')
            clearError()
          }}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
            mode === 'signUp'
              ? 'bg-emerald-500 text-white'
              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
          }`}
        >
          Crear cuenta
        </button>
      </div>

      {pendingEmailConfirmation ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Revisa tu correo <span className="font-medium">{email}</span> y confirma tu cuenta para iniciar sesión.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-emerald-500 py-2.5 font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {mode === 'signIn' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>
      )}

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Sin conectarte, la app funciona igual de completa en este dispositivo.
      </p>
    </div>
  )
}
