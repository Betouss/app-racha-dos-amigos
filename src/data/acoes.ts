import { deleteField } from 'firebase/firestore'
import { sortearTimes } from '../domain/sorteio'
import { placar } from '../domain/stats'
import { gerarTabela, type Confronto } from '../domain/tabela'
import { vencedorFica } from '../domain/vencedorFica'
import type { Gol, Id, Jogador, Partida, Racha } from '../domain/types'
import { nomeTime } from './cores'
import { Lote, novoId, ref, semId } from './firebase'
import type { Ctx } from './store'

// Todas as ações calculam a mudança a partir do estado atual (ctx.base) e gravam
// num lote sem esperar o servidor, para funcionar igual com ou sem sinal.

const presencaId = (rachaId: Id, jogadorId: Id) => `${rachaId}_${jogadorId}`
const timeJogadorId = (timeId: Id, jogadorId: Id) => `${timeId}_${jogadorId}`

export function salvarJogador({ gid }: Ctx, j: Omit<Jogador, 'id'> & { id?: Id }): Id {
  const id = j.id ?? novoId()
  const l = new Lote()
  l.set(ref(gid, 'jogadores', id), semId(j))
  l.enviar()
  return id
}

export type DadosRacha = Omit<Racha, 'id' | 'status'>

function limparSorteio(l: Lote, { gid, base }: Ctx, rachaId: Id) {
  const times = base.times.filter((t) => t.rachaId === rachaId)
  const ids = new Set(times.map((t) => t.id))
  for (const tj of base.timeJogadores) if (ids.has(tj.timeId)) l.delete(ref(gid, 'timeJogadores', timeJogadorId(tj.timeId, tj.jogadorId)))
  for (const t of times) l.delete(ref(gid, 'times', t.id))
}

function apagarPartidas(l: Lote, { gid, base }: Ctx, rachaId: Id) {
  const partidas = base.partidas.filter((p) => p.rachaId === rachaId)
  const ids = new Set(partidas.map((p) => p.id))
  for (const g of base.gols) if (ids.has(g.partidaId)) l.delete(ref(gid, 'gols', g.id))
  for (const p of partidas) l.delete(ref(gid, 'partidas', p.id))
}

/** Cria o racha (ou edita um ainda não iniciado) com a lista de presença. */
export function salvarRacha(ctx: Ctx, dados: DadosRacha, presentes: Id[], rachaId?: Id): Id {
  const { gid, base } = ctx
  const l = new Lote()
  const id = rachaId ?? novoId()
  let reservas = new Set<Id>()
  if (rachaId) {
    const atual = base.rachas.find((r) => r.id === rachaId)
    const anteriores = base.presencas.filter((p) => p.rachaId === rachaId)
    const mudouFormato = !atual || atual.qtdTimes !== dados.qtdTimes || atual.jogadoresLinha !== dados.jogadoresLinha
    const mudouLista = anteriores.map((p) => p.jogadorId).sort().join() !== [...presentes].sort().join()
    if (mudouFormato || mudouLista) limparSorteio(l, ctx, rachaId)
    else reservas = new Set(anteriores.filter((p) => p.reserva).map((p) => p.jogadorId))
    apagarPartidas(l, ctx, rachaId)
    const ficam = new Set(presentes)
    for (const p of anteriores) if (!ficam.has(p.jogadorId)) l.delete(ref(gid, 'presencas', presencaId(rachaId, p.jogadorId)))
  }
  l.set(ref(gid, 'rachas', id), { ...dados, status: 'aberto' })
  for (const jogadorId of presentes) l.set(ref(gid, 'presencas', presencaId(id, jogadorId)), { rachaId: id, jogadorId, reserva: reservas.has(jogadorId) })
  l.enviar()
  return id
}

export function excluirRacha(ctx: Ctx, rachaId: Id) {
  const { gid, base } = ctx
  const l = new Lote()
  apagarPartidas(l, ctx, rachaId)
  limparSorteio(l, ctx, rachaId)
  for (const p of base.presencas) if (p.rachaId === rachaId) l.delete(ref(gid, 'presencas', presencaId(rachaId, p.jogadorId)))
  l.delete(ref(gid, 'rachas', rachaId))
  l.enviar()
}

/** Sorteia (ou sorteia de novo) mantendo os jogadores travados. Devolve a marca do sorteio. */
export function sortear(ctx: Ctx, rachaId: Id): number | undefined {
  const { gid, base } = ctx
  const racha = base.rachas.find((r) => r.id === rachaId)
  if (!racha) return
  const presencas = base.presencas.filter((p) => p.rachaId === rachaId)
  const porId = new Map(base.jogadores.map((j) => [j.id, j]))
  const jogadores = presencas.map((p) => porId.get(p.jogadorId)).filter((j) => !!j)
  if (jogadores.length === 0) return

  const l = new Lote()
  const sorteioEm = Date.now()
  l.update(ref(gid, 'rachas', rachaId), { sorteioEm })

  let times = base.times.filter((t) => t.rachaId === rachaId)
  let atuais = base.timeJogadores.filter((tj) => times.some((t) => t.id === tj.timeId))
  if (times.length !== racha.qtdTimes) {
    limparSorteio(l, ctx, rachaId)
    times = Array.from({ length: racha.qtdTimes }, (_, i) => ({ id: novoId(), rachaId, nome: nomeTime(i).nome, cor: nomeTime(i).cor, ordem: i }))
    for (const t of times) l.set(ref(gid, 'times', t.id), semId(t))
    atuais = []
  }
  const indice = new Map(times.map((t, i) => [t.id, i]))
  const travados = new Map(atuais.filter((tj) => tj.travado).map((tj) => [tj.jogadorId, indice.get(tj.timeId)!]))

  const r = sortearTimes({
    jogadores: jogadores.map((j) => ({ id: j.id, estrelas: j.estrelas, goleiro: j.goleiro })),
    qtdTimes: racha.qtdTimes,
    jogadoresLinha: racha.jogadoresLinha,
    travados,
    goleirosRotativos:
      racha.goleirosRotativos ??
      (racha.formato === 'vencedor_fica' &&
        jogadores.filter((j) => j.goleiro).length < racha.qtdTimes &&
        jogadores.filter((j) => j.goleiro).length > 0),
  })

  const novos = new Set<string>()
  r.times.forEach((t, i) => {
    const timeRef = times[i]
    if (!timeRef) return
    const tid = timeRef.id
    for (const jogadorId of t.jogadores) {
      novos.add(timeJogadorId(tid, jogadorId))
      l.set(ref(gid, 'timeJogadores', timeJogadorId(tid, jogadorId)), { timeId: tid, jogadorId, travado: travados.has(jogadorId), goleiro: jogadorId === t.goleiroId })
    }
  })
  for (const tj of atuais) {
    const id = timeJogadorId(tj.timeId, tj.jogadorId)
    if (!novos.has(id)) l.delete(ref(gid, 'timeJogadores', id))
  }
  const reservas = new Set(r.reservas)
  for (const p of presencas) {
    if (p.reserva !== reservas.has(p.jogadorId)) l.update(ref(gid, 'presencas', presencaId(rachaId, p.jogadorId)), { reserva: reservas.has(p.jogadorId) })
  }
  l.enviar()
  return sorteioEm
}

export function alternarTravado({ gid, base }: Ctx, timeId: Id, jogadorId: Id) {
  const tj = base.timeJogadores.find((x) => x.timeId === timeId && x.jogadorId === jogadorId)
  if (!tj) return
  const l = new Lote()
  l.update(ref(gid, 'timeJogadores', timeJogadorId(timeId, jogadorId)), { travado: !tj.travado })
  l.enviar()
}

export function definirGoleiro({ gid, base }: Ctx, timeId: Id, jogadorId: Id) {
  const l = new Lote()
  for (const tj of base.timeJogadores) {
    if (tj.timeId !== timeId) continue
    const goleiro = tj.jogadorId === jogadorId
    if (tj.goleiro !== goleiro) l.update(ref(gid, 'timeJogadores', timeJogadorId(timeId, tj.jogadorId)), { goleiro })
  }
  l.enviar()
}

/** Define o goleiro de um time especificamente para uma partida (suporta goleiro de outro time/rotativo). */
export function definirGoleiroPartida({ gid, base }: Ctx, partidaId: Id, timeId: Id, jogadorId: Id) {
  const p = base.partidas.find((x) => x.id === partidaId)
  if (!p) return
  const l = new Lote()
  const goleiros = { ...(p.goleiros ?? {}), [timeId]: jogadorId }
  l.update(ref(gid, 'partidas', partidaId), { goleiros })

  // Se o jogador faz parte do time no geral, também o marca como goleiro do time
  for (const tj of base.timeJogadores) {
    if (tj.timeId !== timeId) continue
    const goleiro = tj.jogadorId === jogadorId
    if (tj.goleiro !== goleiro) l.update(ref(gid, 'timeJogadores', timeJogadorId(timeId, tj.jogadorId)), { goleiro })
  }
  l.enviar()
}

/** Posição de um jogador no sorteio: em um time ou entre os reservas (timeId null). */
export interface Posicao {
  jogadorId: Id
  timeId: Id | null
}

/** Troca manual entre times (ou com um reserva) após o sorteio. */
export function trocar({ gid, base }: Ctx, rachaId: Id, a: Posicao, b: Posicao) {
  if (a.timeId === b.timeId) return
  const acha = (p: Posicao) => (p.timeId ? base.timeJogadores.find((x) => x.timeId === p.timeId && x.jogadorId === p.jogadorId) : undefined)
  const tjA = acha(a)
  const tjB = acha(b)
  const l = new Lote()
  if (tjA) l.delete(ref(gid, 'timeJogadores', timeJogadorId(tjA.timeId, tjA.jogadorId)))
  if (tjB) l.delete(ref(gid, 'timeJogadores', timeJogadorId(tjB.timeId, tjB.jogadorId)))
  if (b.timeId) l.set(ref(gid, 'timeJogadores', timeJogadorId(b.timeId, a.jogadorId)), { timeId: b.timeId, jogadorId: a.jogadorId, travado: false, goleiro: tjB?.goleiro ?? false })
  if (a.timeId) l.set(ref(gid, 'timeJogadores', timeJogadorId(a.timeId, b.jogadorId)), { timeId: a.timeId, jogadorId: b.jogadorId, travado: false, goleiro: tjA?.goleiro ?? false })
  l.update(ref(gid, 'presencas', presencaId(rachaId, a.jogadorId)), { reserva: b.timeId === null })
  l.update(ref(gid, 'presencas', presencaId(rachaId, b.jogadorId)), { reserva: a.timeId === null })
  l.enviar()
}

/** Move um reserva para um time (sem trocar com ninguém). */
export function moverParaTime({ gid }: Ctx, rachaId: Id, jogadorId: Id, timeId: Id) {
  const l = new Lote()
  l.set(ref(gid, 'timeJogadores', timeJogadorId(timeId, jogadorId)), { timeId, jogadorId, travado: false, goleiro: false })
  l.update(ref(gid, 'presencas', presencaId(rachaId, jogadorId)), { reserva: false })
  l.enviar()
}

/** Move um jogador diretamente de um time para outro (ou para reserva) sem exigir troca 1-a-1. */
export function moverJogadorDeTime(
  { gid, base }: Ctx,
  rachaId: Id,
  jogadorId: Id,
  origemTimeId: Id | null,
  destinoTimeId: Id | null,
) {
  if (origemTimeId === destinoTimeId) return
  const l = new Lote()
  if (origemTimeId) {
    l.delete(ref(gid, 'timeJogadores', timeJogadorId(origemTimeId, jogadorId)))
  }
  if (destinoTimeId) {
    const tjExistente = base.timeJogadores.find((tj) => tj.timeId === origemTimeId && tj.jogadorId === jogadorId)
    l.set(ref(gid, 'timeJogadores', timeJogadorId(destinoTimeId, jogadorId)), {
      timeId: destinoTimeId,
      jogadorId,
      travado: false,
      goleiro: tjExistente?.goleiro ?? false,
    })
  }
  l.update(ref(gid, 'presencas', presencaId(rachaId, jogadorId)), {
    reserva: destinoTimeId === null,
  })
  l.enviar()
}

/** Adiciona um jogador emprestado a um time em uma partida específica. */
export function adicionarJogadorNaPartida({ gid, base }: Ctx, partidaId: Id, timeId: Id, jogadorId: Id) {
  const p = base.partidas.find((x) => x.id === partidaId)
  if (!p) return
  const l = new Lote()
  const extras = p.jogadoresExtras ?? {}
  const lista = new Set(extras[timeId] ?? [])
  lista.add(jogadorId)
  l.update(ref(gid, 'partidas', partidaId), {
    jogadoresExtras: { ...extras, [timeId]: [...lista] },
  })
  l.enviar()
}

/** Remove um jogador emprestado de um time em uma partida específica. */
export function removerJogadorDaPartida({ gid, base }: Ctx, partidaId: Id, timeId: Id, jogadorId: Id) {
  const p = base.partidas.find((x) => x.id === partidaId)
  if (!p) return
  const l = new Lote()
  const extras = p.jogadoresExtras ?? {}
  const lista = (extras[timeId] ?? []).filter((id) => id !== jogadorId)
  l.update(ref(gid, 'partidas', partidaId), {
    jogadoresExtras: { ...extras, [timeId]: lista },
  })
  l.enviar()
}

function confrontosDoRacha({ base }: Ctx, rachaId: Id) {
  const times = base.times.filter((t) => t.rachaId === rachaId)
  const partidas = base.partidas.filter((p) => p.rachaId === rachaId)
  const indice = new Map(times.map((t, i) => [t.id, i]))
  const anteriores: Confronto[] = partidas.map((p) => [indice.get(p.timeAId)!, indice.get(p.timeBId)!])
  return { times, partidas, anteriores }
}

function criarPartidas(
  l: Lote,
  gid: Id,
  rachaId: Id,
  times: { id: Id }[],
  jogos: Confronto[],
  base: number,
  goleirosIniciais?: Record<Id, Id>,
) {
  jogos.forEach(([a, b], i) => {
    const p: Omit<Partida, 'id'> = {
      rachaId,
      timeAId: times[a].id,
      timeBId: times[b].id,
      ordem: base + i + 1,
      status: 'agendada',
      ...(goleirosIniciais ? { goleiros: goleirosIniciais } : {}),
    }
    l.set(ref(gid, 'partidas', novoId()), p)
  })
}

export function confirmarTimes(ctx: Ctx, rachaId: Id) {
  const racha = ctx.base.rachas.find((r) => r.id === rachaId)
  if (!racha) return
  const { times, partidas } = confrontosDoRacha(ctx, rachaId)
  const l = new Lote()
  if (partidas.length === 0) {
    const jogos = racha.formato === 'vencedor_fica' ? [vencedorFica(times.length, []).proximo] : gerarTabela(times.length, racha.idaVolta)
    criarPartidas(l, ctx.gid, rachaId, times, jogos, 0)
  }
  l.update(ref(ctx.gid, 'rachas', rachaId), { status: 'em_andamento' })
  l.enviar()
}

/** Volta para o sorteio enquanto nenhuma partida começou. */
export function reabrirSorteio(ctx: Ctx, rachaId: Id): boolean {
  const partidas = ctx.base.partidas.filter((p) => p.rachaId === rachaId)
  if (partidas.some((p) => p.status !== 'agendada')) return false
  const l = new Lote()
  for (const p of partidas) l.delete(ref(ctx.gid, 'partidas', p.id))
  l.update(ref(ctx.gid, 'rachas', rachaId), { status: 'aberto' })
  l.enviar()
  return true
}

export function adicionarRodada(ctx: Ctx, rachaId: Id) {
  const { times, partidas, anteriores } = confrontosDoRacha(ctx, rachaId)
  const l = new Lote()
  criarPartidas(l, ctx.gid, rachaId, times, gerarTabela(times.length, false, anteriores), partidas.at(-1)?.ordem ?? 0)
  l.enviar()
}

export function iniciarPartida({ gid, base }: Ctx, partidaId: Id, novosTimes?: { timeAId: Id; timeBId: Id }) {
  const p = base.partidas.find((x) => x.id === partidaId)
  if (!p || p.status !== 'agendada') return
  const l = new Lote()
  const dados: Partial<Partida> = { status: 'em_andamento', iniciadaEm: Date.now() }
  if (novosTimes && novosTimes.timeAId !== novosTimes.timeBId) {
    dados.timeAId = novosTimes.timeAId
    dados.timeBId = novosTimes.timeBId
  }
  l.update(ref(gid, 'partidas', partidaId), dados)
  l.enviar()
}

/** Altera os dois times de uma partida (seja agendada, em andamento ou encerrada). */
export function editarTimesPartida(ctx: Ctx, partidaId: Id, timeAId: Id, timeBId: Id) {
  const { gid, base } = ctx
  const p = base.partidas.find((x) => x.id === partidaId)
  if (!p || timeAId === timeBId) return
  const oldA = p.timeAId
  const oldB = p.timeBId
  if (oldA === timeAId && oldB === timeBId) return

  const l = new Lote()
  const pAtualizada: Partida = { ...p, timeAId, timeBId }
  const dados: Partial<Partida> = { timeAId, timeBId }

  if (p.status === 'encerrada') {
    dados.escalacao = escalacaoAtual(base, pAtualizada)
    const novosGoleiros: Record<Id, Id> = {}
    for (const tid of [timeAId, timeBId]) {
      const gk = p.goleiros?.[tid] ?? base.timeJogadores.find((tj) => tj.timeId === tid && tj.goleiro)?.jogadorId
      if (gk) novosGoleiros[tid] = gk
    }
    dados.goleiros = novosGoleiros
  }

  // Remapeia gols existentes caso pertençam aos times antigos
  for (const g of base.gols) {
    if (g.partidaId !== partidaId) continue
    if (g.timeId === oldA && oldA !== timeAId) {
      l.update(ref(gid, 'gols', g.id), { timeId: timeAId })
    } else if (g.timeId === oldB && oldB !== timeBId) {
      l.update(ref(gid, 'gols', g.id), { timeId: timeBId })
    }
  }

  l.update(ref(gid, 'partidas', partidaId), dados)
  l.enviar()
}

/** Elencos atuais dos dois times da partida, guardados ao encerrar. */
function escalacaoAtual(base: Ctx['base'], p: Partida): Record<Id, Id[]> {
  const elenco = (timeId: Id) => {
    const ids = new Set(base.timeJogadores.filter((tj) => tj.timeId === timeId).map((tj) => tj.jogadorId))
    if (p.goleiros?.[timeId]) ids.add(p.goleiros[timeId])
    for (const extraId of p.jogadoresExtras?.[timeId] ?? []) ids.add(extraId)
    return [...ids]
  }
  return { [p.timeAId]: elenco(p.timeAId), [p.timeBId]: elenco(p.timeBId) }
}

/** No "quem ganha fica" a próxima partida só existe depois que a anterior termina. */
function criarProximaVencedorFica(l: Lote, ctx: Ctx, rachaId: Id, encerradaId: Id) {
  const racha = ctx.base.rachas.find((r) => r.id === rachaId)
  if (racha?.formato !== 'vencedor_fica' || racha.status !== 'em_andamento') return
  const { times, partidas } = confrontosDoRacha(ctx, rachaId)
  if (partidas.some((p) => p.status === 'agendada')) return
  const indice = new Map(times.map((t, i) => [t.id, i]))
  const jogos = partidas
    .filter((p) => p.status === 'encerrada' || p.id === encerradaId)
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => {
      const pl = placar(p, ctx.base.gols)
      const a = indice.get(p.timeAId)!
      const b = indice.get(p.timeBId)!
      return { a, b, vencedor: pl.a > pl.b ? a : pl.b > pl.a ? b : null }
    })
  const proximo = vencedorFica(times.length, jogos).proximo

  // Sugere o goleiro do time que acabou de perder para o time que está entrando (se não tiver goleiro fixo)
  const recemEncerrada = partidas.find((p) => p.id === encerradaId)
  const goleirosIniciais: Record<Id, Id> = {}
  if (recemEncerrada) {
    const pl = placar(recemEncerrada, ctx.base.gols)
    const timePerdedorId = pl.a > pl.b ? recemEncerrada.timeBId : pl.b > pl.a ? recemEncerrada.timeAId : recemEncerrada.timeAId
    const goleiroSugerido =
      recemEncerrada.goleiros?.[timePerdedorId] ??
      ctx.base.timeJogadores.find((tj) => tj.timeId === timePerdedorId && tj.goleiro)?.jogadorId

    const timeEntrandoId = times[proximo[1]].id
    const timeEntrandoTemGk = ctx.base.timeJogadores.some((tj) => tj.timeId === timeEntrandoId && tj.goleiro)
    if (goleiroSugerido && !timeEntrandoTemGk) {
      goleirosIniciais[timeEntrandoId] = goleiroSugerido
    }
  }

  criarPartidas(
    l,
    ctx.gid,
    rachaId,
    times,
    [proximo],
    Math.max(0, ...partidas.map((p) => p.ordem)),
    Object.keys(goleirosIniciais).length > 0 ? goleirosIniciais : undefined,
  )
}

export function encerrarPartida(ctx: Ctx, partidaId: Id) {
  const { gid, base } = ctx
  const p = base.partidas.find((x) => x.id === partidaId)
  if (!p) return
  const l = new Lote()
  l.update(ref(gid, 'partidas', partidaId), { status: 'encerrada', encerradaEm: Date.now(), escalacao: escalacaoAtual(base, p) })
  criarProximaVencedorFica(l, ctx, p.rachaId, partidaId)
  l.enviar()
}

export function reabrirPartida({ gid, base }: Ctx, partidaId: Id) {
  const p = base.partidas.find((x) => x.id === partidaId)
  const racha = base.rachas.find((r) => r.id === p?.rachaId)
  const l = new Lote()
  l.update(ref(gid, 'partidas', partidaId), { status: 'em_andamento', encerradaEm: deleteField() })
  // Quem ganha fica: a próxima partida dependia deste resultado; é gerada de novo ao encerrar
  if (p && racha?.formato === 'vencedor_fica') {
    for (const x of base.partidas) if (x.rachaId === p.rachaId && x.status === 'agendada' && x.ordem > p.ordem) l.delete(ref(gid, 'partidas', x.id))
  }
  l.enviar()
}

export function registrarGol({ gid }: Ctx, gol: Omit<Gol, 'id' | 'criadoEm'>): Id {
  const id = novoId()
  const l = new Lote()
  l.set(ref(gid, 'gols', id), { ...gol, criadoEm: Date.now() })
  l.enviar()
  return id
}

export function atualizarGol({ gid }: Ctx, id: Id, mudancas: Partial<Omit<Gol, 'id'>>) {
  // campo undefined = remover (ex.: tirar a assistência)
  const dados = Object.fromEntries(Object.entries(mudancas).map(([k, v]) => [k, v === undefined ? deleteField() : v]))
  const l = new Lote()
  l.update(ref(gid, 'gols', id), dados)
  l.enviar()
}

export function desfazerGol({ gid }: Ctx, id: Id) {
  const l = new Lote()
  l.delete(ref(gid, 'gols', id))
  l.enviar()
}

/** Encerra o racha: fecha a partida em andamento e descarta as não jogadas. */
export function encerrarRacha({ gid, base }: Ctx, rachaId: Id) {
  const l = new Lote()
  for (const p of base.partidas) {
    if (p.rachaId !== rachaId) continue
    if (p.status === 'em_andamento') l.update(ref(gid, 'partidas', p.id), { status: 'encerrada', encerradaEm: Date.now(), escalacao: escalacaoAtual(base, p) })
    if (p.status === 'agendada') l.delete(ref(gid, 'partidas', p.id))
  }
  l.update(ref(gid, 'rachas', rachaId), { status: 'encerrado' })
  l.enviar()
}

/** Para onde levar o usuário ao abrir um racha. */
export function rotaDoRacha(racha: Racha, partidas: Partida[] = []): string {
  if (racha.status === 'encerrado') return `/racha/${racha.id}/classificacao`
  if (racha.status === 'aberto') return `/racha/${racha.id}/sorteio`
  const aoVivo = partidas.find((p) => p.rachaId === racha.id && p.status === 'em_andamento')
  return aoVivo ? `/racha/${racha.id}/partida/${aoVivo.id}` : `/racha/${racha.id}/jogos`
}
