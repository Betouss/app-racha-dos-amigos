import { Link, useNavigate } from 'react-router-dom'
import { rotaDoRacha } from '../data/acoes'
import { carregarExemplo } from '../data/exemplo'
import { useAdmin, useApp, useBase, type BaseCompleta } from '../data/store'
import type { Racha } from '../domain/types'
import { artilharia, campeaoDoRacha, placar } from '../domain/stats'
import { Dock, TeamName, teamStyle, Vazio } from '../ui/components'
import { diaCurto, diaHora, hojeLongo, relativo } from '../ui/datas'
import { Icon } from '../ui/Icon'
import { useTema } from '../ui/tema'

export default function Inicio() {
  const base = useBase()
  const { grupo, grupoId } = useApp()
  const admin = useAdmin()
  const nav = useNavigate()
  const { tema, alternar } = useTema()

  const ativos = base.rachas.filter((r) => r.status !== 'encerrado').sort((a, b) => a.data.localeCompare(b.data))
  const ativo = ativos[0]
  const encerrados = base.rachas.filter((r) => r.status === 'encerrado')
  const temporada = new Date().getFullYear().toString()

  const jogadorPorId = new Map(base.jogadores.map((j) => [j.id!, j]))
  const timePorId = new Map(base.times.map((t) => [t.id!, t]))

  const ultimo = encerrados[0]
  const campeaoId = ultimo ? campeaoDoRacha(ultimo.id!, base) : null
  const campeao = campeaoId ? timePorId.get(campeaoId) : undefined

  const partidasTemporada = new Set(
    base.partidas.filter((p) => base.rachas.find((r) => r.id === p.rachaId)?.data.startsWith(temporada)).map((p) => p.id!),
  )
  const artilheiro = artilharia(base.gols.filter((g) => partidasTemporada.has(g.partidaId)))[0]

  return (
    <>
      <main className="page">
        <div className="topo">
          <div>
            <p className="sub" style={{ margin: 0 }}>
              {hojeLongo()} · {grupo?.nome}
            </p>
            <h1 style={{ fontSize: 40 }}>PeladaFC</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-btn" onClick={alternar} aria-label={tema === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
              <Icon name={tema === 'dark' ? 'sol' : 'lua'} />
            </button>
            <Link className="icon-btn" to="/grupo" aria-label="Grupo e convites">
              <Icon name="users" />
            </Link>
          </div>
        </div>

        {base.jogadores.length === 0 && !admin ? (
          <div className="pitch" style={{ marginTop: 20 }}>
            <div className="pitch__eyebrow">Bem-vindo</div>
            <div className="pitch__titulo">Tudo pronto</div>
            <p style={{ margin: 0, lineHeight: 1.4 }}>Quando o administrador marcar a primeira pelada, ela aparece aqui.</p>
          </div>
        ) : base.jogadores.length === 0 ? (
          <div className="pitch" style={{ marginTop: 20 }}>
            <div className="pitch__eyebrow">Bem-vindo</div>
            <div className="pitch__titulo">Monte a galera</div>
            <p style={{ margin: '4px 0 16px', lineHeight: 1.4 }}>Cadastre os jogadores com o nível de cada um. O sorteio usa as estrelas para equilibrar os times.</p>
            <div className="acoes">
              <Link className="btn btn--sm" to="/jogadores/novo">
                <Icon name="mais" /> Adicionar jogador
              </Link>
              <button className="btn btn--sm btn--ghost" style={{ color: 'inherit', borderColor: 'currentColor' }} onClick={() => carregarExemplo(grupoId!)}>
                Carregar dados de exemplo
              </button>
            </div>
          </div>
        ) : ativo ? (
          <CardAtivo ativo={ativo} base={base} />
        ) : (
          <Link className="pitch" to={admin ? '/racha/novo' : '/'} style={{ marginTop: 20 }}>
            <div className="pitch__eyebrow">Próxima pelada</div>
            <div className="pitch__titulo">Nada marcado</div>
            <p style={{ margin: 0 }}>{admin ? 'Toque para marcar o próximo racha.' : 'O administrador ainda não marcou o próximo.'}</p>
          </Link>
        )}

        {(campeao || artilheiro) && (
          <div className="grid-2" style={{ marginTop: 20 }}>
            {campeao ? (
              <Link to={`/racha/${ultimo.id}/classificacao`} className="stat stat--team" style={teamStyle(campeao.cor)}>
                <Icon name="trofeu" />
                <span className="stat__valor">{campeao.nome}</span>
                <span className="stat__label">Último campeão</span>
              </Link>
            ) : (
              <div />
            )}
            {artilheiro && (
              <Link to={`/jogadores/${artilheiro.jogadorId}`} className="stat">
                <Icon name="bola" />
                <span className="stat__valor">{artilheiro.gols}</span>
                <span className="stat__label">Gols · {jogadorPorId.get(artilheiro.jogadorId)?.apelido}</span>
              </Link>
            )}
          </div>
        )}

        {encerrados.length > 0 && (
          <section className="secao">
            <h2>Histórico</h2>
            <ul className="lista lista--junta">
              {encerrados.map((r) => {
                const partidas = base.partidas.filter((p) => p.rachaId === r.id)
                const gols = partidas.reduce((s, p) => {
                  const pl = placar(p, base.gols)
                  return s + pl.a + pl.b
                }, 0)
                const c = campeaoDoRacha(r.id!, base)
                return (
                  <li key={r.id}>
                    <Link className="item" to={`/racha/${r.id}/classificacao`}>
                      <div className="item__main">
                        <div className="item__titulo">{diaCurto(r.data)}</div>
                        <div className="item__sub">
                          {gols} gols · {partidas.length} partidas
                        </div>
                      </div>
                      <TeamName time={c ? timePorId.get(c) : undefined} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {base.jogadores.length > 0 && encerrados.length === 0 && !ativo && (
          <section className="secao">
            <Vazio titulo="Nenhuma pelada ainda">O histórico aparece aqui depois da primeira pelada.</Vazio>
          </section>
        )}
      </main>
      <Dock>
        {ativo ? (
          <button className="btn" onClick={() => nav(rotaDoRacha(ativo, base.partidas))}>
            <Icon name="play" /> {admin ? 'Continuar pelada' : 'Acompanhar pelada'}
          </button>
        ) : !admin ? null : (
          <button className="btn" onClick={() => nav('/racha/novo')} disabled={base.jogadores.length === 0}>
            <Icon name="mais" size={26} /> Nova pelada
          </button>
        )}
      </Dock>
    </>
  )
}

function CardAtivo({ ativo, base }: { ativo: Racha; base: BaseCompleta }) {
  const confirmados = base.presencas.filter((p) => p.rachaId === ativo.id).length
  const vagas = ativo.qtdTimes * (ativo.jogadoresLinha + 1)
  const partidas = base.partidas.filter((p) => p.rachaId === ativo.id).sort((a, b) => a.ordem - b.ordem)
  const jogadas = partidas.filter((p) => p.status === 'encerrada').length
  const aoVivo = partidas.find((p) => p.status === 'em_andamento')

  return (
    <Link className="pitch" to={rotaDoRacha(ativo, base.partidas)} style={{ marginTop: 20 }}>
      <div className="topo" style={{ alignItems: 'center' }}>
        <span className="pitch__eyebrow">{ativo.status === 'aberto' ? 'Próxima pelada' : 'Pelada em andamento'}</span>
        {aoVivo ? <span className="chip chip--live">Ao vivo</span> : <span className="chip">{relativo(ativo.data)}</span>}
      </div>
      <div className="pitch__titulo">{diaHora(ativo.data)}</div>
      <div style={{ fontSize: 17 }}>{ativo.local}</div>
      {ativo.status === 'aberto' ? (
        <>
          <div className="topo" style={{ alignItems: 'baseline', marginTop: 22 }}>
            <span className="pitch__eyebrow">Confirmados</span>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 28 }}>
              {confirmados} / {vagas}
            </span>
          </div>
          <div className="barra">
            <span style={{ width: `${Math.min(100, (confirmados / vagas) * 100)}%` }} />
          </div>
          <div style={{ fontSize: 14 }}>
            {ativo.qtdTimes} times de {ativo.jogadoresLinha + 1} · {confirmados >= vagas ? 'lista fechada' : `faltam ${vagas - confirmados}`}
          </div>
        </>
      ) : (
        <>
          <div className="progresso">
            {partidas.map((p) => (
              <span key={p.id} className={p.status === 'encerrada' ? 'feita' : p.status === 'em_andamento' ? 'atual' : ''} />
            ))}
          </div>
          <div style={{ fontSize: 14 }}>
            {ativo.formato === 'vencedor_fica' ? `${jogadas} partida${jogadas === 1 ? '' : 's'} jogada${jogadas === 1 ? '' : 's'} · quem ganha fica` : `${jogadas} de ${partidas.length} partidas jogadas`}
          </div>
        </>
      )}
    </Link>
  )
}
