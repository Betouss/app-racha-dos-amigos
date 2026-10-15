import { useState } from 'react'

type Tema = 'light' | 'dark'
const CHAVE = 'racha:tema'

function salvo(): Tema | null {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

function efetivo(): Tema {
  return salvo() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function aplicarTemaSalvo() {
  const t = salvo()
  if (t) document.documentElement.dataset.theme = t
}

export function useTema() {
  const [tema, setTema] = useState<Tema>(efetivo)
  const alternar = () => {
    const novo: Tema = tema === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = novo
    try {
      localStorage.setItem(CHAVE, novo)
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
    setTema(novo)
  }
  return { tema, alternar }
}
