import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin, useBase } from '../data/store'
import type { Id } from '../domain/types'
import { placar, statsPorJogador } from '../domain/stats'
import { Avatar, Dock, Stars, TeamName, Vazio, Voltar } from '../ui/components'
import { diaCurto } from '../ui/datas'
import { Icon } from '../ui/Icon'
import { anoAtual, filtroPeriodo, PeriodoFiltro } from '../ui/Periodo'

export default function Perfil({ jogadorId }: { jogadorId: Id }) {
  const base = useBase()
  const admin = useAdmin()
  const nav = useNavigate()
  const [periodo, setPeriodo] = useState(anoAtual)
  if (!base) return null
  const jogador = base.jogadores.find((j) => j.id === jogadorId)
  if (!jogador) return <main className="page">Jogador não encontrado.</main>

  const filtro = filtroPeriodo(periodo)
  const s = statsPorJogador(base, filtro).get(jogadorId)
  const rachaPorId = new Map(base.rachas.map((r) => [r.id!, r]))
  const timePorId = new Map(base.times.map((t) => [t.id!, t]))
  const partidaPorId = new Map(base.partidas.map((p) => [p.id!, p]))

  // Rachas encerrados em que jogou, mais recente primeiro
  const porRacha = base.timeJogadores
    .filter((tj) => tj.jogadorId === jogadorId)
    .map((tj) => {
      const time = timePorId.get(tj.timeId)!
      return { time, racha: rachaPorId.get(time?.rachaId) }
    })
    .filter((x) => x.racha && x.racha.status === 'encerrado' && filtro(x.racha))
    .sort((a, b) => b.racha!.data.localeCompare(a.racha!.data))
    .map(({ time, racha }) => {
      const meus = base.gols.filter((g) => partidaPorId.get(g.partidaId)?.rachaId === racha!.id)
      return {
        racha: racha!,
        time,
        gols: meus.filter((g) => g.jogadorId === jogadorId && !g.contra),
        assistencias: meus.filter((g) => g.assistenciaId === jogadorId).length,
      }
    })

  return (
    <>
      <main className="page">
        <Voltar to="/jogadores" label="Jogadores" />
        <div className="pitch perfil">
          <Avatar jogador={jogador} size={92} />
          <div style={{ minWidth: 0 }}>
            <h1>{jogador.apelido}</h1>
            <div className="perfil__sub">
              {[jogador.nome, jogador.goleiro ? 'Goleiro' : 'Linha', !jogador.ativo && 'Inativo'].filter(Boolean).join(' · ')}
            </div>
            <Stars value={jogador.estrelas} size={22} />
          </div>
        </div>

        <PeriodoFiltro rachas={base.rachas} value={periodo} onChange={setPeriodo} />

        <div className="grid-2">
          <div className="stat stat--accent">
            <Icon name="bola" />
            <span className="stat__valor">{s?.gols ?? 0}</span>
            <span className="stat__label">Gols</span>
          </div>
          <div className="stat">
            <Icon name="assist" />
            <span className="stat__valor">{s?.assistencias ?? 0}</span>
            <span className="stat__label">Assistências</span>
          </div>
          <div className="stat">
            <Icon name="check" />
            <span className="stat__valor">{s?.rachas ?? 0}</span>
            <span className="stat__label">Presenças</span>
          </div>
          <div className="stat">
            <Icon name="podio" />
            <span className="stat__valor">{s?.partidas ? `${Math.round(s.aproveitamento * 100)}%` : '–'}</span>
            <span className="stat__label">Aproveitamento</span>
          </div>
        </div>

        <section className="secao">
          <h2>Últimos jogos</h2>
          {s && s.ultimos.length > 0 ? (
            <>
              <div className="forma" aria-label="Resultados das últimas partidas, mais recente à esquerda">
                {s.ultimos.slice(0, 10).map((u) => (
                  <span key={u.partidaId} className={u.resultado}>
                    {u.resultado}
                  </span>
                ))}
              </div>
              <p className="hint">
                Mais recente à esquerda · {s.partidas} partidas ({s.v}V {s.e}E {s.d}D) · {s.titulos} título{s.titulos === 1 ? '' : 's'}
                {periodo === 'tudo' ? '' : ' na temporada'}
              </p>
            </>
          ) : (
            <p className="hint">Ainda sem partidas neste período.</p>
          )}
        </section>

        <section className="secao">
          <h2>Gols por racha</h2>
          {porRacha.length === 0 ? (
            <Vazio titulo="Nenhum racha neste período" />
          ) : (
            <ul className="lista lista--junta">
              {porRacha.map(({ racha, time, gols, assistencias }) => (
                <li key={racha.id}>
                  <button className="item" onClick={() => nav(`/racha/${racha.id}/classificacao`)}>
                    <div className="item__main">
                      <div className="item__titulo">{diaCurto(racha.data)}</div>
                      <div className="item__sub">
                        {assistencias} assistência{assistencias === 1 ? '' : 's'}
                        {gols.length > 0 &&
                          ` · ${gols
                            .map((g) => {
                              const p = partidaPorId.get(g.partidaId)!
                              const adv = timePorId.get(p.timeAId === time.id ? p.timeBId : p.timeAId)
                              const pl = placar(p, base.gols)
                              return `vs ${adv?.nome} (${pl.a}×${pl.b})`
                            })
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .join(', ')}`}
                      </div>
                    </div>
                    <TeamName time={time} />
                    <span className="item__num" style={{ minWidth: 28, textAlign: 'right' }}>
                      {gols.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <Dock>
        {admin && (
          <button className="btn" onClick={() => nav(`/jogadores/${jogadorId}/editar`)}>
            <Icon name="editar" /> Editar jogador
          </button>
        )}
      </Dock>
    </>
  )
}
