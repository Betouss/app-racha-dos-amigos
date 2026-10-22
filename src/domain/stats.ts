import { hashTexto, seeded } from './random'
import type { Gol, Id, Jogador, Partida, Racha, Time, TimeJogador } from './types'

export interface Placar {
  a: number
  b: number
}

/** Time beneficiado pelo gol: gol contra soma para o adversário. */
export function timeDoGol(gol: Gol, partida: Partida): Id {
  if (!gol.contra) return gol.timeId
  return gol.timeId === partida.timeAId ? partida.timeBId : partida.timeAId
}

/** Time que sofreu o gol (o adversário do beneficiado). */
export function timeQueSofreu(gol: Gol, partida: Partida): Id {
  return timeDoGol(gol, partida) === partida.timeAId ? partida.timeBId : partida.timeAId
}

/**
 * Goleiro que sofreu o gol: o gravado no gol ou, em gols antigos, o goleiro
 * atual do time que sofreu.
 */
export function goleiroQueSofreu(gol: Gol, partida: Partida, timeJogadores: readonly TimeJogador[]): Id | undefined {
  if (gol.goleiroId) return gol.goleiroId
  const timeId = timeQueSofreu(gol, partida)
  return partida.goleiros?.[timeId] ?? timeJogadores.find((tj) => tj.timeId === timeId && tj.goleiro)?.jogadorId
}

/** Placar nunca é digitado: é a contagem dos gols da partida. */
export function placar(partida: Partida, gols: readonly Gol[]): Placar {
  const p = { a: 0, b: 0 }
  for (const g of gols) {
    if (g.partidaId !== partida.id) continue
    if (timeDoGol(g, partida) === partida.timeAId) p.a++
    else p.b++
  }
  return p
}

export type Resultado = 'V' | 'E' | 'D'

export function resultadoDoTime(timeId: Id, partida: Partida, p: Placar): Resultado {
  const [meus, deles] = timeId === partida.timeAId ? [p.a, p.b] : [p.b, p.a]
  return meus > deles ? 'V' : meus < deles ? 'D' : 'E'
}

export const PONTOS: Record<Resultado, number> = { V: 3, E: 1, D: 0 }

export interface LinhaClassificacao {
  timeId: Id
  j: number
  v: number
  e: number
  d: number
  gp: number
  gc: number
  sg: number
  pts: number
}

/**
 * Classificação do racha. Desempate: pontos, vitórias, saldo, gols pró,
 * confronto direto e, por fim, sorteio (determinístico por racha).
 */
export function classificacao(
  rachaId: Id,
  times: readonly Time[],
  partidas: readonly Partida[],
  gols: readonly Gol[],
): LinhaClassificacao[] {
  const encerradas = partidas.filter((p) => p.rachaId === rachaId && p.status === 'encerrada')
  const linhas = new Map<Id, LinhaClassificacao>()
  for (const t of times) {
    if (t.rachaId !== rachaId) continue
    linhas.set(t.id!, { timeId: t.id!, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0, pts: 0 })
  }
  const placares = new Map(encerradas.map((p) => [p.id!, placar(p, gols)]))
  for (const p of encerradas) {
    const pl = placares.get(p.id!)!
    for (const [timeId, pro, contra] of [
      [p.timeAId, pl.a, pl.b],
      [p.timeBId, pl.b, pl.a],
    ] as const) {
      const l = linhas.get(timeId)
      if (!l) continue
      const r = resultadoDoTime(timeId, p, pl)
      l.j++
      l.gp += pro
      l.gc += contra
      l.sg = l.gp - l.gc
      l.pts += PONTOS[r]
      if (r === 'V') l.v++
      else if (r === 'E') l.e++
      else l.d++
    }
  }

  const chave = (l: LinhaClassificacao) => [l.pts, l.v, l.sg, l.gp]
  const compara = (x: LinhaClassificacao, y: LinhaClassificacao) => {
    const a = chave(x)
    const b = chave(y)
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]
    return 0
  }
  const ordenadas = [...linhas.values()].sort(compara)

  // Grupos empatados: confronto direto (pontos entre eles) e depois sorteio
  const rng = seeded(hashTexto(rachaId))
  const sorte = new Map(ordenadas.map((l) => [l.timeId, rng()]))
  const saida: LinhaClassificacao[] = []
  for (let i = 0; i < ordenadas.length; ) {
    let f = i + 1
    while (f < ordenadas.length && compara(ordenadas[i], ordenadas[f]) === 0) f++
    const grupo = ordenadas.slice(i, f)
    if (grupo.length > 1) {
      const ids = new Set(grupo.map((l) => l.timeId))
      const direto = new Map(grupo.map((l) => [l.timeId, 0]))
      for (const p of encerradas) {
        if (!ids.has(p.timeAId) || !ids.has(p.timeBId)) continue
        const pl = placares.get(p.id!)!
        direto.set(p.timeAId, direto.get(p.timeAId)! + PONTOS[resultadoDoTime(p.timeAId, p, pl)])
        direto.set(p.timeBId, direto.get(p.timeBId)! + PONTOS[resultadoDoTime(p.timeBId, p, pl)])
      }
      grupo.sort((x, y) => direto.get(y.timeId)! - direto.get(x.timeId)! || sorte.get(x.timeId)! - sorte.get(y.timeId)!)
    }
    saida.push(...grupo)
    i = f
  }
  return saida
}

export interface Artilheiro {
  jogadorId: Id
  gols: number
  assistencias: number
}

/** Gol contra não entra na artilharia. */
export function artilharia(gols: readonly Gol[]): Artilheiro[] {
  const m = new Map<Id, Artilheiro>()
  const get = (id: Id) => {
    let a = m.get(id)
    if (!a) m.set(id, (a = { jogadorId: id, gols: 0, assistencias: 0 }))
    return a
  }
  for (const g of gols) {
    if (g.contra) continue
    get(g.jogadorId).gols++
    if (g.assistenciaId) get(g.assistenciaId).assistencias++
  }
  return [...m.values()].filter((a) => a.gols > 0).sort((a, b) => b.gols - a.gols || b.assistencias - a.assistencias)
}

/** Dados de todo o grupo, usados nas estatísticas por jogador e nos rankings. */
export interface Base {
  rachas: Racha[]
  times: Time[]
  timeJogadores: TimeJogador[]
  partidas: Partida[]
  gols: Gol[]
  presencas: { rachaId: Id; jogadorId: Id }[]
  jogadores?: Jogador[]
}

export interface StatsJogador {
  jogadorId: Id
  gols: number
  assistencias: number
  golsSofridos: number // como goleiro
  partidas: number
  rachas: number // presenças em rachas encerrados
  v: number
  e: number
  d: number
  aproveitamento: number // 0–1
  titulos: number
  ultimos: { resultado: Resultado; partidaId: Id }[] // mais recente primeiro
}

export function campeaoDoRacha(rachaId: Id, base: Pick<Base, 'times' | 'partidas' | 'gols'>): Id | null {
  const tabela = classificacao(rachaId, base.times, base.partidas, base.gols)
  if (tabela.length === 0 || tabela[0].j === 0) return null
  return tabela[0].timeId
}

/** Estatísticas sempre calculadas, nunca armazenadas. */
export function statsPorJogador(base: Base, filtroRacha: (r: Racha) => boolean = () => true): Map<Id, StatsJogador> {
  const rachas = base.rachas.filter(filtroRacha)
  const rachaIds = new Set(rachas.map((r) => r.id!))
  const encerrados = new Set(rachas.filter((r) => r.status === 'encerrado').map((r) => r.id!))
  const dataDoRacha = new Map(rachas.map((r) => [r.id!, r.data]))
  const timeRacha = new Map(base.times.map((t) => [t.id!, t.rachaId]))
  const elencos = new Map<Id, Id[]>()
  for (const tj of base.timeJogadores) {
    const lista = elencos.get(tj.timeId) ?? []
    lista.push(tj.jogadorId)
    elencos.set(tj.timeId, lista)
  }

  const stats = new Map<Id, StatsJogador>()
  const get = (id: Id) => {
    let s = stats.get(id)
    if (!s) {
      s = { jogadorId: id, gols: 0, assistencias: 0, golsSofridos: 0, partidas: 0, rachas: 0, v: 0, e: 0, d: 0, aproveitamento: 0, titulos: 0, ultimos: [] }
      stats.set(id, s)
    }
    return s
  }

  for (const p of base.presencas) if (encerrados.has(p.rachaId)) get(p.jogadorId).rachas++

  const partidas = base.partidas
    .filter((p) => rachaIds.has(p.rachaId) && p.status === 'encerrada')
    .sort((a, b) => (dataDoRacha.get(b.rachaId)! < dataDoRacha.get(a.rachaId)! ? -1 : dataDoRacha.get(b.rachaId)! > dataDoRacha.get(a.rachaId)! ? 1 : b.ordem - a.ordem))
  const partidaIds = new Set(partidas.map((p) => p.id!))
  const golsValidos = base.gols.filter((g) => partidaIds.has(g.partidaId))
  for (const a of artilharia(golsValidos)) {
    const s = get(a.jogadorId)
    s.gols = a.gols
    s.assistencias = a.assistencias
  }

  // Gols e assistências históricas de peladas anteriores
  if (base.jogadores) {
    for (const j of base.jogadores) {
      const s = get(j.id)
      const golsAnteriores = j.gols ?? j.golsHistoricos ?? 0
      if (golsAnteriores) s.gols += golsAnteriores
      if (j.assistenciasHistoricas) s.assistencias += j.assistenciasHistoricas
    }
  }

  const golsPorPartida = new Map<Id, Gol[]>()
  for (const g of golsValidos) {
    const l = golsPorPartida.get(g.partidaId) ?? []
    l.push(g)
    golsPorPartida.set(g.partidaId, l)
  }
  for (const p of partidas) {
    const golsDaPartida = golsPorPartida.get(p.id!) ?? []
    const pl = placar(p, golsDaPartida)
    for (const g of golsDaPartida) {
      const gk = goleiroQueSofreu(g, p, base.timeJogadores)
      if (gk) get(gk).golsSofridos++
    }
    for (const timeId of [p.timeAId, p.timeBId]) {
      const r = resultadoDoTime(timeId, p, pl)
      // Escalação gravada ao encerrar; partidas antigas usam o elenco atual do time
      const escalados = new Set(p.escalacao?.[timeId] ?? elencos.get(timeId) ?? [])
      if (p.goleiros?.[timeId]) escalados.add(p.goleiros[timeId])
      for (const extraId of p.jogadoresExtras?.[timeId] ?? []) escalados.add(extraId)
      for (const jid of escalados) {
        const s = get(jid)
        s.partidas++
        if (r === 'V') s.v++
        else if (r === 'E') s.e++
        else s.d++
        s.ultimos.push({ resultado: r, partidaId: p.id! })
      }
    }
  }

  for (const rid of encerrados) {
    const campeao = campeaoDoRacha(rid, base)
    if (campeao === null || timeRacha.get(campeao) !== rid) continue
    for (const jid of elencos.get(campeao) ?? []) get(jid).titulos++
  }

  for (const s of stats.values()) s.aproveitamento = s.partidas ? (s.v * 3 + s.e) / (s.partidas * 3) : 0
  return stats
}
