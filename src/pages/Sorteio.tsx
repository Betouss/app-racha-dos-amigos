import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alternarTravado, confirmarTimes, definirGoleiro, moverParaTime, reabrirSorteio, sortear, trocar, type Posicao } from '../data/acoes'
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
  const primeiro = useRef(false)

  // Racha aberto ainda sem times: faz o primeiro sorteio
  const precisaSortear = admin && !!dados && dados.racha.status === 'aberto' && dados.times.length === 0 && dados.presencas.length > 0
  useEffect(() => {
    if (!precisaSortear || primeiro.current) return
    primeiro.current = true
    sortear(ctx, rachaId)
  }, [precisaSortear, rachaId, ctx])

  if (dados === undefined) return null
  if (dados === null) return <main className="page">Racha não encontrado.</main>
  const { racha, times, timeJogadores, presencas, jogadores, partidas } = dados
  const editavel = admin && racha.status === 'aberto'
  const comecou = partidas.some((p) => p.status !== 'agendada')
  const porTime = new Map(times.map((t) => [t.id!, timeJogadores.filter((tj) => tj.timeId === t.id)]))
  const reservas = presencas.filter((p) => p.reserva).map((p) => p.jogadorId)
  const tamanho = racha.jogadoresLinha + 1

  const tocar = (p: Posicao) => {
    if (!admin) return
    if (!sel) return setSel(p)
    if (sel.jogadorId === p.jogadorId) return setSel(null)
    if (editavel && sel.timeId !== p.timeId) {
      trocar(ctx, rachaId, sel, p)
      return setSel(null)
    }
    setSel(p)
  }

  const resortear = () => {
    setSorteando(true)
    setSel(null)
    sortear(ctx, rachaId)
    setTimeout(() => setSorteando(false), 300)
  }

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
        <p className="eyebrow">Passo 2 de 3</p>
        <h1>Sorteio</h1>
        <p className="sub">
          {editavel
            ? 'Trave quem não pode mudar de time e sorteie de novo. Toque em dois jogadores para trocá-los.'
            : admin
              ? 'Times confirmados. Toque em um jogador para colocá-lo no gol.'
              : racha.status === 'aberto'
                ? 'Sorteio em andamento. Os times podem mudar até o administrador confirmar.'
                : 'Times confirmados.'}
        </p>

        {sel && selecionado && (
          <div className="aviso" style={{ position: 'sticky', top: 8, zIndex: 5 }}>
            <strong>{selecionado.apelido}</strong> selecionado.{' '}
            {editavel && (sel.timeId === null ? 'Toque em um jogador de time para trocar, ou em “Colocar aqui”.' : 'Toque em outro jogador para trocar.')}
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

        <div className={`times${times.length === 1 ? ' times--1' : ''}`}>
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
                      {editavel && sel?.timeId === null && (
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
                    disabled={!editavel}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10 }}>
            <button className="btn btn--outline" style={{ fontSize: 17, gap: 8 }} onClick={resortear} disabled={sorteando} aria-label="Sortear de novo">
              <Icon name="sorteio" /> De novo
            </button>
            <button className="btn" style={{ fontSize: 19, gap: 8 }} onClick={confirmar} disabled={times.length < 2}>
              <Icon name="check" /> Confirmar
            </button>
          </div>
        ) : racha.status !== 'aberto' ? (
          <button className="btn" onClick={() => nav(`/racha/${rachaId}/jogos`)}>
            Ver jogos
          </button>
        ) : null}
      </Dock>
    </>
  )
}
