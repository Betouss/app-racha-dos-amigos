import type { Confronto } from './tabela'

/** Resultado de um jogo já disputado: índices dos times e quem venceu (null = empate). */
export interface JogoDisputado {
  a: number
  b: number
  vencedor: number | null
}

export interface OpcaoEmpate {
  tipo: 'dois_fora' | 'fica_a' | 'fica_b'
  times: Confronto
}

/**
 * Sugestões inteligentes de confronto após um empate:
 * - Se houver 2 ou mais times de fora (ex: 4 times): entrar os 2 de fora.
 * - Manter o time A ou manter o time B enfrentando o primeiro da fila.
 */
export function opcoesConfrontoEmpate(
  qtdTimes: number,
  fila: readonly number[],
  ultimoJogo: { a: number; b: number },
): OpcaoEmpate[] {
  const opcoes: OpcaoEmpate[] = []
  if (qtdTimes >= 4 && fila.length >= 2) {
    opcoes.push({
      tipo: 'dois_fora',
      times: [fila[0], fila[1]],
    })
  }
  if (fila.length >= 1) {
    opcoes.push({
      tipo: 'fica_a',
      times: [ultimoJogo.a, fila[0]],
    })
    opcoes.push({
      tipo: 'fica_b',
      times: [ultimoJogo.b, fila[0]],
    })
  }
  return opcoes
}

/**
 * "Quem ganha fica": o vencedor continua em quadra e enfrenta o próximo da fila;
 * o perdedor vai para o fim da fila. No empate sai quem está há mais tempo em
 * quadra (no primeiro jogo, em que os dois entraram juntos, sai o time A).
 * O estado é sempre recalculado a partir dos jogos, suportando inclusive
 * saídas duplas (quando os dois empatados saem) ou confrontos manuais.
 */
export function vencedorFica(qtdTimes: number, jogos: readonly JogoDisputado[]): { proximo: Confronto; fila: number[] } {
  if (qtdTimes <= 2) {
    return { proximo: [0, 1], fila: [] }
  }

  const desde = new Map<number, number>([
    [0, 0],
    [1, 0],
  ])
  let fila = Array.from({ length: Math.max(0, qtdTimes - 2) }, (_, i) => i + 2)
  let proximo: Confronto = [0, 1]

  jogos.forEach((j, i) => {
    const proximoReal = jogos[i + 1]

    if (proximoReal) {
      // Já sabemos quem jogou na partida seguinte:
      // Quem jogou em 'j' mas não está em 'proximoReal' saiu da quadra
      const sairam: number[] = []
      if (proximoReal.a !== j.a && proximoReal.b !== j.a) sairam.push(j.a)
      if (proximoReal.a !== j.b && proximoReal.b !== j.b) sairam.push(j.b)

      // Se ambos saíram, quem estava há mais tempo sai primeiro para a fila
      if (sairam.length === 2) {
        sairam.sort((x, y) => (desde.get(y) ?? 0) - (desde.get(x) ?? 0))
      }

      for (const sai of sairam) {
        desde.delete(sai)
        fila = fila.filter((t) => t !== sai)
        fila.push(sai)
      }

      // Quem entrou em proximoReal e não estava em j
      for (const entra of [proximoReal.a, proximoReal.b]) {
        if (entra !== j.a && entra !== j.b) {
          fila = fila.filter((t) => t !== entra)
          desde.set(entra, i + 1)
        }
      }

      proximo = [proximoReal.a, proximoReal.b]
    } else {
      // Último jogo disputado: calcula o padrão caso não haja escolha explícita posterior
      let sai: number
      if (j.vencedor === j.a) sai = j.b
      else if (j.vencedor === j.b) sai = j.a
      else sai = (desde.get(j.b) ?? 0) < (desde.get(j.a) ?? 0) ? j.b : j.a

      const fica = sai === j.a ? j.b : j.a
      fila = fila.filter((t) => t !== sai)
      fila.push(sai)
      const entra = fila.shift()!
      desde.delete(sai)
      desde.set(entra, i + 1)
      proximo = [fica, entra]
    }
  })

  return { proximo, fila }
}

