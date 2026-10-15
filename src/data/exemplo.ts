import { sortearTimes } from '../domain/sorteio'
import { gerarTabela } from '../domain/tabela'
import { pick, seeded } from '../domain/random'
import type { Gol, Jogador } from '../domain/types'
import { nomeTime } from './cores'
import { Lote, novoId, ref, semId } from './firebase'
import { isoLocal } from '../ui/datas'

const ELENCO: [string, string, number, boolean][] = [
  ['Paredão', 'Carlos Mendes', 4, true],
  ['Muralha', 'Eduardo Lima', 3, true],
  ['Gatão', 'Sérgio Nunes', 4, true],
  ['Mãozinha', 'Léo Prado', 2, true],
  ['Dentinho', 'Rafael Souza', 5, false],
  ['Biro', 'Fábio Ribeiro', 5, false],
  ['Pelezinho', 'Marcos Antunes', 5, false],
  ['Alemão', 'Rodrigo Klein', 4, false],
  ['Russo', 'Igor Petrov', 4, false],
  ['Juninho', 'José Júnior', 4, false],
  ['Pezão', 'André Costa', 4, false],
  ['Magrão', 'Paulo Henrique', 3, false],
  ['Gaúcho', 'Tiago Becker', 3, false],
  ['Canela', 'Gustavo Reis', 3, false],
  ['Zé Grande', 'José Almeida', 3, false],
  ['Cabeça', 'Mateus Barros', 3, false],
  ['Toninho', 'Antônio Dias', 3, false],
  ['Formiga', 'Lucas Pinto', 2, false],
  ['Bolinha', 'Diego Alves', 2, false],
  ['Baixinho', 'Caio Martins', 2, false],
  ['Neguinho', 'Wellington Silva', 3, false],
  ['Careca', 'Roberto Faria', 2, false],
  ['Tico', 'Vinícius Rocha', 1, false],
]

/** Sábados anteriores (e o próximo) a partir de hoje, às 8h. */
function sabado(deslocamentoSemanas: number): string {
  const d = new Date()
  d.setHours(8, 0, 0, 0)
  const ate = (6 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + ate + deslocamentoSemanas * 7)
  return isoLocal(d)
}

export function carregarExemplo(gid: string) {
  const rng = seeded(2026)
  const l = new Lote()
  const jogadores = ELENCO.map(([apelido, nome, estrelas, goleiro]) => {
    const j: Jogador = { id: novoId(), apelido, nome, estrelas, goleiro, ativo: true }
    l.set(ref(gid, 'jogadores', j.id), semId(j))
    return j
  })

  // Três rachas encerrados nos sábados anteriores
  for (const semanas of [-4, -3, -2]) {
    const rachaId = novoId()
    l.set(ref(gid, 'rachas', rachaId), {
      data: sabado(semanas),
      local: 'Arena do Bairro',
      jogadoresLinha: 4,
      qtdTimes: 4,
      duracaoRachaMin: 90,
      duracaoPartidaMin: 12,
      idaVolta: false,
      status: 'encerrado',
    })
    const presentes = jogadores.filter(() => rng() > 0.12)
    const r = sortearTimes({ jogadores: presentes, qtdTimes: 4, jogadoresLinha: 4, rng })
    for (const j of presentes) l.set(ref(gid, 'presencas', `${rachaId}_${j.id}`), { rachaId, jogadorId: j.id, reserva: r.reservas.includes(j.id) })
    const timeIds = r.times.map((t, i) => {
      const id = novoId()
      l.set(ref(gid, 'times', id), { rachaId, nome: nomeTime(i).nome, cor: nomeTime(i).cor, ordem: i })
      for (const jogadorId of t.jogadores) l.set(ref(gid, 'timeJogadores', `${id}_${jogadorId}`), { timeId: id, jogadorId, travado: false, goleiro: jogadorId === t.goleiroId })
      return id
    })
    for (const [ordem, [a, b]] of gerarTabela(4, false).entries()) {
      const partidaId = novoId()
      l.set(ref(gid, 'partidas', partidaId), { rachaId, timeAId: timeIds[a], timeBId: timeIds[b], ordem: ordem + 1, status: 'encerrada' })
      const gols: Omit<Gol, 'id'>[] = []
      for (const t of [a, b]) {
        const linha = r.times[t].jogadores.filter((id) => id !== r.times[t].goleiroId)
        const qtd = Math.floor(rng() * rng() * 5)
        for (let k = 0; k < qtd; k++) {
          const pesos = linha.flatMap((id) => Array(jogadores.find((j) => j.id === id)!.estrelas ** 2).fill(id) as string[])
          const autor = pick(pesos, rng)
          const contra = rng() < 0.05
          const outros = linha.filter((id) => id !== autor)
          gols.push({
            partidaId,
            jogadorId: contra ? pick(r.times[t === a ? b : a].jogadores, rng) : autor,
            timeId: contra ? timeIds[t === a ? b : a] : timeIds[t],
            contra,
            minuto: 1 + Math.floor(rng() * 11),
            assistenciaId: !contra && rng() < 0.5 && outros.length ? pick(outros, rng) : undefined,
            criadoEm: Date.now() + gols.length,
          })
        }
      }
      for (const g of gols.sort((x, y) => (x.minuto ?? 0) - (y.minuto ?? 0))) l.set(ref(gid, 'gols', novoId()), g)
    }
  }

  // Próximo racha com a lista fechada
  const proximo = novoId()
  l.set(ref(gid, 'rachas', proximo), {
    data: sabado(0),
    local: 'Arena do Bairro',
    jogadoresLinha: 4,
    qtdTimes: 4,
    duracaoRachaMin: 90,
    duracaoPartidaMin: 12,
    idaVolta: false,
    status: 'aberto',
  })
  const confirmados = [...jogadores.filter((j) => j.goleiro), ...jogadores.filter((j) => !j.goleiro).slice(0, 16)]
  for (const j of confirmados) l.set(ref(gid, 'presencas', `${proximo}_${j.id}`), { rachaId: proximo, jogadorId: j.id, reserva: false })
  l.enviar()
}
