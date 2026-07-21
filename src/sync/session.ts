let currentUserId: string | null = null

/** Actualizado por useAuthStore; permite a los repos (fuera de React) leer el usuario actual. */
export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId
}

export function getCurrentUserId(): string | null {
  return currentUserId
}
