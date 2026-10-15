import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { atualizarGol, desfazerGol, encerrarPartida, iniciarPartida, reabrirPartida, registrarGol } from '../data/acoes'
import { useAgora, useTelaAcesa } from '../data/hooks'
import { useAdmin, useCtx, useRacha } from '../data/store'
import { placar, timeDoGol } from '../domain/stats'
import type { Gol, Id, Jogador, Time } from '../domain/types'
import { Avatar, Dock, Sheet, Stepper, TeamDot, teamStyle, useToast, Voltar } from '../ui/components'
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
  const avisou = useRef(false)

  const partida = dados?.partidas.find((p) => p.id === partidaId)
  const duracaoMs = (dados?.racha.duracaoPartidaMin ?? 0) * 60000
  const bruto = partida?.iniciadaEm ? (partida.encerradaEm ?? agora) - partida.iniciadaEm : 0
  // No minuto configurado o cronômetro para: o tempo exibido nunca passa da duração
  const esgotado = duracaoMs > 0 && bruto >= duracaoMs
  const decorrido = esgotado ? duracaoMs : bruto
  // Só apita se a virada aconteceu agora, com a tela aberta — não ao reabrir uma partida antiga
  const apitarAgora = esgotado && partida?.status === 'em_andamento' && bruto - duracaoMs < 10_000

  useEffect(() => {
    if (apitarAgora && !avisou.current) {
      avisou.current = true
      apitarFim()
      navigator.vibrate?.([400, 150, 400, 150, 900])
    }
  }, [apitarAgora])

  if (!dados || !partida) return null
  const { racha, times, gols, timeJogadores, jogadores, partidas } = dados
  const timeA = times.find((t) => t.id === partida.timeAId)!
  const timeB = times.find((t) => t.id === partida.timeBId)!
  const pl = placar(partida, gols)
  const lances = gols.filter((g) => g.partidaId === partidaId).sort((a, b) => b.criadoEm - a.criadoEm)
  const elenco = (timeId: Id) =>
    timeJogadores
      .filter((tj) => tj.timeId === timeId)
      .sort((a, b) => Number(a.goleiro) - Number(b.goleiro) || (jogadores.get(a.jogadorId)?.apelido ?? '').localeCompare(jogadores.get(b.jogadorId)?.apelido ?? ''))
      .map((tj) => ({ ...jogadores.get(tj.jogadorId)!, goleiroNoJogo: tj.goleiro }))
  const outro = (timeId: Id) => (timeId === timeA.id ? timeB : timeA)
  const timeDoJogador = (jogadorId: Id) => (timeJogadores.find((tj) => tj.jogadorId === jogadorId && (tj.timeId === timeA.id || tj.timeId === timeB.id))?.timeId ?? timeA.id!)
  const minutoAtual = Math.min(Math.floor(decorrido / 60000) + 1, racha.duracaoPartidaMin)
  const aoVivo = partida.status === 'em_andamento'

  const marcar = (beneficiado: Time, autor: Jogador, contra: boolean) => {
    setGolDe(null)
    const id = registrarGol(ctx, {
      partidaId,
      jogadorId: autor.id,
      timeId: contra ? outro(beneficiado.id).id : beneficiado.id,
      contra,
      minuto: partida.iniciadaEm ? minutoAtual : undefined,
    })
    navigator.vibrate?.(60)
    toast.mostrar({
      texto: contra ? `Gol contra de ${autor.apelido}` : `Gol de ${autor.apelido}!`,
      acao: contra ? undefined : { label: '+ Assistência', fn: () => setAssistDe(id) },
    })
  }

  const encerrar = () => {
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
              Partida {partida.ordem} de {partidas.length}
            </span>
            {aoVivo ? <span className="chip chip--live">Ao vivo</span> : <span className="chip">{partida.status === 'encerrada' ? 'Encerrada' : 'Agendada'}</span>}
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
          {esgotado && aoVivo && <div className="placar__fim">Tempo esgotado · encerre a partida</div>}
        </section>

        {!admin ? null : partida.status === 'agendada' ? (
          <div className="acoes">
            <button className="btn" onClick={() => iniciarPartida(ctx, partidaId)}>
              <Icon name="play" /> Começar partida
            </button>
          </div>
        ) : (
          <div className="gol-btns">
            {[timeA, timeB].map((t) => (
              <button key={t.id} className="gol-btn" style={teamStyle(t.cor)} onClick={() => setGolDe(t.id!)} disabled={!aoVivo}>
                <Icon name="bola" size={34} />
                <b>Gol</b>
                <small>{t.nome}</small>
              </button>
            ))}
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
          <button className={`btn${esgotado ? '' : ' btn--outline'}`} onClick={encerrar} disabled={!aoVivo}>
            <Icon name="relogio" /> Encerrar partida
          </button>
        )}
      </Dock>

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
          onFechar={() => setEditando(null)}
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
  onFechar,
}: {
  gol: Gol
  jogadoresDosTimes: JogadorNoJogo[]
  elenco: (timeId: Id) => JogadorNoJogo[]
  timeDoJogador: (jogadorId: Id) => Id
  times: Time[]
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
    atualizarGol(ctx, gol.id, {
      jogadorId: autor,
      timeId: timeAutor,
      contra,
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
