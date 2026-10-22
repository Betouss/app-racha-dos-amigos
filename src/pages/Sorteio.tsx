import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nomeTime } from '../data/cores'
import { alternarTravado, confirmarTimes, definirGoleiro, moverParaTime, moverJogadorDeTime, reabrirSorteio, sortear, trocar, type Posicao } from '../data/acoes'
import { useAdmin, useCtx, useRacha } from '../data/store'
import type { Id } from '../domain/types'
import { somaEstrelas } from '../domain/sorteio'
import { Dock, Star, teamStyle, Voltar } from '../ui/components'
import { Icon } from '../ui/Icon'

export default function Sorteio({ rachaId }: { rachaId: Id }) {
  const dados = useRacha(rachaId)
  const ctx = useCtx()
  const admin = useAdmin()
  const nav = useNavigate()
  const [sel, setSel] = useState<Posicao | null>(null)
  const [sorteando, setSorteando] = useState(false)
  const [rodada, setRodada] = useState(0) // muda a cada sorteio para reanimar a revelação dos times
  const primeiro = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const meuSorteio = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const mostrarSuspense = useCallback((aoFim: () => void) => {
    setSel(null)
    setSorteando(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      aoFim()
      setRodada((r) => r + 1)
      setSorteando(false)
    }, DURACAO_SORTEIO())
  }, [])

  // Suspense: mostra a animação e só sorteia no fim, para os times aparecerem já prontos
  const sortearComSuspense = useCallback(() => {
    mostrarSuspense(() => {
      meuSorteio.current = sortear(ctx, rachaId)
    })
  }, [ctx, rachaId, mostrarSuspense])

  // Quem acompanha (convidado ou outro admin) vê a mesma animação quando chega um sorteio novo.
  // O resultado já chegou junto, mas fica coberto pela animação até a revelação.
  const sorteioEm = dados?.racha.sorteioEm
  const sorteioVisto = useRef(sorteioEm)
  useEffect(() => {
    if (sorteioEm === sorteioVisto.current) return
    sorteioVisto.current = sorteioEm
    if (!sorteioEm || sorteioEm === meuSorteio.current) return
    // Sorteio antigo (ex.: a tela acabou de abrir): não anima
    if (Date.now() - sorteioEm > 15_000) return
    mostrarSuspense(() => {})
  }, [sorteioEm, mostrarSuspense])

  // Pelada aberta ainda sem times: faz o primeiro sorteio
  const precisaSortear = admin && !!dados && dados.racha.status === 'aberto' && dados.times.length === 0 && dados.presencas.length > 0
  useEffect(() => {
    if (!precisaSortear || primeiro.current) return
    primeiro.current = true
    sortearComSuspense()
  }, [precisaSortear, sortearComSuspense])

  if (dados === undefined) return null
  if (dados === null) return <main className="page">Pelada não encontrada.</main>
  const { racha, times, timeJogadores, presencas, jogadores, partidas } = dados
  const editavel = admin && racha.status === 'aberto'
  // Com a pelada rolando o administrador ainda troca jogadores e goleiros; o que já foi jogado não muda
  const trocavel = editavel || (admin && racha.status === 'em_andamento')
  const comecou = partidas.some((p) => p.status !== 'agendada')
  const porTime = new Map(times.map((t) => [t.id!, timeJogadores.filter((tj) => tj.timeId === t.id)]))
  const reservas = presencas.filter((p) => p.reserva).map((p) => p.jogadorId)
  const tamanho = racha.jogadoresLinha + 1

  const tocar = (p: Posicao) => {
    if (!trocavel) return
    if (!sel) return setSel(p)
    if (sel.jogadorId === p.jogadorId) return setSel(null)
    if (trocavel && sel.timeId !== p.timeId) {
      trocar(ctx, rachaId, sel, p)
      return setSel(null)
    }
    setSel(p)
  }

  const resortear = sortearComSuspense

  const confirmar = () => {
    confirmarTimes(ctx, rachaId)
    nav(`/racha/${rachaId}/jogos`)
  }

  const selecionado = sel ? jogadores.get(sel.jogadorId) : undefined
  const selTj = sel?.timeId ? porTime.get(sel.timeId)?.find((tj) => tj.jogadorId === sel.jogadorId) : undefined

  return (
    <>
      <main className="page">
        {editavel || (!admin && racha.status === 'aberto') ? (
          editavel && <Voltar to={`/racha/${rachaId}/editar`} label="Presença" />
        ) : (
          <Voltar to={`/racha/${rachaId}/jogos`} label="Jogos" />
        )}
        <p className="eyebrow">{racha.status === 'aberto' ? 'Passo 2 de 3' : 'Times'}</p>
        <h1>{racha.status === 'aberto' ? 'Sorteio' : trocavel ? 'Alterar times' : 'Times'}</h1>
        <p className="sub">
          {editavel
            ? 'Trave quem não pode mudar de time e sorteie de novo. Toque em dois jogadores para trocá-los.'
            : trocavel
              ? 'Toque em um jogador para colocá-lo no gol, ou em dois jogadores (ou um reserva) para trocá-los. Vale para as próximas partidas e para a que está ao vivo; as já encerradas não mudam.'
              : admin
                ? 'Times confirmados.'
              : racha.status === 'aberto'
                ? 'Sorteio em andamento. Os times podem mudar até o administrador confirmar.'
                : 'Times confirmados.'}
        </p>

        {sel && selecionado && (
          <div className="aviso" style={{ position: 'sticky', top: 8, zIndex: 5 }}>
            <strong>{selecionado.apelido}</strong> selecionado.{' '}
            {trocavel &&
              (sel.timeId === null
                ? 'Toque em um jogador de time para trocar, ou em “Colocar aqui”.'
                : 'Toque em outro jogador para trocar, ou em “Mover para cá” para transferir.')}
            <div className="acoes acoes--2" style={{ marginTop: 10 }}>
              {sel.timeId !== null && !selTj?.goleiro ? (
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    definirGoleiro(ctx, sel.timeId!, sel.jogadorId)
                    setSel(null)
                  }}
                >
                  <Icon name="luva" /> Pôr no gol
                </button>
              ) : (
                <span />
              )}
              <button className="btn btn--sm btn--ghost" onClick={() => setSel(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div key={rodada} className={`times${times.length === 1 ? ' times--1' : ''}${rodada > 0 ? ' times--revela' : ''}`}>
          {times.map((t) => {
            const elenco = porTime.get(t.id!) ?? []
            const ids = elenco.map((tj) => tj.jogadorId)
            const goleiroId = elenco.find((tj) => tj.goleiro)?.jogadorId ?? null
            const soma = somaEstrelas({ jogadores: ids, goleiroId }, jogadores)
            const ordenado = [...elenco].sort(
              (a, b) => Number(b.goleiro) - Number(a.goleiro) || (jogadores.get(b.jogadorId)?.estrelas ?? 0) - (jogadores.get(a.jogadorId)?.estrelas ?? 0),
            )
            return (
              <section key={t.id} className="time-card" style={teamStyle(t.cor)}>
                <div className="time-card__head">
                  <span>{t.nome}</span>
                  <span className="time-card__soma">
                    {!goleiroId && (
                      <span title="Goleiro rotativo" style={{ marginRight: 6, fontSize: 12, opacity: 0.85, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Icon name="luva" size={13} /> rotativo
                      </span>
                    )}
                    <Star size={18} /> {soma}
                  </span>
                </div>
                <ul>
                  {ordenado.map((tj) => {
                    const j = jogadores.get(tj.jogadorId)
                    const marcado = sel?.jogadorId === tj.jogadorId
                    return (
                      <li key={tj.jogadorId} className={`slot${marcado ? ' sel' : ''}`}>
                        <button className="slot__nome" onClick={() => tocar({ jogadorId: tj.jogadorId, timeId: t.id! })}>
                          <span>{j?.apelido}</span>
                          {tj.goleiro && (
                            <span className="slot__gk" title="Goleiro">
                              <Icon name="luva" size={15} />
                            </span>
                          )}
                        </button>
                        <span className="slot__nota">
                          <Star size={14} />
                          {j?.estrelas}
                        </span>
                        {editavel ? (
                          <button
                            className={`slot__lock${tj.travado ? ' on' : ''}`}
                            aria-label={tj.travado ? `Destravar ${j?.apelido}` : `Travar ${j?.apelido} no ${t.nome}`}
                            aria-pressed={tj.travado}
                            onClick={() => alternarTravado(ctx, t.id!, tj.jogadorId)}
                          >
                            <Icon name={tj.travado ? 'cadeado' : 'aberto'} size={20} />
                          </button>
                        ) : (
                          <span style={{ width: 8 }} />
                        )}
                      </li>
                    )
                  })}
                  {elenco.length < tamanho && (
                    <li className="slot" style={{ color: 'var(--muted)', fontSize: 14, justifyContent: 'space-between', paddingRight: 8 }}>
                      Faltam {tamanho - elenco.length}
                      {trocavel && sel?.timeId === null && (
                        <button
                          className="link-btn"
                          onClick={() => {
                            moverParaTime(ctx, rachaId, sel.jogadorId, t.id!)
                            setSel(null)
                          }}
                        >
                          Colocar aqui
                        </button>
                      )}
                    </li>
                  )}
                </ul>
                {trocavel && sel && sel.timeId !== t.id && (
                  <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="link-btn"
                      style={{ fontSize: 13, gap: 4 }}
                      onClick={() => {
                        moverJogadorDeTime(ctx, rachaId, sel.jogadorId, sel.timeId, t.id!)
                        setSel(null)
                      }}
                    >
                      <Icon name="check" size={14} /> Mover {selecionado?.apelido} para cá
                    </button>
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {reservas.length > 0 && (
          <section className="reservas">
            <span className="label" style={{ margin: 0 }}>
              Reservas · {reservas.length}
            </span>
            <div className="reservas__lista">
              {reservas.map((id) => {
                const j = jogadores.get(id)
                return (
                  <button
                    key={id}
                    className={`reserva${sel?.jogadorId === id ? ' sel' : ''}`}
                    disabled={!trocavel}
                    onClick={() => tocar({ jogadorId: id, timeId: null })}
                  >
                    {j?.apelido}
                    <span className="slot__nota">
                      <Star size={13} />
                      {j?.estrelas}
                    </span>
                  </button>
                )
              })}
            </div>
            {trocavel && sel && sel.timeId !== null && (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    moverJogadorDeTime(ctx, rachaId, sel.jogadorId, sel.timeId, null)
                    setSel(null)
                  }}
                >
                  <Icon name="check" size={14} /> Mover {selecionado?.apelido} para reserva
                </button>
              </div>
            )}
          </section>
        )}

        {admin && !editavel && !comecou && (
          <div className="acoes">
            <button
              className="btn btn--ghost"
              onClick={() => {
                if (reabrirSorteio(ctx, rachaId)) setSel(null)
              }}
            >
              <Icon name="sorteio" /> Refazer sorteio
            </button>
          </div>
        )}
      </main>
      <Dock>
        {editavel ? (
          <div className="acoes acoes--2" style={{ marginTop: 0 }}>
            <button className="btn btn--outline" style={{ fontSize: 16, gap: 8 }} onClick={resortear} disabled={sorteando}>
              <Icon name="sorteio" /> Sortear outra vez
            </button>
            <button className="btn" style={{ fontSize: 16, gap: 8 }} onClick={confirmar} disabled={times.length < 2}>
              <Icon name="check" /> Confirmar times
            </button>
          </div>
        ) : racha.status !== 'aberto' ? (
          <button className="btn" onClick={() => nav(`/racha/${rachaId}/jogos`)}>
            Ver jogos
          </button>
        ) : null}
      </Dock>

      {sorteando && (
        <SorteandoTimes
          nomes={presencas.map((p) => jogadores.get(p.jogadorId)?.apelido ?? '').filter(Boolean)}
          cores={Array.from({ length: racha.qtdTimes }, (_, i) => times[i]?.cor ?? nomeTime(i).cor)}
        />
      )}
    </>
  )
}

const reduzMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
const DURACAO_SORTEIO = () => (reduzMovimento() ? 700 : 2600)

const FASES = ['Embaralhando jogadores', 'Equilibrando as estrelas', 'Escolhendo os goleiros', 'Fechando os times']

/** Tela de suspense do sorteio: nomes girando como num caça-níquel, cores dos times pulsando. */
function SorteandoTimes({ nomes, cores }: { nomes: string[]; cores: string[] }) {
  const [nome, setNome] = useState(0)
  const [fase, setFase] = useState(0)

  useEffect(() => {
    if (nomes.length === 0) return
    // Gira rápido e vai desacelerando, como uma roleta
    let atraso = 60
    let t: number
    const girar = () => {
      setNome((n) => (n + 1) % nomes.length)
      atraso = Math.min(atraso * 1.12, 260)
      t = window.setTimeout(girar, atraso)
    }
    t = window.setTimeout(girar, atraso)
    return () => window.clearTimeout(t)
  }, [nomes.length])

  useEffect(() => {
    const passo = DURACAO_SORTEIO() / FASES.length
    const t = window.setInterval(() => setFase((f) => Math.min(f + 1, FASES.length - 1)), passo)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className="sorteando" role="status" aria-live="polite">
      <div className="sorteando__campo" aria-hidden="true" />
      <div className="sorteando__bola" aria-hidden="true">
        <Icon name="bola" size={64} strokeWidth={1.6} />
      </div>
      <h2 className="sorteando__titulo">
        Sorteando times<span className="sorteando__pontos" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
      </h2>
      <div className="sorteando__roleta" aria-hidden="true">
        <span key={nome}>{nomes[nome] ?? '…'}</span>
      </div>
      <div className="sorteando__cores" aria-hidden="true">
        {cores.map((c, i) => (
          <span key={i} style={{ background: c, animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
      <p className="sorteando__fase" key={fase}>
        {FASES[fase]}
      </p>
    </div>
  )
}
