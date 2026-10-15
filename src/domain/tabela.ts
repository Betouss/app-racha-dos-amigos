export type Confronto = [number, number] // índices dos times

const compartilha = (a: Confronto, b?: Confronto) => !!b && (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1])

/** Rodadas de todos contra todos pelo método do círculo. */
function circulo(qtdTimes: number): Confronto[] {
  const lista: number[] = Array.from({ length: qtdTimes }, (_, i) => i)
  if (qtdTimes % 2 === 1) lista.push(-1) // folga
  const n = lista.length
  const jogos: Confronto[] = []
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i]
      const b = lista[n - 1 - i]
      if (a === -1 || b === -1) continue
      jogos.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    // gira todos menos o primeiro
    lista.splice(1, 0, lista.pop()!)
  }
  return jogos
}

/**
 * Reordena para evitar que um time jogue duas vezes seguidas, sempre que
 * possível; entre as opções, prefere quem está há mais tempo parado.
 */
function ordenar(jogos: Confronto[], anterior?: Confronto, ultimoJogo = new Map<number, number>()): Confronto[] {
  const restantes = [...jogos]
  const saida: Confronto[] = []
  let ultimo = anterior
  let passo = 0
  const descanso = (j: Confronto) => Math.min(passo - (ultimoJogo.get(j[0]) ?? -99), passo - (ultimoJogo.get(j[1]) ?? -99))
  while (restantes.length > 0) {
    let melhor = -1
    for (let i = 0; i < restantes.length; i++) {
      if (compartilha(restantes[i], ultimo)) continue
      if (melhor === -1 || descanso(restantes[i]) > descanso(restantes[melhor])) melhor = i
    }
    if (melhor === -1) melhor = 0
    const [jogo] = restantes.splice(melhor, 1)
    saida.push(jogo)
    ultimoJogo.set(jogo[0], passo)
    ultimoJogo.set(jogo[1], passo)
    ultimo = jogo
    passo++
  }
  return saida
}

/** n times geram n(n−1)/2 partidas; ida e volta dobra. */
export function gerarTabela(qtdTimes: number, idaVolta: boolean, anteriores: Confronto[] = []): Confronto[] {
  if (qtdTimes < 2) return []
  const ida = circulo(qtdTimes)
  const jogos = idaVolta ? [...ida, ...ida.map(([a, b]) => [b, a] as Confronto)] : ida
  const ultimoJogo = new Map<number, number>()
  anteriores.forEach((j, i) => {
    ultimoJogo.set(j[0], i - anteriores.length)
    ultimoJogo.set(j[1], i - anteriores.length)
  })
  return ordenar(jogos, anteriores.at(-1), ultimoJogo)
}
