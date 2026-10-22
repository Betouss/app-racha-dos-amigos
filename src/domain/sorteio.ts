import { pick, shuffle, type Rng } from './random'
import type { Id } from './types'

export interface JogadorSorteio {
  id: Id
  estrelas: number
  goleiro: boolean // goleiro fixo cadastrado
}

export interface EntradaSorteio {
  jogadores: JogadorSorteio[] // presentes no racha
  qtdTimes: number
  jogadoresLinha: number
  /** jogadorId → índice do time em que está travado */
  travados?: ReadonlyMap<Id, number>
  rng?: Rng
  goleirosRotativos?: boolean
}

export interface TimeSorteado {
  jogadores: Id[] // inclui o goleiro
  goleiroId: Id | null
}

export interface ResultadoSorteio {
  times: TimeSorteado[]
  reservas: Id[]
}

/**
 * Soma de estrelas do time. Goleiro fixo não entra na soma; jogador de linha
 * escalado no gol continua contando, pois foi sorteado como jogador de linha.
 */
export function somaEstrelas(
  time: TimeSorteado,
  porId: ReadonlyMap<Id, Pick<JogadorSorteio, 'estrelas' | 'goleiro'>>,
): number {
  let soma = 0
  for (const id of time.jogadores) {
    const j = porId.get(id)
    if (!j) continue
    if (id === time.goleiroId && j.goleiro) continue
    soma += j.estrelas
  }
  return soma
}

/**
 * Sorteio por potes:
 * 1. goleiros fixos distribuídos um por time; time sem goleiro fixo recebe um
 *    jogador de linha a mais, que vai para o gol;
 * 2. travados entram primeiro no seu time e contam na soma;
 * 3. quem passa da capacidade vira reserva (sorteado entre os não travados);
 * 4. linha ordenada por estrelas, dividida em potes do tamanho do nº de times,
 *    cada pote embaralhado e distribuído ao time de menor soma (empate: sorteio).
 */
export function sortearTimes(entrada: EntradaSorteio): ResultadoSorteio {
  const { qtdTimes, jogadoresLinha } = entrada
  const rng = entrada.rng ?? Math.random
  const travados = entrada.travados ?? new Map<Id, number>()
  const porId = new Map(entrada.jogadores.map((j) => [j.id, j]))

  const times: TimeSorteado[] = Array.from({ length: qtdTimes }, () => ({ jogadores: [], goleiroId: null }))
  const soma = Array(qtdTimes).fill(0) as number[]
  const linha = Array(qtdTimes).fill(0) as number[] // jogadores de linha (sem o goleiro)

  // Travados primeiro
  for (const j of entrada.jogadores) {
    const t = travados.get(j.id)
    if (t === undefined || t < 0 || t >= qtdTimes) continue
    times[t].jogadores.push(j.id)
    if (j.goleiro && times[t].goleiroId === null) {
      times[t].goleiroId = j.id
    } else {
      linha[t]++
      soma[t] += j.estrelas
    }
  }

  const livres = entrada.jogadores.filter((j) => !travados.has(j.id))

  // Goleiros fixos: um por time sem goleiro, em ordem aleatória. Os que sobram jogam na linha.
  const goleirosLivres = shuffle(livres.filter((j) => j.goleiro), rng)
  const pool = livres.filter((j) => !j.goleiro)
  const semGoleiro = shuffle(times.map((_, i) => i).filter((i) => times[i].goleiroId === null), rng)
  for (const t of semGoleiro) {
    const g = goleirosLivres.shift()
    if (!g) break
    times[t].jogadores.push(g.id)
    times[t].goleiroId = g.id
  }
  pool.push(...goleirosLivres)

  // Capacidade de linha: n, ou n + 1 quando o time não tem goleiro fixo (se não for goleiro rotativo)
  const rotativo = !!entrada.goleirosRotativos
  const vagas = times.map((t, i) => Math.max(0, jogadoresLinha + (!rotativo && t.goleiroId === null ? 1 : 0) - linha[i]))
  const totalVagas = vagas.reduce((a, b) => a + b, 0)

  const embaralhado = shuffle(pool, rng)
  const qtdReservas = Math.max(0, embaralhado.length - totalVagas)
  const reservas = embaralhado.slice(0, qtdReservas).map((j) => j.id)
  const titulares = embaralhado.slice(qtdReservas).sort((a, b) => b.estrelas - a.estrelas)

  for (let p = 0; p < titulares.length; p += qtdTimes) {
    const pote = shuffle(titulares.slice(p, p + qtdTimes), rng)
    const receberam = new Set<number>()
    for (const j of pote) {
      const comVaga = times.map((_, i) => i).filter((i) => vagas[i] > 0)
      if (comVaga.length === 0) {
        reservas.push(j.id)
        continue
      }
      const preferidos = comVaga.filter((i) => !receberam.has(i))
      const candidatos = preferidos.length > 0 ? preferidos : comVaga
      const menor = Math.min(...candidatos.map((i) => soma[i]))
      const t = pick(candidatos.filter((i) => soma[i] === menor), rng)
      times[t].jogadores.push(j.id)
      soma[t] += j.estrelas
      linha[t]++
      vagas[t]--
      receberam.add(t)
    }
  }

  // Time sem goleiro fixo: sorteia um jogador de linha não travado para o gol (apenas se não for rotativo)
  if (!rotativo) {
    for (const t of times) {
      if (t.goleiroId !== null || t.jogadores.length === 0) continue
      const opcoes = t.jogadores.filter((id) => !travados.has(id))
      t.goleiroId = pick(opcoes.length > 0 ? opcoes : t.jogadores, rng)
    }
  }

  // Goleiro primeiro, depois por estrelas
  for (const t of times) {
    t.jogadores.sort((a, b) => {
      if (a === t.goleiroId) return -1
      if (b === t.goleiroId) return 1
      return (porId.get(b)?.estrelas ?? 0) - (porId.get(a)?.estrelas ?? 0)
    })
  }

  return { times, reservas }
}
