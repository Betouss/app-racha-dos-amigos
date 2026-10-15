import type { Id } from '../domain/types'
import { Link } from 'react-router-dom'
import { useRacha } from '../data/hooks'
import { artilharia, classificacao, placar } from '../domain/stats'
import { compartilharTexto, Dock, TeamDot, TeamName, Vazio } from '../ui/components'
import { diaCurto } from '../ui/datas'
import { Icon } from '../ui/Icon'

const sinal = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

export default function Classificacao({ rachaId }: { rachaId: Id }) {
  const dados = useRacha(rachaId)
  if (dados === undefined) return null
  if (dados === null) return <main className="page">Racha não encontrado.</main>
  const { racha, times, partidas, gols, timeJogadores, jogadores } = dados

  const tabela = classificacao(rachaId, times, partidas, gols)
  const timePorId = new Map(times.map((t) => [t.id!, t]))
  const encerradas = partidas.filter((p) => p.status === 'encerrada')
  const golsValidos = gols.filter((g) => encerradas.some((p) => p.id === g.partidaId))
  const artilheiros = artilharia(golsValidos)
  const timeDoJogador = new Map(timeJogadores.map((tj) => [tj.jogadorId, tj.timeId]))
  const lider = tabela[0]?.j ? tabela[0] : undefined
  const encerrado = racha.status === 'encerrado'

  const compartilhar = () => {
    const linhas = tabela.map((l, i) => `${i + 1}. ${timePorId.get(l.timeId)?.nome} — ${l.pts} pts (${l.v}V ${l.e}E ${l.d}D, SG ${sinal(l.sg)})`)
    const art = artilheiros.slice(0, 5).map((a) => `${jogadores.get(a.jogadorId)?.apelido} ${a.gols}`)
    const jogos = encerradas.map((p) => {
      const pl = placar(p, gols)
      return `${timePorId.get(p.timeAId)?.nome} ${pl.a} × ${pl.b} ${timePorId.get(p.timeBId)?.nome}`
    })
    compartilharTexto(
      [
        `⚽ Racha ${diaCurto(racha.data)} — ${racha.local}`,
        lider ? `🏆 ${encerrado ? 'Campeão' : 'Líder'}: *${timePorId.get(lider.timeId)?.nome}* (${lider.pts} pts)` : '',
        `\n*Classificação*\n${linhas.join('\n')}`,
        art.length ? `\n*Artilheiros*\n${art.join('\n')}` : '',
        jogos.length ? `\n*Jogos*\n${jogos.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return (
    <>
      <main className="page">
        <p className="eyebrow">
          {diaCurto(racha.data)} · {encerrado ? 'Encerrado' : 'Parcial'}
        </p>
        <h1>Classificação</h1>

        {lider && (
          <div className="pitch campeao" style={{ marginTop: 20 }}>
            <span className="campeao__trofeu">
              <Icon name="trofeu" size={40} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="pitch__eyebrow">{encerrado ? 'Campeão do dia' : 'Líder até agora'}</div>
              <div className="campeao__nome">
                <TeamDot cor={timePorId.get(lider.timeId)!.cor} size={26} /> {timePorId.get(lider.timeId)?.nome}
              </div>
              <div style={{ fontSize: 14 }}>
                {lider.v} V · {lider.e} E · {lider.d} D · {lider.pts} pts
              </div>
            </div>
          </div>
        )}

        <section className="secao">
          <h2>Tabela</h2>
          {encerradas.length === 0 ? (
            <Vazio titulo="Nenhuma partida encerrada">A tabela aparece depois da primeira partida.</Vazio>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="t">Time</th>
                  <th>J</th>
                  <th>V</th>
                  <th>E</th>
                  <th>D</th>
                  <th>GP</th>
                  <th>GC</th>
                  <th>SG</th>
                  <th className="pts">Pts</th>
                </tr>
              </thead>
              <tbody>
                {tabela.map((l, i) => (
                  <tr key={l.timeId} className={i === 0 ? 'lider' : ''}>
                    <td className="pos">{i === 0 ? <Icon name="trofeu" size={16} /> : i + 1}</td>
                    <td className="t">
                      <TeamName time={timePorId.get(l.timeId)} />
                    </td>
                    <td>{l.j}</td>
                    <td>{l.v}</td>
                    <td>{l.e}</td>
                    <td>{l.d}</td>
                    <td>{l.gp}</td>
                    <td>{l.gc}</td>
                    <td className={l.sg > 0 ? 'sg-pos' : l.sg < 0 ? 'sg-neg' : ''}>{sinal(l.sg)}</td>
                    <td className="pts">{l.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="hint">Vitória 3, empate 1. Desempate: pontos, vitórias, saldo, gols pró, confronto direto, sorteio.</p>
        </section>

        {artilheiros.length > 0 && (
          <section className="secao">
            <h2>Artilheiros do dia</h2>
            <ul className="lista lista--junta">
              {artilheiros.map((a, i) => (
                <li key={a.jogadorId}>
                  <Link className="item" to={`/jogadores/${a.jogadorId}`}>
                    <span className="partida__ordem" style={{ width: 22 }}>
                      {i + 1}
                    </span>
                    <div className="item__main">
                      <div className="item__titulo">{jogadores.get(a.jogadorId)?.apelido}</div>
                      <div className="item__sub">{a.assistencias ? `${a.assistencias} assist.` : ' '}</div>
                    </div>
                    <TeamName time={timePorId.get(timeDoJogador.get(a.jogadorId) ?? '')} />
                    <span className="item__num" style={{ minWidth: 28, textAlign: 'right' }}>
                      {a.gols}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {encerradas.length > 0 && (
          <section className="secao">
            <h2>Partidas</h2>
            <ul className="lista lista--junta">
              {encerradas.map((p) => {
                const pl = placar(p, gols)
                return (
                  <li key={p.id}>
                    <Link className="item" style={{ minHeight: 56 }} to={`/racha/${rachaId}/partida/${p.id}`}>
                      <span className="partida__ordem" style={{ width: 22 }}>
                        {p.ordem}
                      </span>
                      <span className="item__main" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <TeamName time={timePorId.get(p.timeAId)} />
                        <strong style={{ fontFamily: 'var(--display)', fontSize: 20 }}>
                          {pl.a} × {pl.b}
                        </strong>
                        <TeamName time={timePorId.get(p.timeBId)} />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {!encerrado && (
          <div className="acoes">
            <Link className="btn btn--ghost" to={`/racha/${rachaId}/jogos`}>
              Voltar aos jogos
            </Link>
          </div>
        )}
      </main>
      <Dock>
        <button className="btn" onClick={compartilhar} disabled={encerradas.length === 0}>
          <Icon name="compartilhar" /> Compartilhar
        </button>
      </Dock>
    </>
  )
}
