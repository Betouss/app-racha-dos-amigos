import type { Confronto } from './tabela'

/** Resultado de um jogo já disputado: índices dos times e quem venceu (null = empate). */
export interface JogoDisputado {
  a: number
  b: number
  vencedor: number | null
}

/**
 * "Quem ganha fica": o vencedor continua em quadra e enfrenta o próximo da fila;
 * o perdedor vai para o fim da fila. No empate sai quem está há mais tempo em
 * quadra (no primeiro jogo, em que os dois entraram juntos, sai o time A).
 * O estado é sempre recalculado a partir dos jogos, nunca armazenado.
 */
export function vencedorFica(qtdTimes: number, jogos: readonly JogoDisputado[]): { proximo: Confronto; fila: number[] } {
  const desde = new Map<number, number>([
    [0, 0],
    [1, 0],
  ])
  const fila = Array.from({ length: Math.max(0, qtdTimes - 2) }, (_, i) => i + 2)
  let proximo: Confronto = [0, 1]
  jogos.forEach((j, i) => {
    let sai: number
    if (j.vencedor === j.a) sai = j.b
    else if (j.vencedor === j.b) sai = j.a
    else sai = (desde.get(j.b) ?? 0) < (desde.get(j.a) ?? 0) ? j.b : j.a
    const fica = sai === j.a ? j.b : j.a
    fila.push(sai)
    const entra = fila.shift()!
    desde.delete(sai)
    desde.set(entra, i + 1)
    proximo = [fica, entra]
  })
  return { proximo, fila }
}
