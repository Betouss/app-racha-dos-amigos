import { describe, expect, it } from 'vitest'
import { seeded } from './random'
import { somaEstrelas, sortearTimes, type JogadorSorteio } from './sorteio'
import { gerarTabela } from './tabela'
import { vencedorFica } from './vencedorFica'
import { artilharia, classificacao, goleiroQueSofreu, placar, statsPorJogador } from './stats'
import type { Gol, Jogador, Partida, Racha, Time, TimeJogador } from './types'

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

describe('goleiros e escalação', () => {
  const p: Partida = { id: 'p1', rachaId: 'r1', timeAId: 'A', timeBId: 'B', ordem: 1, status: 'encerrada' }
  const tj = (timeId: string, jogadorId: string, goleiro = false): TimeJogador => ({ timeId, jogadorId, travado: false, goleiro })
  const timeJogadores = [tj('A', 'gkA', true), tj('A', 'a1'), tj('B', 'gkB', true), tj('B', 'b1')]
  const gol = (g: Partial<Gol>): Gol => ({ id: 'g', partidaId: 'p1', jogadorId: 'a1', timeId: 'A', contra: false, criadoEm: 0, ...g })

  it('gol sofrido conta para o goleiro gravado ou, em gols antigos, para o goleiro atual', () => {
    expect(goleiroQueSofreu(gol({ goleiroId: 'b1' }), p, timeJogadores)).toBe('b1')
    expect(goleiroQueSofreu(gol({}), p, timeJogadores)).toBe('gkB')
    // gol contra do time A: quem sofre é o goleiro do próprio A
    expect(goleiroQueSofreu(gol({ contra: true }), p, timeJogadores)).toBe('gkA')
  })

  it('estatísticas usam a escalação gravada na partida, não o elenco atual', () => {
    const racha = { id: 'r1', data: '2026-01-01T10:00', status: 'encerrado' } as Racha
    const base = {
      rachas: [racha],
      times: [] as Time[],
      timeJogadores,
      partidas: [{ ...p, escalacao: { A: ['gkA', 'b1'], B: ['gkB'] } }],
      gols: [gol({ goleiroId: 'gkB' }), gol({ id: 'g2', goleiroId: 'gkB' })],
      presencas: [],
    }
    const s = statsPorJogador(base)
    expect(s.get('gkB')?.golsSofridos).toBe(2)
    expect(s.get('b1')).toMatchObject({ partidas: 1, v: 1 })
    expect(s.get('a1')?.partidas).toBe(0)
  })
})

describe('quem ganha fica', () => {
  it('vencedor fica, perdedor vai para o fim da fila', () => {
    // 4 times: 0×1, 1 vence → 1×2, 2 vence → 2×3
    const r = vencedorFica(4, [
      { a: 0, b: 1, vencedor: 1 },
      { a: 1, b: 2, vencedor: 2 },
    ])
    expect(r.proximo).toEqual([2, 3])
    expect(r.fila).toEqual([0, 1])
  })

  it('no empate sai quem está há mais tempo em quadra', () => {
    // 0×1 empata: sai 0 (time A do primeiro jogo); 1×2 empata: sai 1, que está desde o início
    const r = vencedorFica(3, [
      { a: 0, b: 1, vencedor: null },
      { a: 1, b: 2, vencedor: null },
    ])
    expect(r.proximo).toEqual([2, 0])
    expect(r.fila).toEqual([1])
  })

  it('com 2 times é sempre o mesmo confronto', () => {
    expect(vencedorFica(2, [{ a: 0, b: 1, vencedor: 0 }]).proximo).toEqual([0, 1])
  })
})

describe('gols históricos de peladas anteriores', () => {
  it('soma gols históricos de jogadores nas estatísticas', () => {
    const jogadores: Jogador[] = [
      { id: 'j1', apelido: 'Leomar', nome: 'Leomar', estrelas: 4, goleiro: false, ativo: true, golsHistoricos: 5 },
      { id: 'j2', apelido: 'Lucídio', nome: 'Lucídio', estrelas: 4, goleiro: false, ativo: true, golsHistoricos: 4, assistenciasHistoricas: 1 },
      { id: 'j3', apelido: 'Goleiro', nome: 'Goleiro', estrelas: 3, goleiro: true, ativo: true },
    ]
    const base = {
      rachas: [],
      times: [],
      timeJogadores: [],
      partidas: [],
      gols: [],
      presencas: [],
      jogadores,
    }
    const s = statsPorJogador(base)
    expect(s.get('j1')?.gols).toBe(5)
    expect(s.get('j2')?.gols).toBe(4)
    expect(s.get('j2')?.assistencias).toBe(1)
    expect(s.get('j3')?.gols).toBe(0)
  })
})

describe('goleiros rotativos e flexibilidade de partidas', () => {
  it('sorteio com 3 times e 2 goleiros em modo rotativo equilibra a linha sem forçar jogador de linha no gol', () => {
    const jogadores = [
      gk(101),
      gk(102),
      ...Array.from({ length: 12 }, (_, i) => linha(i + 1, (i % 5) + 1)),
    ]
    const r = sortearTimes({
      jogadores,
      qtdTimes: 3,
      jogadoresLinha: 4,
      goleirosRotativos: true,
      rng: seeded(42),
    })

    expect(r.reservas).toEqual([])
    // 2 times com goleiro fixo + 4 jogadores de linha = 5 jogadores
    // 1 time sem goleiro fixo com 4 jogadores de linha = 4 jogadores, pronto para revezamento
    const timesComGk = r.times.filter((t) => t.goleiroId !== null)
    const timesSemGk = r.times.filter((t) => t.goleiroId === null)
    expect(timesComGk).toHaveLength(2)
    expect(timesSemGk).toHaveLength(1)
    for (const t of timesComGk) expect(t.jogadores).toHaveLength(5)
    for (const t of timesSemGk) expect(t.jogadores).toHaveLength(4)
  })

  it('goleiro rotativo que defende outro time na partida computa gol sofrido e partida jogada', () => {
    const p: Partida = {
      id: 'p1',
      rachaId: 'r1',
      timeAId: 'timeA',
      timeBId: 'timeB',
      ordem: 1,
      status: 'encerrada',
      goleiros: {
        timeB: 'gkRotativo', // goleiro atuando pelo Time B
      },
      escalacao: {
        timeA: ['jA1', 'gkA'],
        timeB: ['jB1', 'gkRotativo'],
      },
    }
    const golSofrido: Gol = {
      id: 'g1',
      partidaId: 'p1',
      jogadorId: 'jA1',
      timeId: 'timeA',
      contra: false,
      goleiroId: 'gkRotativo',
      criadoEm: 1000,
    }
    const base = {
      rachas: [{ id: 'r1', status: 'encerrado' as const, data: '2026-10-22', local: 'Arena', jogadoresLinha: 5, qtdTimes: 2, duracaoRachaMin: 60, duracaoPartidaMin: 10, idaVolta: false }],
      times: [
        { id: 'timeA', rachaId: 'r1', nome: 'Branco', cor: 'branco', ordem: 0 },
        { id: 'timeB', rachaId: 'r1', nome: 'Preto', cor: 'preto', ordem: 1 },
      ],
      timeJogadores: [
        { timeId: 'timeA', jogadorId: 'jA1', travado: false, goleiro: false },
        { timeId: 'timeA', jogadorId: 'gkA', travado: false, goleiro: true },
        { timeId: 'timeB', jogadorId: 'jB1', travado: false, goleiro: false },
      ],
      partidas: [p],
      gols: [golSofrido],
      presencas: [
        { rachaId: 'r1', jogadorId: 'jA1', reserva: false },
        { rachaId: 'r1', jogadorId: 'gkA', reserva: false },
        { rachaId: 'r1', jogadorId: 'jB1', reserva: false },
        { rachaId: 'r1', jogadorId: 'gkRotativo', reserva: false },
      ],
    }

    const s = statsPorJogador(base)
    expect(s.get('gkRotativo')?.golsSofridos).toBe(1)
    expect(s.get('gkRotativo')?.partidas).toBe(1)
    expect(s.get('gkRotativo')?.d).toBe(1) // Time B perdeu de 1x0
    expect(s.get('gkA')?.golsSofridos).toBe(0)
    expect(s.get('gkA')?.v).toBe(1)
  })
})
