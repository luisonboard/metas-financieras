import confetti from 'canvas-confetti'

export function celebrate(): void {
  confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
}

export function celebrateBig(): void {
  confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, scalar: 1.1 })
  setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.6 } }), 200)
}
