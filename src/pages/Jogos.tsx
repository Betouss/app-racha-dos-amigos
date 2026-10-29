import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adicionarRodada, editarTimesPartida, encerrarRacha, iniciarPartida } from '../data/acoes'
import { useAdmin, useCtx, useRacha } from '../data/store'
import type { Id, Partida } from '../domain/types'
import { somaEstrelas } from '../domain/sorteio'
import { placar } from '../domain/stats'
import { vencedorFica } from '../domain/vencedorFica'
import { compartilharTexto, Confirmar, Dock, TeamDot, TeamName } from '../ui/components'
import { EscolherTimesPartida } from '../ui/EscolherTimesPartida'
import { diaCurto } from '../ui/datas'
import { Icon } from '../ui/Icon'

const STATUS = { agendada: 'Agendada', em_andamento: 'Ao vivo', encerrada: 'Encerrada' } as const

export default function Jogos({ rachaId }: { rachaId: Id }) {
  const dados = useRacha(rachaId)
  const ctx = useCtx()
  const admin = useAdmin()
  const nav = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [partidaParaEscolher, setPartidaParaEscolher] = useState<Partida | null>(null)
  const [iniciarAposEscolha, setIniciarAposEscolha] = useState(false)
  if (dados === undefined) return null
  if (dados === null) return <main className="page">Pelada não encontrada.</main>
  const { racha, times, partidas, gols, timeJogadores, jogadores } = dados
  // Logo após confirmar os times o status pode ainda não ter chegado do cache: não redireciona
  if (racha.status === 'aberto' && partidas.length === 0)
    return (
      <main className="page page--sem-acao">
        <p className="eyebrow">Passo 3 de 3</p>
        <h1>Jogos</h1>
        <p className="sub">Os times ainda não foram confirmados.</p>
        <div className="acoes">
          <Link className="btn btn--ghost" to={`/racha/${rachaId}/sorteio`}>
            Ver sorteio
          </Link>
        </div>
        <Dock />
      </main>
    )

  const timePorId = new Map(times.map((t) => [t.id!, t]))
  const jogadas = partidas.filter((p) => p.status === 'encerrada')
  const aoVivo = partidas.find((p) => p.status === 'em_andamento')
  const proxima = aoVivo ?? partidas.find((p) => p.status === 'agendada')
  const golsAteAgora = jogadas.reduce((s, p) => {
    const pl = placar(p, gols)
    return s + pl.a + pl.b
  }, 0)
  const encerrado = racha.status === 'encerrado'
  const ehVencedorFica = racha.formato === 'vencedor_fica'
  // Fila de quem está de fora (quem ganha fica), a partir dos resultados até aqui
  const fila = (() => {
    if (!ehVencedorFica) return []
    const indice = new Map(times.map((t, i) => [t.id, i]))
    const jogos = [...jogadas, ...(aoVivo ? [aoVivo] : [])].map((p) => {
      const pl = placar(p, gols)
      const a = indice.get(p.timeAId)!
      const b = indice.get(p.timeBId)!
      return { a, b, vencedor: pl.a > pl.b ? a : pl.b > pl.a ? b : null }
    })
    // Com partida ao vivo, a fila mostrada é a de agora (sem contar o resultado parcial)
    return vencedorFica(times.length, aoVivo ? jogos.slice(0, -1) : jogos).fila.map((i) => times[i])
  })()

  const ultimaEncerrada = jogadas.length > 0 ? jogadas[jogadas.length - 1] : undefined
  const ultimoEmpatou = (() => {
    if (!ultimaEncerrada) return false
    const pl = placar(ultimaEncerrada, gols)
    return pl.a === pl.b
  })()

  const abrir = (partidaId: Id) => {
    const p = partidas.find((x) => x.id === partidaId)
    if (!p) return
    if (admin && p.status === 'agendada' && ultimoEmpatou) {
      setPartidaParaEscolher(p)
      setIniciarAposEscolha(true)
      return
    }
    if (admin && p.status === 'agendada') {
      iniciarPartida(ctx, partidaId)
    }
    nav(`/racha/${rachaId}/partida/${partidaId}`)
  }

  const confirmarEscolhaTimes = (timeAId: Id, timeBId: Id) => {
    if (!partidaParaEscolher) return
    const pid = partidaParaEscolher.id
    if (iniciarAposEscolha) {
      iniciarPartida(ctx, pid, { timeAId, timeBId })
      setPartidaParaEscolher(null)
      nav(`/racha/${rachaId}/partida/${pid}`)
    } else {
      editarTimesPartida(ctx, pid, timeAId, timeBId)
      setPartidaParaEscolher(null)
    }
  }

  // No quem ganha fica a próxima partida é só a sequência natural: não conta como descartada
  const naoJogadas = ehVencedorFica ? 0 : partidas.filter((p) => p.status === 'agendada').length
  const plural = naoJogadas > 1 ? 's' : ''
  const encerrar = () => {
    setConfirmando(false)
    encerrarRacha(ctx, rachaId)
    nav(`/racha/${rachaId}/classificacao`)
  }

  const compartilharTimes = () => {
    const linhas = times.map((t) => {
      const elenco = timeJogadores.filter((tj) => tj.timeId === t.id)
      const gk = elenco.find((tj) => tj.goleiro)
      const soma = somaEstrelas({ jogadores: elenco.map((tj) => tj.jogadorId), goleiroId: gk?.jogadorId ?? null }, jogadores)
      const nomes = elenco
        .filter((tj) => !tj.goleiro)
        .map((tj) => jogadores.get(tj.jogadorId)?.apelido)
        .join(', ')
      return `*${t.nome}* (${soma}★)\n🧤 ${gk ? jogadores.get(gk.jogadorId)?.apelido : '—'}\n${nomes}`
    })
    const ordem = partidas.map((p) => `${p.ordem}. ${timePorId.get(p.timeAId)?.nome} × ${timePorId.get(p.timeBId)?.nome}`)
    compartilharTexto(`⚽ Pelada ${diaCurto(racha.data)} — ${racha.local}\n\n${linhas.join('\n\n')}\n\n*Jogos*\n${ordem.join('\n')}`)
  }

  return (
    <>
      <main className="page">
        <div className="topo">
          <div>
            <p className="eyebrow">Passo 3 de 3</p>
            <h1>Jogos</h1>
          </div>
          <button className="icon-btn" onClick={compartilharTimes} aria-label="Compartilhar times e jogos">
            <Icon name="compartilhar" />
          </button>
        </div>
        <p className="sub">
          {diaCurto(racha.data)} · {times.length} times · {ehVencedorFica ? 'quem ganha fica' : `${partidas.length} partidas`}
          {racha.golsParaVencer ? ` · ${racha.golsParaVencer} gol${racha.golsParaVencer > 1 ? 's' : ''} ou ${racha.duracaoPartidaMin} min` : ''}
        </p>

        {proxima && !encerrado && (
          <button
            className="pitch"
            style={{ marginTop: 20, width: '100%', border: 0, textAlign: 'left' }}
            onClick={() => (admin || aoVivo ? abrir(proxima.id) : undefined)}
          >
            <div className="pitch__eyebrow">
              {aoVivo ? 'Ao vivo' : 'Próxima'} · Partida {proxima.ordem}
              {ehVencedorFica ? '' : ` de ${partidas.length}`}
            </div>
            <div className="confronto">
              <TeamDot cor={timePorId.get(proxima.timeAId)!.cor} size={22} /> {timePorId.get(proxima.timeAId)?.nome}
              <span style={{ opacity: 0.8 }}>×</span>
              <TeamDot cor={timePorId.get(proxima.timeBId)!.cor} size={22} /> {timePorId.get(proxima.timeBId)?.nome}
            </div>
            {ehVencedorFica ? (
              fila.length > 0 && (
                <div style={{ fontSize: 14, margin: '10px 0 4px' }}>
                  De fora: {fila.map((t) => t.nome).join(' → ')}
                </div>
              )
            ) : (
              <div className="progresso">
                {partidas.map((p) => (
                  <span key={p.id} className={p.status === 'encerrada' ? 'feita' : p.id === proxima.id ? 'atual' : ''} />
                ))}
              </div>
            )}
            <div style={{ fontSize: 14 }}>
              {jogadas.length} jogada{jogadas.length === 1 ? '' : 's'} · {golsAteAgora} gol{golsAteAgora === 1 ? '' : 's'} até agora
            </div>
            {admin && proxima.status === 'agendada' && (
              <div style={{ marginTop: 8 }}>
                <span
                  role="button"
                  tabIndex={0}
                  className="link-btn"
                  style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPartidaParaEscolher(proxima)
                    setIniciarAposEscolha(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      setPartidaParaEscolher(proxima)
                      setIniciarAposEscolha(false)
                    }
                  }}
                >
                  <Icon name="troca" size={14} /> Alterar times
                </span>
              </div>
            )}
          </button>
        )}

        <section className="secao">
          <h2>Ordem das partidas</h2>
          <ul className="lista">
            {partidas.map((p) => {
              const pl = placar(p, gols)
              const jogou = p.status !== 'agendada'
              return (
                <li key={p.id}>
                  <button
                    className="partida"
                    onClick={() => (p.status === 'agendada' ? admin && !encerrado && !aoVivo && abrir(p.id) : nav(`/racha/${rachaId}/partida/${p.id}`))}
                  >
                    <span className="partida__ordem">{p.ordem}</span>
                    <span className="partida__times">
                      <TeamName time={timePorId.get(p.timeAId)} />
                      <TeamName time={timePorId.get(p.timeBId)} />
                    </span>
                    <span className="partida__placar">
                      <span>{jogou ? pl.a : '–'}</span>
                      <span>{jogou ? pl.b : '–'}</span>
                    </span>
                    <span className={`status status--${p.status === 'em_andamento' ? 'ao-vivo' : p.status}`}>{STATUS[p.status]}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {admin && !encerrado && !ehVencedorFica && (
            <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => adicionarRodada(ctx, rachaId)}>
              <Icon name="mais" /> Mais uma rodada
            </button>
          )}
        </section>

        <section className="secao">
          <h2>Mais opções</h2>
          <div className={`acoes${encerrado ? '' : ' acoes--2'}`} style={{ marginTop: 0 }}>
            <button className="btn btn--ghost" style={{ fontSize: 15 }} onClick={() => nav(`/racha/${rachaId}/classificacao`)}>
              <Icon name="podio" /> Classificação
            </button>
            {!encerrado && (
              <button className="btn btn--ghost" style={{ fontSize: 15 }} onClick={() => nav(`/racha/${rachaId}/sorteio`)}>
                <Icon name="users" /> {admin && (jogadas.length || aoVivo) ? 'Alterar times' : 'Ver times'}
              </button>
            )}
          </div>
        </section>
      </main>
      <Dock>
        {encerrado ? (
          <button className="btn" onClick={() => nav(`/racha/${rachaId}/classificacao`)}>
            <Icon name="trofeu" /> Ver classificação
          </button>
        ) : !admin ? (
          aoVivo ? (
            <button className="btn" onClick={() => abrir(aoVivo.id)}>
              <Icon name="relogio" /> Acompanhar partida {aoVivo.ordem}
            </button>
          ) : null
        ) : proxima ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 10 }}>
            <button className="btn btn--outline" style={{ fontSize: 16 }} onClick={() => setConfirmando(true)}>
              <Icon name="bandeira" /> Encerrar
            </button>
            <button className="btn" style={{ fontSize: 19, gap: 8 }} onClick={() => abrir(proxima.id)}>
              <Icon name="relogio" /> {aoVivo ? 'Voltar ao jogo' : `Iniciar partida ${proxima.ordem}`}
            </button>
          </div>
        ) : (
          <button className="btn" onClick={() => setConfirmando(true)}>
            <Icon name="trofeu" /> Encerrar pelada
          </button>
        )}
      </Dock>

      <Confirmar
        aberto={confirmando}
        titulo="Encerrar a pelada agora?"
        icone={naoJogadas > 0 ? 'bandeira' : 'trofeu'}
        perigo={naoJogadas > 0}
        confirmar={<><Icon name="bandeira" /> Encerrar</>}
        onConfirmar={encerrar}
        onFechar={() => setConfirmando(false)}
      >
        {naoJogadas > 0 ? (
          <>
            <strong>
              {naoJogadas} partida{plural} não jogada{plural}
            </strong>{' '}
            ser{naoJogadas > 1 ? 'ão' : 'á'} descartada{plural}.
          </>
        ) : (
          'Todas as partidas foram jogadas. A classificação final será fechada.'
        )}
        {aoVivo && <> A partida {aoVivo.ordem}, que está ao vivo, termina com o placar atual.</>}
      </Confirmar>

      {partidaParaEscolher && (
        <EscolherTimesPartida
          aberto={true}
          partida={partidaParaEscolher}
          times={times}
          fila={fila}
          ultimoJogoEmpatou={ultimoEmpatou && partidaParaEscolher.ordem === (ultimaEncerrada ? ultimaEncerrada.ordem + 1 : 1)}
          aoIniciar={iniciarAposEscolha}
          onConfirmar={confirmarEscolhaTimes}
          onFechar={() => setPartidaParaEscolher(null)}
        />
      )}
    </>
  )
}

