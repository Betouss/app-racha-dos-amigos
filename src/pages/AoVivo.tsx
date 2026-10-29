import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  atualizarGol,
  definirGoleiroPartida,
  adicionarJogadorNaPartida,
  desfazerGol,
  editarTimesPartida,
  encerrarPartida,
  iniciarPartida,
  reabrirPartida,
  registrarGol,
} from '../data/acoes'
import { useAgora, useTelaAcesa } from '../data/hooks'
import { useAdmin, useCtx, useRacha } from '../data/store'
import { goleiroQueSofreu, placar, timeDoGol, timeQueSofreu } from '../domain/stats'
import { vencedorFica } from '../domain/vencedorFica'
import type { Gol, Id, Jogador, Time } from '../domain/types'
import { Avatar, Confirmar, Dock, Sheet, Stepper, TeamDot, teamStyle, useToast, Voltar } from '../ui/components'
import { EscolherTimesPartida } from '../ui/EscolherTimesPartida'
import { apitarFim } from '../ui/apito'
import { mmss } from '../ui/datas'
import { Icon } from '../ui/Icon'

export default function AoVivo() {
  const params = useParams()
  const rachaId = params.id!
  const partidaId = params.pid!
  const dados = useRacha(rachaId)
  const ctx = useCtx()
  const admin = useAdmin()
  const nav = useNavigate()
  const agora = useAgora(500)
  const toast = useToast()
  useTelaAcesa()

  const [golDe, setGolDe] = useState<Id | null>(null) // time beneficiado
  const [assistDe, setAssistDe] = useState<Id | null>(null) // id do gol
  const [editando, setEditando] = useState<Id | null>(null)
  const [trocaGoleiro, setTrocaGoleiro] = useState<Id | null>(null) // time
  const [emprestarPara, setEmprestarPara] = useState<Id | null>(null) // time
  const [confirmaFim, setConfirmaFim] = useState(false)
  const [editandoTimes, setEditandoTimes] = useState(false)
  const [iniciarAposEmpate, setIniciarAposEmpate] = useState(false)
  const avisou = useRef(false)

  const partida = dados?.partidas.find((p) => p.id === partidaId)
  const duracaoMs = (dados?.racha.duracaoPartidaMin ?? 0) * 60000
  const bruto = partida?.iniciadaEm ? (partida.encerradaEm ?? agora) - partida.iniciadaEm : 0
  // No minuto configurado o cronômetro para: o tempo exibido nunca passa da duração
  const esgotado = duracaoMs > 0 && bruto >= duracaoMs
  const decorrido = esgotado ? duracaoMs : bruto
  // Só apita se a virada aconteceu agora, com a tela aberta — não ao reabrir uma partida antiga
  const apitarAgora = esgotado && partida?.status === 'em_andamento' && bruto - duracaoMs < 10_000

  // Partida com limite de gols: quem chega primeiro vence e a partida acaba
  const limite = dados?.racha.golsParaVencer ?? 0
  const plAtual = partida && dados ? placar(partida, dados.gols) : { a: 0, b: 0 }
  const bateuLimite = limite > 0 && partida?.status === 'em_andamento' && Math.max(plAtual.a, plAtual.b) >= limite
  const avisouLimite = useRef(false)
  useEffect(() => {
    if (!bateuLimite) {
      avisouLimite.current = false
      return
    }
    if (avisouLimite.current) return
    avisouLimite.current = true
    apitarFim()
    navigator.vibrate?.([400, 150, 900])
    if (admin) setConfirmaFim(true)
  }, [bateuLimite, admin])

  useEffect(() => {
    if (apitarAgora && !avisou.current) {
      avisou.current = true
      apitarFim()
      navigator.vibrate?.([400, 150, 400, 150, 900])
    }
  }, [apitarAgora])

  if (!dados || !partida) return null
  const { racha, times, gols, timeJogadores, jogadores, partidas, presencas } = dados
  const timeA = times.find((t) => t.id === partida.timeAId)!
  const timeB = times.find((t) => t.id === partida.timeBId)!
  const pl = placar(partida, gols)
  const lances = gols.filter((g) => g.partidaId === partidaId).sort((a, b) => b.criadoEm - a.criadoEm)
  const goleiroDoTime = (timeId: Id) =>
    partida.goleiros?.[timeId] ?? timeJogadores.find((tj) => tj.timeId === timeId && tj.goleiro)?.jogadorId

  const elenco = (timeId: Id) => {
    const ids = new Set(timeJogadores.filter((tj) => tj.timeId === timeId).map((tj) => tj.jogadorId))
    const gkPartida = partida.goleiros?.[timeId]
    if (gkPartida) ids.add(gkPartida)
    for (const extra of partida.jogadoresExtras?.[timeId] ?? []) ids.add(extra)
    return [...ids]
      .map((id) => {
        const j = jogadores.get(id)
        if (!j) return null
        const isGk = id === goleiroDoTime(timeId)
        return { ...j, goleiroNoJogo: isGk }
      })
      .filter((j): j is Jogador & { goleiroNoJogo: boolean } => j !== null)
      .sort((a, b) => Number(b.goleiroNoJogo) - Number(a.goleiroNoJogo) || a.apelido.localeCompare(b.apelido))
  }
  const outro = (timeId: Id) => (timeId === timeA.id ? timeB : timeA)

  // Goleiro do time que acabou de perder na partida anterior (para sugestão rápida de revezamento)
  const sugestaoGoleiroPerdedor = (() => {
    const encerradas = partidas.filter((p) => p.status === 'encerrada').sort((a, b) => b.ordem - a.ordem)
    const ultima = encerradas[0]
    if (!ultima) return null
    const plUltima = placar(ultima, gols)
    let timePerdedorId: Id
    if (plUltima.a > plUltima.b) timePerdedorId = ultima.timeBId
    else if (plUltima.b > plUltima.a) timePerdedorId = ultima.timeAId
    else timePerdedorId = ultima.timeAId

    const timePerdedor = times.find((t) => t.id === timePerdedorId)
    const gkId =
      ultima.goleiros?.[timePerdedorId] ??
      timeJogadores.find((tj) => tj.timeId === timePerdedorId && tj.goleiro)?.jogadorId
    const gk = gkId ? jogadores.get(gkId) : undefined
    if (!gk || !timePerdedor) return null

    // Verificar se algum dos times desta partida está sem goleiro
    const gkA = goleiroDoTime(timeA.id)
    const gkB = goleiroDoTime(timeB.id)

    if (!gkA && gkB !== gk.id) return { goleiro: gk, timeAlvo: timeA, timeOrigem: timePerdedor }
    if (!gkB && gkA !== gk.id) return { goleiro: gk, timeAlvo: timeB, timeOrigem: timePerdedor }

    const emJogo = new Set([...elenco(timeA.id).map((j) => j.id), ...elenco(timeB.id).map((j) => j.id)])
    if (!emJogo.has(gk.id)) {
      return { goleiro: gk, timeAlvo: null, timeOrigem: timePerdedor }
    }
    return null
  })()

  // Gols sofridos por goleiro, por time; o goleiro atual aparece mesmo sem ter sofrido gol
  const sofridos = (timeId: Id) => {
    const m = new Map<Id, number>()
    const atual = goleiroDoTime(timeId)
    if (atual) m.set(atual, 0)
    for (const g of lances) {
      if (timeQueSofreu(g, partida) !== timeId) continue
      const gk = goleiroQueSofreu(g, partida, timeJogadores)
      if (gk) m.set(gk, (m.get(gk) ?? 0) + 1)
    }
    return { atual, porGoleiro: [...m.entries()] }
  }
  const timeDoJogador = (jogadorId: Id) => {
    if (elenco(timeA.id).some((j) => j.id === jogadorId)) return timeA.id
    if (elenco(timeB.id).some((j) => j.id === jogadorId)) return timeB.id
    return timeA.id
  }
  const minutoAtual = Math.min(Math.floor(decorrido / 60000) + 1, racha.duracaoPartidaMin)
  const aoVivo = partida.status === 'em_andamento'

  const encerradas = partidas.filter((p) => p.status === 'encerrada').sort((a, b) => b.ordem - a.ordem)
  const ultima = encerradas.find((p) => p.ordem < partida.ordem)
  const ultimoEmpatou = (() => {
    if (!ultima || partida.status !== 'agendada') return false
    const plUltima = placar(ultima, gols)
    return plUltima.a === plUltima.b
  })()

  const comecar = () => {
    if (ultimoEmpatou) {
      setIniciarAposEmpate(true)
      setEditandoTimes(true)
      return
    }
    iniciarPartida(ctx, partidaId)
  }

  const filaTimes = (() => {
    if (racha.formato !== 'vencedor_fica') return []
    const indice = new Map(times.map((t, i) => [t.id, i]))
    const jogosAnteriores = partidas
      .filter((p) => p.status === 'encerrada' && p.ordem < partida.ordem)
      .sort((a, b) => a.ordem - b.ordem)
      .map((p) => {
        const pl = placar(p, gols)
        const a = indice.get(p.timeAId)!
        const b = indice.get(p.timeBId)!
        return { a, b, vencedor: pl.a > pl.b ? a : pl.b > pl.a ? b : null }
      })
    return vencedorFica(times.length, jogosAnteriores).fila.map((i) => times[i])
  })()

  const marcar = (beneficiado: Time, autor: Jogador, contra: boolean) => {
    setGolDe(null)
    const id = registrarGol(ctx, {
      partidaId,
      jogadorId: autor.id,
      timeId: contra ? outro(beneficiado.id).id : beneficiado.id,
      contra,
      goleiroId: goleiroDoTime(outro(beneficiado.id).id),
      minuto: partida.iniciadaEm ? minutoAtual : (racha.duracaoPartidaMin || undefined),
    })
    navigator.vibrate?.(60)
    toast.mostrar({
      texto: contra ? `Gol contra de ${autor.apelido}` : `Gol de ${autor.apelido}!`,
      acao: contra ? undefined : { label: '+ Assistência', fn: () => setAssistDe(id) },
    })
  }

  const encerrar = () => {
    setConfirmaFim(false)
    encerrarPartida(ctx, partidaId)
    nav(`/racha/${rachaId}/jogos`, { replace: true })
  }

  const golAssist = assistDe ? gols.find((g) => g.id === assistDe) : undefined
  const golEdit = editando ? gols.find((g) => g.id === editando) : undefined

  return (
    <>
      <main className="page page--solo">
        <Voltar to={`/racha/${rachaId}/jogos`} label="Jogos" />
        <section className="placar">
          <div className="placar__topo">
            <span className="pitch__eyebrow">
              Partida {partida.ordem}
              {racha.formato === 'vencedor_fica' ? '' : ` de ${partidas.length}`}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {admin && partida.status === 'encerrada' && (
                <button
                  type="button"
                  className="link-btn"
                  style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    setIniciarAposEmpate(false)
                    setEditandoTimes(true)
                  }}
                >
                  <Icon name="troca" size={14} /> Alterar times
                </button>
              )}
              {aoVivo ? (
                <span className="chip chip--live">Ao vivo</span>
              ) : (
                <span className="chip">{partida.status === 'encerrada' ? 'Encerrada' : 'Agendada'}</span>
              )}
            </div>
          </div>
          <div className="placar__times">
            <span className="placar__nome" style={teamStyle(timeA.cor)}>
              {timeA.nome}
            </span>
            <span />
            <span className="placar__nome" style={teamStyle(timeB.cor)}>
              {timeB.nome}
            </span>
            <span className="placar__gols" aria-label={`${timeA.nome} ${pl.a}`}>
              {pl.a}
            </span>
            <span className="placar__x">×</span>
            <span className="placar__gols" aria-label={`${timeB.nome} ${pl.b}`}>
              {pl.b}
            </span>
          </div>
          <div className={`placar__relogio${esgotado && aoVivo ? ' estourou' : ''}`} role="timer">
            <Icon name="relogio" size={28} /> {mmss(decorrido)}
            {duracaoMs > 0 && !esgotado && <small>/ {mmss(duracaoMs)}</small>}
          </div>
          {bateuLimite ? (
            <div className="placar__fim">
              {pl.a >= limite ? timeA.nome : timeB.nome} fez {limite} gol{limite > 1 ? 's' : ''} · encerre a partida
            </div>
          ) : esgotado && aoVivo ? (
            <div className="placar__fim">Tempo esgotado · encerre a partida</div>
          ) : (
            limite > 0 && <div className="placar__regra">Vence quem fizer {limite} gol{limite > 1 ? 's' : ''} primeiro</div>
          )}
        </section>

        {admin && partida.status !== 'encerrada' && sugestaoGoleiroPerdedor?.timeAlvo && (
          <div className="aviso" style={{ marginTop: 12, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0, fontSize: 14 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="luva" size={16} /> <b>{sugestaoGoleiroPerdedor.goleiro.apelido}</b>
              </span>{' '}
              acabou de sair pelo {sugestaoGoleiroPerdedor.timeOrigem.nome}. Escalar no gol do <b>{sugestaoGoleiroPerdedor.timeAlvo.nome}</b>?
            </div>
            <button
              className="btn btn--sm"
              style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: 13 }}
              onClick={() => {
                definirGoleiroPartida(ctx, partidaId, sugestaoGoleiroPerdedor.timeAlvo!.id, sugestaoGoleiroPerdedor.goleiro.id)
                toast.mostrar({ texto: `${sugestaoGoleiroPerdedor.goleiro.apelido} no gol do ${sugestaoGoleiroPerdedor.timeAlvo!.nome}` })
              }}
            >
              Escalar
            </button>
          </div>
        )}

        {!admin ? null : partida.status === 'agendada' ? (
          <div className="acoes" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
            <button className="btn" onClick={comecar}>
              <Icon name="play" /> Começar partida
            </button>
            <button
              className="btn btn--outline"
              onClick={() => {
                setIniciarAposEmpate(false)
                setEditandoTimes(true)
              }}
            >
              <Icon name="troca" /> Alterar times
            </button>
          </div>
        ) : (
          <div className="gol-btns">
            {[timeA, timeB].map((t) => (
              <button
                key={t.id}
                className="gol-btn"
                style={teamStyle(t.cor)}
                onClick={() => setGolDe(t.id!)}
                disabled={!aoVivo && (!admin || partida.status !== 'encerrada')}
              >
                <Icon name="bola" size={34} />
                <b>Gol</b>
                <small>{t.nome}</small>
              </button>
            ))}
          </div>
        )}

        <div className="goleiros">
          {[timeA, timeB].map((t) => {
            const { atual, porGoleiro } = sofridos(t.id)
            const gkAtual = atual ? jogadores.get(atual) : undefined
            const golsAtual = porGoleiro.find(([id]) => id === atual)?.[1] ?? 0
            const anteriores = porGoleiro.filter(([id]) => id !== atual)
            const podeTrocar = admin && partida.status !== 'encerrada'
            return (
              <button
                key={t.id}
                className="goleiro"
                onClick={() => podeTrocar && setTrocaGoleiro(t.id)}
                disabled={!podeTrocar}
                aria-label={podeTrocar ? `Trocar goleiro do ${t.nome}` : undefined}
              >
                <span className="goleiro__time">
                  <TeamDot cor={t.cor} size={10} /> Goleiro · {t.nome}
                </span>
                <span className="goleiro__nome">
                  <Icon name="luva" size={18} /> {gkAtual?.apelido ?? 'Sem goleiro'}
                  {podeTrocar && <Icon name="troca" size={16} />}
                </span>
                {gkAtual && (
                  <span className="goleiro__sofridos">
                    <b>{golsAtual}</b> gol{golsAtual === 1 ? '' : 's'} sofrido{golsAtual === 1 ? '' : 's'}
                  </span>
                )}
                {anteriores.map(([id, n]) => (
                  <span key={id} className="goleiro__extra">
                    {jogadores.get(id)?.apelido}: {n} sofrido{n === 1 ? '' : 's'}
                  </span>
                ))}
              </button>
            )
          })}
        </div>
        {admin && partida.status !== 'encerrada' && racha.status !== 'encerrado' && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <button className="link-btn" onClick={() => setEmprestarPara(timeA.id)}>
              <Icon name="mais" size={16} /> Emprestar para {timeA.nome}
            </button>
            <button className="link-btn" onClick={() => setEmprestarPara(timeB.id)}>
              <Icon name="mais" size={16} /> Emprestar para {timeB.nome}
            </button>
            <button className="link-btn" onClick={() => nav(`/racha/${rachaId}/sorteio`)}>
              <Icon name="users" size={16} /> Alterar times
            </button>
          </div>
        )}

        <div className="lances-head">
          <h3>Lances</h3>
          {admin && lances.length > 0 && <span>Errou? Toque em desfazer.</span>}
        </div>
        {lances.length === 0 ? (
          <p className="hint">Nenhum gol ainda.</p>
        ) : (
          <ul className="lista lista--junta">
            {lances.map((g) => {
              const autor = jogadores.get(g.jogadorId)
              const assist = g.assistenciaId ? jogadores.get(g.assistenciaId) : undefined
              const time = times.find((t) => t.id === timeDoGol(g, partida))!
              return (
                <li key={g.id} className="lance">
                  <span className="lance__min">{g.minuto ? `${g.minuto}'` : '–'}</span>
                  <button className="lance__main" onClick={() => admin && setEditando(g.id)} aria-label={`Editar gol de ${autor?.apelido}`} disabled={!admin} style={{ color: 'inherit' }}>
                    <TeamDot cor={time.cor} />
                    <span style={{ minWidth: 0 }}>
                      <span className="item__titulo" style={{ fontSize: 16 }}>
                        {autor?.apelido}
                      </span>
                      {(assist || g.contra) && <span className="item__sub" style={{ display: 'block' }}>{g.contra ? 'gol contra' : `assist. ${assist?.apelido}`}</span>}
                    </span>
                  </button>
                  {admin && (
                    <button className="slot__lock" aria-label="Desfazer gol" onClick={() => desfazerGol(ctx, g.id)}>
                      <Icon name="desfazer" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {toast.view}

      <Dock nav={false}>
        {!admin ? (
          <button className="btn btn--outline" onClick={() => nav(`/racha/${rachaId}/jogos`)}>
            Ver jogos
          </button>
        ) : partida.status === 'encerrada' ? (
          <div className="acoes acoes--2" style={{ marginTop: 0 }}>
            <button className="btn btn--outline" style={{ fontSize: 16 }} onClick={() => reabrirPartida(ctx, partidaId)} disabled={racha.status === 'encerrado'}>
              Reabrir
            </button>
            <button className="btn" style={{ fontSize: 17 }} onClick={() => nav(`/racha/${rachaId}/jogos`)}>
              Jogos
            </button>
          </div>
        ) : (
          <button className={`btn${esgotado || bateuLimite ? '' : ' btn--outline'}`} onClick={() => setConfirmaFim(true)} disabled={!aoVivo}>
            <Icon name="relogio" /> Encerrar partida
          </button>
        )}
      </Dock>

      <Confirmar
        aberto={confirmaFim}
        titulo={bateuLimite ? `${pl.a >= limite ? timeA.nome : timeB.nome} fez ${limite} gol${limite > 1 ? 's' : ''}!` : `Encerrar a partida ${partida.ordem}?`}
        icone={bateuLimite ? 'trofeu' : 'relogio'}
        confirmar={<><Icon name="check" /> Encerrar</>}
        onConfirmar={encerrar}
        onFechar={() => setConfirmaFim(false)}
      >
        {bateuLimite ? 'Fim de jogo.' : esgotado ? 'O tempo acabou.' : `Ainda faltam ${mmss(duracaoMs - decorrido)} no relógio.`} O placar final fica assim:
        <div className="modal__destaque">
          <TeamDot cor={timeA.cor} /> {timeA.nome} {pl.a} × {pl.b} {timeB.nome} <TeamDot cor={timeB.cor} />
        </div>
      </Confirmar>

      <Sheet
        open={trocaGoleiro !== null}
        onClose={() => setTrocaGoleiro(null)}
        title={
          <>
            <Icon name="luva" /> Quem vai pro gol?
          </>
        }
      >
        {trocaGoleiro && (() => {
          const timeAlvo = times.find((t) => t.id === trocaGoleiro)
          const gkAtualId = goleiroDoTime(trocaGoleiro)
          const jogadoresDoTime = elenco(trocaGoleiro)
          const idsNoTime = new Set(jogadoresDoTime.map((j) => j.id))

          // Outros goleiros presentes na pelada
          const outrosGoleiros = [...jogadores.values()]
            .filter((j) => (j.goleiro || j.id === sugestaoGoleiroPerdedor?.goleiro.id) && !idsNoTime.has(j.id))
            .filter((j) => presencas.some((p) => p.jogadorId === j.id))

          return (
            <>
              <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
                Os próximos gols sofridos pelo {timeAlvo?.nome} contam para o novo goleiro.
              </p>

              {outrosGoleiros.length > 0 && (
                <>
                  <p className="label" style={{ margin: '8px 0 4px', fontSize: 12 }}>
                    Goleiros de outros times / Revezamento
                  </p>
                  <div className="escolha" style={{ marginBottom: 14 }}>
                    {outrosGoleiros.map((j) => {
                      const ehSugerido = sugestaoGoleiroPerdedor?.goleiro.id === j.id
                      const ehGkAtual = gkAtualId === j.id
                      const timeOrigem = times.find((t) => timeJogadores.some((tj) => tj.timeId === t.id && tj.jogadorId === j.id))
                      return (
                        <button
                          key={j.id}
                          className={ehGkAtual ? 'on' : ''}
                          onClick={() => {
                            if (!ehGkAtual) {
                              definirGoleiroPartida(ctx, partidaId, trocaGoleiro, j.id)
                              toast.mostrar({ texto: `${j.apelido} agora está no gol do ${timeAlvo?.nome}` })
                            }
                            setTrocaGoleiro(null)
                          }}
                        >
                          <Avatar jogador={j} size={36} />
                          <span>
                            {j.apelido}
                            {ehSugerido && <small style={{ color: 'var(--brand)' }}>Acabou de sair · Sugerido</small>}
                            {!ehSugerido && timeOrigem && <small>Goleiro do {timeOrigem.nome}</small>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <p className="label" style={{ margin: '8px 0 4px', fontSize: 12 }}>
                Jogadores do {timeAlvo?.nome}
              </p>
              <div className="escolha">
                {jogadoresDoTime.map((j) => (
                  <button
                    key={j.id}
                    className={j.goleiroNoJogo ? 'on' : ''}
                    onClick={() => {
                      if (!j.goleiroNoJogo) {
                        definirGoleiroPartida(ctx, partidaId, trocaGoleiro, j.id)
                        toast.mostrar({ texto: `${j.apelido} agora está no gol` })
                      }
                      setTrocaGoleiro(null)
                    }}
                  >
                    <Avatar jogador={j} size={36} />
                    <span>
                      {j.apelido}
                      {j.goleiroNoJogo && <small>goleiro atual</small>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )
        })()}
      </Sheet>

      <Sheet
        open={emprestarPara !== null}
        onClose={() => setEmprestarPara(null)}
        title={
          <>
            <Icon name="users" /> Emprestar para o {times.find((t) => t.id === emprestarPara)?.nome}
          </>
        }
      >
        {emprestarPara && (() => {
          const timeAlvo = times.find((t) => t.id === emprestarPara)!
          const jaNoTime = new Set(elenco(emprestarPara).map((j) => j.id))
          const disponiveis = [...jogadores.values()]
            .filter((j) => !jaNoTime.has(j.id) && presencas.some((p) => p.jogadorId === j.id))
            .sort((a, b) => a.apelido.localeCompare(b.apelido))

          return (
            <>
              <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
                O jogador entrará na escalação desta partida pelo {timeAlvo.nome} para completar a equipe.
              </p>
              {disponiveis.length === 0 ? (
                <p className="hint">Nenhum jogador disponível para empréstimo.</p>
              ) : (
                <div className="escolha">
                  {disponiveis.map((j) => {
                    const timeOrigem = times.find((t) => timeJogadores.some((tj) => tj.timeId === t.id && tj.jogadorId === j.id))
                    return (
                      <button
                        key={j.id}
                        onClick={() => {
                          adicionarJogadorNaPartida(ctx, partidaId, emprestarPara, j.id)
                          toast.mostrar({ texto: `${j.apelido} emprestado para o ${timeAlvo.nome}` })
                          setEmprestarPara(null)
                        }}
                      >
                        <Avatar jogador={j} size={36} />
                        <span>
                          {j.apelido}
                          {timeOrigem && <small>{timeOrigem.nome}</small>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}
      </Sheet>

      <EscolherAutor
        aberto={golDe !== null}
        time={golDe === timeA.id ? timeA : timeB}
        adversario={golDe === timeA.id ? timeB : timeA}
        elenco={elenco}
        onFechar={() => setGolDe(null)}
        onEscolher={marcar}
      />

      <Sheet open={!!golAssist} onClose={() => setAssistDe(null)} title="Quem deu o passe?">
        {golAssist && (
          <div className="escolha">
            {elenco(golAssist.timeId)
              .filter((j) => j.id !== golAssist.jogadorId)
              .map((j) => (
                <button
                  key={j.id}
                  onClick={() => {
                    atualizarGol(ctx, golAssist.id, { assistenciaId: j.id })
                    setAssistDe(null)
                  }}
                >
                  <Avatar jogador={j} size={36} /> {j.apelido}
                </button>
              ))}
          </div>
        )}
      </Sheet>

      {golEdit && (
        <EditarGol
          key={golEdit.id}
          gol={golEdit}
          jogadoresDosTimes={[...elenco(timeA.id), ...elenco(timeB.id)]}
          elenco={elenco}
          timeDoJogador={timeDoJogador}
          times={[timeA, timeB]}
          goleiroDoTime={goleiroDoTime}
          onFechar={() => setEditando(null)}
        />
      )}

      {editandoTimes && (
        <EscolherTimesPartida
          aberto={true}
          partida={partida}
          times={times}
          fila={filaTimes}
          ultimoJogoEmpatou={iniciarAposEmpate}
          aoIniciar={iniciarAposEmpate}
          onConfirmar={(novoTimeA, novoTimeB) => {
            if (iniciarAposEmpate) {
              iniciarPartida(ctx, partidaId, { timeAId: novoTimeA, timeBId: novoTimeB })
              toast.mostrar({ texto: 'Partida iniciada!' })
            } else {
              editarTimesPartida(ctx, partidaId, novoTimeA, novoTimeB)
              toast.mostrar({ texto: 'Times da partida atualizados!' })
            }
            setEditandoTimes(false)
            setIniciarAposEmpate(false)
          }}
          onFechar={() => {
            setEditandoTimes(false)
            setIniciarAposEmpate(false)
          }}
        />
      )}
    </>
  )
}

type JogadorNoJogo = Jogador & { goleiroNoJogo: boolean }

function EscolherAutor({
  aberto,
  time,
  adversario,
  elenco,
  onFechar,
  onEscolher,
}: {
  aberto: boolean
  time: Time
  adversario: Time
  elenco: (timeId: Id) => JogadorNoJogo[]
  onFechar: () => void
  onEscolher: (beneficiado: Time, autor: Jogador, contra: boolean) => void
}) {
  const [contra, setContra] = useState(false)
  useEffect(() => {
    if (aberto) setContra(false)
  }, [aberto])
  const lista = elenco(contra ? adversario.id! : time.id!)
  return (
    <Sheet
      open={aberto}
      onClose={onFechar}
      title={
        <>
          <TeamDot cor={time.cor} size={18} /> Gol do {time.nome}
        </>
      }
    >
      <div className="filtros" style={{ marginTop: 0 }}>
        <button className={`filtro${!contra ? ' on' : ''}`} onClick={() => setContra(false)}>
          Jogador do {time.nome}
        </button>
        <button className={`filtro${contra ? ' on' : ''}`} onClick={() => setContra(true)}>
          Gol contra
        </button>
      </div>
      {contra && <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>Quem do {adversario.nome} fez contra?</p>}
      <div className="escolha">
        {lista.map((j) => (
          <button key={j.id} onClick={() => onEscolher(time, j, contra)}>
            <Avatar jogador={j} size={36} />
            <span>
              {j.apelido}
              {j.goleiroNoJogo && <small>goleiro</small>}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function EditarGol({
  gol,
  jogadoresDosTimes,
  elenco,
  timeDoJogador,
  times,
  goleiroDoTime,
  onFechar,
}: {
  gol: Gol
  jogadoresDosTimes: JogadorNoJogo[]
  elenco: (timeId: Id) => JogadorNoJogo[]
  timeDoJogador: (jogadorId: Id) => Id
  times: Time[]
  goleiroDoTime: (timeId: Id) => Id | undefined
  onFechar: () => void
}) {
  const [autor, setAutor] = useState(gol.jogadorId)
  const [contra, setContra] = useState(gol.contra)
  const ctx = useCtx()
  const [assist, setAssist] = useState<Id | undefined>(gol.assistenciaId)
  const [minuto, setMinuto] = useState(gol.minuto ?? 1)
  const timeAutor = timeDoJogador(autor)
  const companheiros = elenco(timeAutor).filter((j) => j.id !== autor)

  const salvar = () => {
    // Time que sofreu: o do autor em gol contra, senão o adversário
    const sofreu = contra ? timeAutor : times.find((t) => t.id !== timeAutor)!.id
    const sofreuAntes = gol.contra ? gol.timeId : times.find((t) => t.id !== gol.timeId)!.id
    atualizarGol(ctx, gol.id, {
      jogadorId: autor,
      timeId: timeAutor,
      contra,
      goleiroId: sofreu === sofreuAntes && gol.goleiroId ? gol.goleiroId : goleiroDoTime(sofreu),
      assistenciaId: contra ? undefined : companheiros.some((j) => j.id === assist) ? assist : undefined,
      minuto,
    })
    onFechar()
  }

  return (
    <Sheet open onClose={onFechar} title="Editar gol">
      <span className="label" style={{ marginTop: 0 }}>
        Quem fez
      </span>
      {times.map((t) => (
        <div key={t.id} style={{ marginBottom: 10 }}>
          <div className="item__sub" style={{ margin: '0 0 6px' }}>
            <TeamDot cor={t.cor} size={10} /> {t.nome}
          </div>
          <div className="escolha">
            {jogadoresDosTimes
              .filter((j) => timeDoJogador(j.id!) === t.id)
              .map((j) => (
                <button key={j.id} className={j.id === autor ? 'on' : ''} onClick={() => setAutor(j.id!)}>
                  {j.apelido}
                </button>
              ))}
          </div>
        </div>
      ))}
      <label className="toggle">
        <span>
          Gol contra
          <small>Conta para o adversário e não entra na artilharia</small>
        </span>
        <input type="checkbox" checked={contra} onChange={(e) => setContra(e.target.checked)} />
      </label>
      {!contra && (
        <>
          <span className="label">Assistência</span>
          <div className="escolha">
            <button className={assist === undefined ? 'on' : ''} onClick={() => setAssist(undefined)}>
              Sem assistência
            </button>
            {companheiros.map((j) => (
              <button key={j.id} className={assist === j.id ? 'on' : ''} onClick={() => setAssist(j.id)}>
                {j.apelido}
              </button>
            ))}
          </div>
        </>
      )}
      <span className="label">Minuto</span>
      <Stepper value={minuto} onChange={setMinuto} min={1} max={120} suffix="'" />
      <div className="acoes acoes--2" style={{ marginTop: 20 }}>
        <button
          className="btn btn--danger"
          onClick={() => {
            desfazerGol(ctx, gol.id)
            onFechar()
          }}
        >
          <Icon name="lixo" /> Apagar
        </button>
        <button className="btn btn--sm" onClick={salvar}>
          <Icon name="check" /> Salvar
        </button>
      </div>
    </Sheet>
  )
}
