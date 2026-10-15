import { describe, expect, it } from 'vitest'
import { seeded } from './random'
import { somaEstrelas, sortearTimes, type JogadorSorteio } from './sorteio'
import { gerarTabela } from './tabela'
import { artilharia, classificacao, placar } from './stats'
import type { Gol, Partida, Time } from './types'

const linha = (id: number, estrelas: number): JogadorSorteio => ({ id: String(id), estrelas, goleiro: false })
const gk = (id: number): JogadorSorteio => ({ id: String(id), estrelas: 3, goleiro: true })

describe('sorteio por potes', () => {
  it('exemplo do documento: 4 times, 4 na linha, 5/4/3/2★ → 14★ cada', () => {
    const jogadores = [
      ...[1, 2, 3, 4].map((i) => linha(i, 5)),
      ...[5, 6, 7, 8].map((i) => linha(i, 4)),
      ...[9, 10, 11, 12].map((i) => linha(i, 3)),
      ...[13, 14, 15, 16].map((i) => linha(i, 2)),
      ...[17, 18, 19, 20].map(gk),
    ]
    for (let seed = 1; seed <= 50; seed++) {
      const r = sortearTimes({ jogadores, qtdTimes: 4, jogadoresLinha: 4, rng: seeded(seed) })
      const porId = new Map(jogadores.map((j) => [j.id, j]))
      expect(r.reservas).toEqual([])
      for (const t of r.times) {
        expect(t.jogadores).toHaveLength(5)
        expect(porId.get(t.goleiroId!)!.goleiro).toBe(true)
        expect(somaEstrelas(t, porId)).toBe(14)
      }
    }
  })

  it('time sem goleiro fixo recebe um jogador de linha a mais, que vai para o gol', () => {
    const jogadores = [gk(100), ...Array.from({ length: 11 }, (_, i) => linha(i + 1, (i % 5) + 1))]
    const r = sortearTimes({ jogadores, qtdTimes: 2, jogadoresLinha: 5, rng: seeded(3) })
    expect(r.reservas).toEqual([])
    for (const t of r.times) {
      expect(t.jogadores).toHaveLength(6)
      expect(t.goleiroId).not.toBeNull()
      expect(t.jogadores).toContain(t.goleiroId)
    }
  })

  it('sobra vira reserva', () => {
    const jogadores = [gk(90), gk(91), ...Array.from({ length: 13 }, (_, i) => linha(i + 1, 3))]
    const r = sortearTimes({ jogadores, qtdTimes: 2, jogadoresLinha: 5, rng: seeded(9) })
    expect(r.reservas).toHaveLength(3)
    expect(r.times.every((t) => t.jogadores.length === 6)).toBe(true)
  })

  it('travados ficam no time escolhido e nunca viram reserva', () => {
    const jogadores = Array.from({ length: 14 }, (_, i) => linha(i + 1, (i % 5) + 1))
    const travados = new Map([
      ['1', 1],
      ['2', 1],
      ['3', 0],
    ])
    for (let seed = 1; seed <= 30; seed++) {
      const r = sortearTimes({ jogadores, qtdTimes: 2, jogadoresLinha: 5, travados, rng: seeded(seed) })
      expect(r.times[1].jogadores).toContain('1')
      expect(r.times[1].jogadores).toContain('2')
      expect(r.times[0].jogadores).toContain('3')
      expect(r.reservas).not.toContain('1')
      expect(r.reservas).toHaveLength(2)
    }
  })

  it('cada jogador aparece exatamente uma vez', () => {
    const jogadores = [gk(50), ...Array.from({ length: 22 }, (_, i) => linha(i + 1, (i % 5) + 1))]
    const r = sortearTimes({ jogadores, qtdTimes: 3, jogadoresLinha: 6, rng: seeded(4) })
    const todos = [...r.times.flatMap((t) => t.jogadores), ...r.reservas].sort()
    expect(todos).toEqual(jogadores.map((j) => j.id).sort())
  })
})

describe('tabela de jogos', () => {
  const pares = (jogos: [number, number][]) => jogos.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('-'))

  it.each([
    [2, 1],
    [3, 3],
    [4, 6],
    [5, 10],
    [6, 15],
  ])('%i times geram %i partidas, cada par uma vez', (n, total) => {
    const jogos = gerarTabela(n, false)
    expect(jogos).toHaveLength(total)
    expect(new Set(pares(jogos)).size).toBe(total)
  })

  it('4 times: ninguém joga três seguidas (duas seguidas é inevitável)', () => {
    const jogos = gerarTabela(4, false)
    for (let i = 2; i < jogos.length; i++) {
      for (const t of jogos[i]) expect(jogos[i - 1].includes(t) && jogos[i - 2].includes(t)).toBe(false)
    }
  })

  it.each([5, 6, 7])('%i times: ninguém joga duas seguidas', (n) => {
    const jogos = gerarTabela(n, false)
    for (let i = 1; i < jogos.length; i++) {
      const [a, b] = jogos[i - 1]
      expect(jogos[i]).not.toContain(a)
      expect(jogos[i]).not.toContain(b)
    }
  })

  it('ida e volta dobra o número de partidas', () => {
    expect(gerarTabela(4, true)).toHaveLength(12)
  })
})

describe('placar e classificação', () => {
  const times: Time[] = [1, 2, 3].map((id) => ({ id: String(id), rachaId: 'r1', nome: `T${id}`, cor: '#000', ordem: id }))
  const partida = (id: number, a: number, b: number): Partida => ({ id: String(id), rachaId: 'r1', timeAId: String(a), timeBId: String(b), ordem: id, status: 'encerrada' })
  let gid = 1
  const gol = (partidaId: number, timeId: number, jogadorId: number, contra = false): Gol => ({
    id: String(gid++),
    partidaId: String(partidaId),
    timeId: String(timeId),
    jogadorId: String(jogadorId),
    contra,
    criadoEm: 0,
  })

  it('gol contra soma para o adversário e não entra na artilharia', () => {
    const p = partida(1, 1, 2)
    const gols = [gol(1, 1, 10), gol(1, 1, 11, true)]
    expect(placar(p, gols)).toEqual({ a: 1, b: 1 })
    expect(artilharia(gols).map((a) => a.jogadorId)).toEqual(['10'])
  })

  it('pontuação 3/1/0 e desempate por confronto direto', () => {
    const partidas = [partida(1, 1, 2), partida(2, 2, 3), partida(3, 3, 1)]
    // T1 vence T2 1×0, T2 vence T3 1×0, T3 vence T1 1×0 → tudo empatado, gira
    const gols = [gol(1, 1, 1), gol(2, 2, 2), gol(3, 3, 3)]
    const t = classificacao('r1', times, partidas, gols)
    expect(t.map((l) => l.pts)).toEqual([3, 3, 3])
    expect(new Set(t.map((l) => l.timeId)).size).toBe(3)
    // determinístico
    expect(classificacao('r1', times, partidas, gols).map((l) => l.timeId)).toEqual(t.map((l) => l.timeId))
  })

  it('ordena por pontos, vitórias, saldo e gols pró', () => {
    const partidas = [partida(1, 1, 2), partida(2, 1, 3), partida(3, 2, 3)]
    const gols = [gol(1, 1, 1), gol(1, 1, 1), gol(2, 3, 3), gol(3, 2, 2), gol(3, 2, 2), gol(3, 2, 2)]
    const t = classificacao('r1', times, partidas, gols)
    expect(t.map((l) => [l.timeId, l.pts])).toEqual([
      ['2', 3],
      ['1', 3],
      ['3', 3],
    ])
    expect(t[0]).toMatchObject({ j: 2, v: 1, d: 1, gp: 3, gc: 2, sg: 1 })
  })
})
