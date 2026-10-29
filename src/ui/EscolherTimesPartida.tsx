import { useEffect, useState } from 'react'
import type { Id, Partida, Time } from '../domain/types'
import { opcoesConfrontoEmpate } from '../domain/vencedorFica'
import { Icon } from './Icon'
import { Sheet, TeamDot } from './components'

interface Props {
  aberto: boolean
  partida: Partida
  times: Time[]
  fila?: Time[]
  ultimoJogoEmpatou?: boolean
  aoIniciar?: boolean
  onConfirmar: (timeAId: Id, timeBId: Id) => void
  onFechar: () => void
}

export function EscolherTimesPartida({
  aberto,
  partida,
  times,
  fila = [],
  ultimoJogoEmpatou = false,
  aoIniciar = false,
  onConfirmar,
  onFechar,
}: Props) {
  const [timeAId, setTimeAId] = useState<Id>(partida.timeAId)
  const [timeBId, setTimeBId] = useState<Id>(partida.timeBId)

  useEffect(() => {
    if (aberto) {
      setTimeAId(partida.timeAId)
      setTimeBId(partida.timeBId)
    }
  }, [aberto, partida.timeAId, partida.timeBId])

  const timePorId = new Map(times.map((t) => [t.id, t]))
  const indice = new Map(times.map((t, i) => [t.id, i]))

  // Sugestões inteligentes para empate
  const sugestoes = (() => {
    if (!ultimoJogoEmpatou || times.length < 3) return []
    const filaIndices = fila.map((t) => indice.get(t.id)).filter((i): i is number => i !== undefined)
    const aIdx = indice.get(partida.timeAId)
    const bIdx = indice.get(partida.timeBId)
    if (aIdx === undefined || bIdx === undefined) return []

    const opts = opcoesConfrontoEmpate(times.length, filaIndices, { a: aIdx, b: bIdx })
    return opts.map((opt) => {
      const tA = times[opt.times[0]]
      const tB = times[opt.times[1]]
      let titulo = ''
      let descricao = ''
      if (opt.tipo === 'dois_fora') {
        titulo = 'Entram os 2 de fora'
        descricao = `${tA.nome} × ${tB.nome} (saem os dois do empate)`
      } else if (opt.tipo === 'fica_a') {
        titulo = `${tA.nome} continua`
        descricao = `Enfrenta ${tB.nome} que estava de fora`
      } else {
        titulo = `${tA.nome} continua`
        descricao = `Enfrenta ${tB.nome} que estava de fora`
      }
      return {
        confronto: [tA.id, tB.id] as [Id, Id],
        titulo,
        descricao,
        timeA: tA,
        timeB: tB,
      }
    })
  })()

  const valido = timeAId && timeBId && timeAId !== timeBId

  const escolherSugestao = (confronto: [Id, Id]) => {
    onConfirmar(confronto[0], confronto[1])
  }

  const salvarManual = () => {
    if (valido) {
      onConfirmar(timeAId, timeBId)
    }
  }

  return (
    <Sheet
      open={aberto}
      onClose={onFechar}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="troca" />
          <span>{ultimoJogoEmpatou ? 'Empate no último jogo' : `Times da Partida ${partida.ordem}`}</span>
        </div>
      }
    >
      {ultimoJogoEmpatou ? (
        <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
          O último jogo terminou empatado. Escolha quem entra em quadra para a <b>Partida {partida.ordem}</b>:
        </p>
      ) : (
        <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
          Escolha os dois times que disputarão a <b>Partida {partida.ordem}</b>:
        </p>
      )}

      {sugestoes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <span className="label" style={{ marginTop: 0 }}>
            Sugestões para o empate
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sugestoes.map((sug, i) => (
              <button
                key={i}
                type="button"
                className="btn btn--outline"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 12,
                  gap: 4,
                  height: 'auto',
                }}
                onClick={() => escolherSugestao(sug.confronto)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}>
                  <b style={{ fontSize: 16, color: 'var(--fg)' }}>{sug.titulo}</b>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TeamDot cor={sug.timeA.cor} size={12} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{sug.timeA.nome}</span>
                    <span style={{ opacity: 0.6 }}>×</span>
                    <TeamDot cor={sug.timeB.cor} size={12} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{sug.timeB.nome}</span>
                  </div>
                </div>
                <small style={{ color: 'var(--muted)', fontSize: 13 }}>{sug.descricao}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="label" style={{ marginTop: sugestoes.length ? 16 : 0 }}>
          {sugestoes.length ? 'Ou selecione livremente' : 'Selecione os times'}
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="item__sub" style={{ display: 'block', marginBottom: 6 }}>
              Time 1
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {times.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn btn--sm ${timeAId === t.id ? '' : 'btn--ghost'}`}
                  style={{ justifyContent: 'flex-start', gap: 8, padding: '8px 10px' }}
                  onClick={() => {
                    setTimeAId(t.id)
                    if (timeBId === t.id) {
                      const outro = times.find((x) => x.id !== t.id)
                      if (outro) setTimeBId(outro.id)
                    }
                  }}
                >
                  <TeamDot cor={t.cor} size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nome}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="item__sub" style={{ display: 'block', marginBottom: 6 }}>
              Time 2
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {times.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn btn--sm ${timeBId === t.id ? '' : 'btn--ghost'}`}
                  disabled={t.id === timeAId}
                  style={{
                    justifyContent: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    opacity: t.id === timeAId ? 0.35 : 1,
                  }}
                  onClick={() => setTimeBId(t.id)}
                >
                  <TeamDot cor={t.cor} size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nome}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal__destaque" style={{ marginBottom: 16 }}>
          <TeamDot cor={timePorId.get(timeAId)?.cor ?? '#888'} />
          <span>{timePorId.get(timeAId)?.nome ?? '–'}</span>
          <span style={{ opacity: 0.6 }}>×</span>
          <span>{timePorId.get(timeBId)?.nome ?? '–'}</span>
          <TeamDot cor={timePorId.get(timeBId)?.cor ?? '#888'} />
        </div>

        <div className="acoes" style={{ marginTop: 8 }}>
          <button className="btn" disabled={!valido} onClick={salvarManual}>
            <Icon name={aoIniciar ? 'play' : 'check'} />
            {aoIniciar ? 'Confirmar e iniciar' : 'Salvar times'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
