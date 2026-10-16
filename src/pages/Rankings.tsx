import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBase } from '../data/hooks'
import { statsPorJogador, type StatsJogador } from '../domain/stats'
import { Avatar, Dock, Vazio } from '../ui/components'
import { anoAtual, filtroPeriodo, PeriodoFiltro } from '../ui/Periodo'

type Aba = 'artilharia' | 'presenca' | 'aproveitamento' | 'titulos'

const ABAS: { id: Aba; label: string; valor: (s: StatsJogador) => number; formato?: (v: number) => string; sub: (s: StatsJogador) => string }[] = [
  { id: 'artilharia', label: 'Artilharia', valor: (s) => s.gols, sub: (s) => `${s.assistencias} assist. · ${s.partidas} jogos` },
  { id: 'presenca', label: 'Presença', valor: (s) => s.rachas, sub: (s) => `${s.partidas} partidas` },
  {
    id: 'aproveitamento',
    label: 'Aproveitamento',
    valor: (s) => s.aproveitamento,
    formato: (v) => `${Math.round(v * 100)}%`,
    sub: (s) => `${s.v}V ${s.e}E ${s.d}D`,
  },
  { id: 'titulos', label: 'Títulos', valor: (s) => s.titulos, sub: (s) => `${s.rachas} peladas` },
]

/** Mínimo de partidas para entrar no ranking de aproveitamento. */
const MIN_PARTIDAS = 5

export default function Rankings() {
  const base = useBase()
  const [aba, setAba] = useState<Aba>('artilharia')
  const [periodo, setPeriodo] = useState(anoAtual)
  if (!base) return null

  const config = ABAS.find((a) => a.id === aba)!
  const rachasNoPeriodo = base.rachas.filter((r) => r.status === 'encerrado' && filtroPeriodo(periodo)(r)).length
  const jogadorPorId = new Map(base.jogadores.map((j) => [j.id!, j]))
  const todos = [...statsPorJogador(base, filtroPeriodo(periodo)).values()].filter((s) => jogadorPorId.has(s.jogadorId))
  // No começo da temporada ninguém tem 5 jogos: o mínimo acompanha quem mais jogou
  const maisJogou = Math.max(0, ...todos.map((s) => s.partidas))
  const minimo = Math.max(1, Math.min(MIN_PARTIDAS, maisJogou))
  const stats = todos
    .filter((s) => (aba === 'aproveitamento' ? s.partidas >= minimo : config.valor(s) > 0))
    .sort((a, b) => config.valor(b) - config.valor(a) || b.partidas - a.partidas)
  const fmt = (s: StatsJogador) => (config.formato ?? String)(config.valor(s))
  const [p1, p2, p3] = stats

  return (
    <>
      <main className="page page--sem-acao">
        <p className="eyebrow">
          {periodo === 'tudo' ? 'Desde o início' : `Temporada ${periodo}`} · {rachasNoPeriodo} pelada{rachasNoPeriodo === 1 ? '' : 's'}
        </p>
        <h1>Rankings</h1>
        <div className="abas" role="tablist">
          {ABAS.map((a) => (
            <button key={a.id} role="tab" aria-selected={a.id === aba} className={a.id === aba ? 'on' : ''} onClick={() => setAba(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        <PeriodoFiltro rachas={base.rachas} value={periodo} onChange={setPeriodo} />

        {stats.length === 0 ? (
          <Vazio titulo="Sem dados neste período">Os rankings aparecem depois do primeira pelada encerrada.</Vazio>
        ) : (
          <>
            <div className="podio">
              {[p2, p1, p3].map((s, i) => {
                const pos = [2, 1, 3][i]
                if (!s) return <div key={pos} />
                const j = jogadorPorId.get(s.jogadorId)!
                return (
                  <Link key={s.jogadorId} to={`/jogadores/${s.jogadorId}`}>
                    <div className="podio__pessoa">
                      <Avatar jogador={j} size={pos === 1 ? 56 : 44} destaque={pos === 1} />
                      <span className="podio__nome">{j.apelido}</span>
                      <span className="podio__valor">{fmt(s)}</span>
                    </div>
                    <div className={`podio__degrau podio__degrau--${pos}`}>{pos}º</div>
                  </Link>
                )
              })}
            </div>
            <ul className="lista">
              {stats.slice(3).map((s, i) => {
                const j = jogadorPorId.get(s.jogadorId)!
                return (
                  <li key={s.jogadorId}>
                    <Link className="item" to={`/jogadores/${s.jogadorId}`}>
                      <span className="partida__ordem" style={{ width: 30 }}>
                        {i + 4}º
                      </span>
                      <Avatar jogador={j} />
                      <div className="item__main">
                        <div className="item__titulo">{j.apelido}</div>
                        <div className="item__sub">{config.sub(s)}</div>
                      </div>
                      <span className="item__num">{fmt(s)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {aba === 'aproveitamento' && <p className="hint">Pontos ganhos ÷ pontos disputados, com mínimo de {minimo} partida{minimo === 1 ? '' : 's'}.</p>}
          </>
        )}
      </main>
      <Dock />
    </>
  )
}

