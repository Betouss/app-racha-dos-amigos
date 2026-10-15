import { useEffect, useState } from 'react'

export { useAdmin, useBase, useCtx, useRacha } from './store'

export function useAgora(intervaloMs = 1000) {
  const [agora, setAgora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}

/** Mantém a tela acesa durante o jogo ao vivo. */
export function useTelaAcesa() {
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    const pedir = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    pedir()
    const aoVoltar = () => document.visibilityState === 'visible' && pedir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      lock?.release().catch(() => {})
    }
  }, [])
}
