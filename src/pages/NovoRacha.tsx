import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { excluirRacha, salvarRacha } from '../data/acoes'
import { useCtx } from '../data/store'
import type { FormatoRacha, Id, Jogador } from '../domain/types'
import { Avatar, Confirmar, Dock, GolBadge, Segmented, Stars, Stepper, Vazio } from '../ui/components'
import { deIso, diaHora, isoLocal } from '../ui/datas'
import { Icon } from '../ui/Icon'

function proximoSabado(): string {
  const d = new Date()
  d.setHours(8, 0, 0, 0)
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7))
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 7)
  return isoLocal(d)
}

function extrairHora(iso: string): string {
  const parts = iso.split('T')
  return parts[1]?.slice(0, 5) ?? '08:00'
}

function calcularHoraFim(horaInicio: string, duracaoMin: number): string {
  const [h, m] = (horaInicio || '08:00').split(':').map(Number)
  const totalMin = (h || 0) * 60 + (m || 0) + duracaoMin
  const finalH = Math.floor(totalMin / 60) % 24
  const finalM = totalMin % 60
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`
}

function calcularDuracaoMin(horaInicio: string, horaFim: string): number {
  const [h1, m1] = (horaInicio || '08:00').split(':').map(Number)
  const [h2, m2] = (horaFim || '09:30').split(':').map(Number)
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
  if (diff <= 0) diff += 24 * 60
  return Math.max(30, diff)
}

const ordenarElenco = (a: Jogador, b: Jogador) => Number(b.goleiro) - Number(a.goleiro) || a.apelido.localeCompare(b.apelido, 'pt-BR')

export default function NovoRacha({ rachaId }: { rachaId?: Id }) {
  const nav = useNavigate()
  const ctx = useCtx()
  const { base } = ctx
  const elenco = useMemo(() => base.jogadores.filter((j) => j.ativo).sort(ordenarElenco), [base.jogadores])
  const anterior = useMemo(() => {
    if (rachaId) {
      return { racha: base.rachas.find((r) => r.id === rachaId), presentes: base.presencas.filter((p) => p.rachaId === rachaId).map((p) => p.jogadorId) }
    }
    return { racha: base.rachas[0], presentes: [] as Id[] }
  }, [base, rachaId])

  const [etapa, setEtapa] = useState<1 | 2 | 3>(1)
  const [data, setData] = useState(proximoSabado)
  const [local, setLocal] = useState('')
  const [horaInicio, setHoraInicio] = useState(() => extrairHora(proximoSabado()))
  const [duracaoRacha, setDuracaoRacha] = useState(90)
  const [horaFim, setHoraFim] = useState(() => calcularHoraFim(extrairHora(proximoSabado()), 90))
  const [linha, setLinha] = useState(5)
  const [qtdTimes, setQtdTimes] = useState(2)
  const [duracaoPartida, setDuracaoPartida] = useState(10)
  const [idaVolta, setIdaVolta] = useState(false)
  const [formato, setFormato] = useState<FormatoRacha>('todos')
  const [golsParaVencer, setGolsParaVencer] = useState(0)
  const [presentes, setPresentes] = useState<Set<Id>>(new Set())
  const [buscaJogador, setBuscaJogador] = useState('')
  const [carregado, setCarregado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  // Preenche com o racha em edição, ou repete o formato do último racha
  useEffect(() => {
    if (!anterior || carregado) return
    const r = anterior.racha
    if (r) {
      if (rachaId) {
        setData(r.data)
        const hIni = extrairHora(r.data)
        setHoraInicio(hIni)
        setHoraFim(calcularHoraFim(hIni, r.duracaoRachaMin))
      }
      setLocal(r.local)
      setLinha(r.jogadoresLinha)
      setQtdTimes(r.qtdTimes)
      setDuracaoRacha(r.duracaoRachaMin)
      setDuracaoPartida(r.duracaoPartidaMin)
      setIdaVolta(r.idaVolta)
      setFormato(r.formato ?? 'todos')
      setGolsParaVencer(r.golsParaVencer ?? 0)
    }
    setPresentes(new Set(anterior.presentes))
    setCarregado(true)
  }, [anterior, carregado, rachaId])

  const locais = useMemo(() => [...new Set(base.rachas.map((r) => r.local))], [base.rachas])
  const vagas = qtdTimes * (linha + 1)
  const confirmados = presentes.size
  const minimo = qtdTimes * 2
  const vencedorFica = formato === 'vencedor_fica'
  const partidas = vencedorFica ? Math.max(1, Math.floor(duracaoRacha / duracaoPartida)) : ((qtdTimes * (qtdTimes - 1)) / 2) * (idaVolta ? 2 : 1)
  const minutosDeJogo = partidas * duracaoPartida
  const goleiros = useMemo(() => elenco.filter((j) => j.goleiro && presentes.has(j.id)).length, [elenco, presentes])

  if (rachaId && anterior.racha && anterior.racha.status !== 'aberto') {
    return (
      <main className="page page--sem-acao">
        <h1>Pelada iniciada</h1>
        <p className="sub">As partidas já começaram; data, formato e presença não podem mais mudar.</p>
        <Dock />
      </main>
    )
  }

  const alternar = (id: Id) => {
    const s = new Set(presentes)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setPresentes(s)
  }

  const aoMudarHoraInicio = (novaHora: string) => {
    setHoraInicio(novaHora)
    const dataPartes = data.split('T')[0]
    setData(`${dataPartes}T${novaHora}`)
    setHoraFim(calcularHoraFim(novaHora, duracaoRacha))
  }

  const aoMudarHoraFim = (novaHoraFim: string) => {
    setHoraFim(novaHoraFim)
    const novaDuracao = calcularDuracaoMin(horaInicio, novaHoraFim)
    setDuracaoRacha(novaDuracao)
  }

  const aoMudarDuracao = (novaDuracao: number) => {
    setDuracaoRacha(novaDuracao)
    setHoraFim(calcularHoraFim(horaInicio, novaDuracao))
  }

  const ano = deIso(data).getFullYear()
  const dataValida = ano >= 2000 && ano <= 2100
  const podeSalvarBasico = local.trim().length > 0 && dataValida && !salvando
  const podeIrSorteio = podeSalvarBasico && confirmados >= minimo

  const salvarEProsseguir = (destino: 'home' | 'sorteio' | 'proxima_etapa') => {
    if (!podeSalvarBasico) return
    setSalvando(true)
    const id = salvarRacha(
      ctx,
      {
        data,
        local: local.trim(),
        jogadoresLinha: linha,
        qtdTimes,
        duracaoRachaMin: duracaoRacha,
        duracaoPartidaMin: duracaoPartida,
        idaVolta: !vencedorFica && idaVolta,
        formato,
        golsParaVencer,
      },
      [...presentes],
      rachaId,
    )
    if (destino === 'home') {
      nav('/', { replace: true })
    } else if (destino === 'sorteio') {
      nav(`/racha/${id}/sorteio`, { replace: !!rachaId })
    } else {
      setSalvando(false)
      setEtapa((e) => (e < 3 ? ((e + 1) as 2 | 3) : 3))
    }
  }

  const cancelar = () => {
    if (!rachaId) return
    excluirRacha(ctx, rachaId)
    nav('/', { replace: true })
  }

  const elencoFiltrado = useMemo(() => {
    if (!buscaJogador.trim()) return elenco
    const termo = buscaJogador.toLowerCase()
    return elenco.filter((j) => j.apelido.toLowerCase().includes(termo) || j.nome?.toLowerCase().includes(termo))
  }, [elenco, buscaJogador])

  return (
    <>
      <main className="page">
        {etapa === 1 ? (
          <button type="button" className="voltar" onClick={() => nav('/')}>
            <Icon name="esquerda" size={18} /> Início
          </button>
        ) : etapa === 2 ? (
          <button type="button" className="voltar" onClick={() => setEtapa(1)}>
            <Icon name="esquerda" size={18} /> Agendamento
          </button>
        ) : (
          <button type="button" className="voltar" onClick={() => setEtapa(2)}>
            <Icon name="esquerda" size={18} /> Regras
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
          <div>
            <h1>{rachaId ? 'Editar pelada' : 'Nova pelada'}</h1>
          </div>
          {rachaId && (
            <button className="link-btn" style={{ color: 'var(--danger)' }} onClick={() => setCancelando(true)}>
              Excluir
            </button>
          )}
        </div>

        {/* Navegação de etapas limpa, sem números e claramente clicável */}
        <nav className="etapas-nav" aria-label="Etapas da pelada">
          <button type="button" className={`etapas-nav__btn${etapa === 1 ? ' on' : ''}`} onClick={() => setEtapa(1)}>
            Agendamento
          </button>
          <button type="button" className={`etapas-nav__btn${etapa === 2 ? ' on' : ''}`} onClick={() => setEtapa(2)}>
            Regras
          </button>
          <button type="button" className={`etapas-nav__btn${etapa === 3 ? ' on' : ''}`} onClick={() => setEtapa(3)}>
            Presença
          </button>
        </nav>

        {/* ETAPA 1: ONDE E QUANDO */}
        {etapa === 1 && (
          <section className="secao" style={{ marginTop: 0 }}>
            <div>
              <label className="label" htmlFor="local">
                Nome da Arena / Local
              </label>
              <input
                id="local"
                className="campo"
                list="locais"
                placeholder="Ex: Arena Soccer Club, Quadra 2..."
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                autoFocus
              />
              <datalist id="locais">{locais.map((l) => <option key={l} value={l} />)}</datalist>
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="label" htmlFor="data-dia">
                Dia da pelada
              </label>
              <div className="campo">
                {dataValida ? diaHora(data) : 'Data inválida'}
                <input
                  id="data-dia"
                  type="datetime-local"
                  value={data}
                  onChange={(e) => {
                    if (e.target.value) {
                      setData(e.target.value)
                      setHoraInicio(extrairHora(e.target.value))
                      setHoraFim(calcularHoraFim(extrairHora(e.target.value), duracaoRacha))
                    }
                  }}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker()
                    } catch {
                      /* nativo */
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-2" style={{ marginTop: 14 }}>
              <div>
                <label className="label" htmlFor="hora-inicio">
                  Horário de Início
                </label>
                <input
                  id="hora-inicio"
                  type="time"
                  className="campo"
                  value={horaInicio}
                  onChange={(e) => aoMudarHoraInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="hora-fim">
                  Horário de Término
                </label>
                <input
                  id="hora-fim"
                  type="time"
                  className="campo"
                  value={horaFim}
                  onChange={(e) => aoMudarHoraFim(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <span className="label">Duração total calculada</span>
              <Stepper value={duracaoRacha} onChange={aoMudarDuracao} min={30} max={360} step={15} suffix="minutos" />
              <p className="hint">
                Das {horaInicio} às {horaFim} ({Math.floor(duracaoRacha / 60)}h{duracaoRacha % 60 ? ` ${duracaoRacha % 60}m` : ''} de quadra).
              </p>
            </div>
          </section>
        )}

        {/* ETAPA 2: REGRAS E FORMATO */}
        {etapa === 2 && (
          <section className="secao" style={{ marginTop: 0 }}>
            <span className="label">Formato das partidas</span>
            <div className="segmented--texto">
              <Segmented
                label="Formato das partidas"
                value={formato}
                onChange={setFormato}
                options={[
                  { value: 'todos', label: 'Todos contra todos' },
                  { value: 'vencedor_fica', label: 'Quem ganha fica' },
                ]}
              />
            </div>
            <p className="hint">
              {vencedorFica
                ? 'Quem ganha fica em quadra e enfrenta o próximo da fila. No empate, você decide facilmente quem entra!'
                : 'Tabela corrida em que todos os times se enfrentam.'}
            </p>

            <div className="form-2" style={{ marginTop: 14 }}>
              <div>
                <span className="label">Times</span>
                <Stepper value={qtdTimes} onChange={setQtdTimes} min={2} max={8} suffix="times" />
              </div>
              <div>
                <span className="label">Linha</span>
                <Stepper value={linha} onChange={setLinha} min={3} max={11} suffix="na linha" />
              </div>
            </div>
            <p className="hint">
              Cada time terá 1 goleiro + {linha} na linha ({linha + 1} jogadores). Total de vagas: {vagas}.
            </p>

            <div className="form-2" style={{ marginTop: 14 }}>
              <div>
                <span className="label">Cada partida</span>
                <Stepper value={duracaoPartida} onChange={setDuracaoPartida} min={3} max={45} suffix="min" />
              </div>
              <div>
                <span className="label">Acaba com</span>
                <div className="segmented" role="radiogroup" aria-label="Gols para encerrar">
                  {[1, 2, 3].map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={golsParaVencer === v}
                      className={golsParaVencer === v ? 'on' : ''}
                      onClick={() => setGolsParaVencer(golsParaVencer === v ? 0 : v)}
                    >
                      {v}g
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="hint">
              {golsParaVencer > 0
                ? `${golsParaVencer} gol${golsParaVencer > 1 ? 's' : ''} ou ${duracaoPartida} min por jogo.`
                : `Apenas tempo (${duracaoPartida} min corridos por jogo). Toque em um valor de gol para ativar limite.`}
            </p>

            {!vencedorFica && (
              <label className="toggle" style={{ marginTop: 12 }}>
                <span>
                  Ida e volta
                  <small>Cada confronto acontece duas vezes</small>
                </span>
                <input type="checkbox" checked={idaVolta} onChange={(e) => setIdaVolta(e.target.checked)} />
              </label>
            )}
            <p className="hint">
              {vencedorFica
                ? `Estimativa: cabem cerca de ${partidas} partidas de até ${duracaoPartida} min nos ${duracaoRacha} min de bola rolando.`
                : `${partidas} partidas × ${duracaoPartida} min = ${minutosDeJogo} min.`}
            </p>
          </section>
        )}

        {/* ETAPA 3: QUEM VEIO (PRESENÇA) */}
        {etapa === 3 && (
          <section className="secao" style={{ marginTop: 0 }}>
            <div className="secao__head">
              <h2>Quem veio</h2>
              <span>
                <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 36, color: 'var(--accent-strong)' }}>
                  {confirmados}
                </span>{' '}
                <span className="eyebrow" style={{ display: 'inline' }}>
                  / {vagas} vagas
                </span>
              </span>
            </div>
            <div className="barra barra--clara">
              <span style={{ width: `${Math.min(100, (confirmados / vagas) * 100)}%` }} />
            </div>
            <div className="topo" style={{ alignItems: 'center', marginTop: 10 }}>
              <p className="hint" style={{ margin: 0 }}>
                {confirmados >= vagas
                  ? `Times completos: ${qtdTimes} de ${linha + 1}${confirmados > vagas ? ` · ${confirmados - vagas} reserva${confirmados - vagas > 1 ? 's' : ''}` : ''}.`
                  : `Faltam ${vagas - confirmados} para completar ${qtdTimes} times.`}
                {goleiros < qtdTimes && confirmados > 0 && ` ${qtdTimes - goleiros} time${qtdTimes - goleiros > 1 ? 's' : ''} sem goleiro fixo.`}
              </p>
              <button
                className="link-btn"
                onClick={() => setPresentes(presentes.size === elenco.length ? new Set() : new Set(elenco.map((j) => j.id)))}
              >
                {presentes.size === elenco.length ? 'Limpar' : 'Todos'}
              </button>
            </div>

            <input
              className="campo"
              style={{ marginTop: 12, marginBottom: 8 }}
              placeholder="Buscar jogador..."
              value={buscaJogador}
              onChange={(e) => setBuscaJogador(e.target.value)}
            />

            {elencoFiltrado.length === 0 ? (
              <Vazio titulo={elenco.length === 0 ? 'Nenhum jogador cadastrado' : 'Nenhum jogador encontrado'}>
                {elenco.length === 0 ? (
                  <Link className="link-btn" to="/jogadores/novo">
                    Adicionar jogador
                  </Link>
                ) : null}
              </Vazio>
            ) : (
              <ul className="lista" style={{ marginTop: 8 }}>
                {elencoFiltrado.map((j) => {
                  const on = presentes.has(j.id)
                  return (
                    <li key={j.id}>
                      <button className="item" onClick={() => alternar(j.id)} role="checkbox" aria-checked={on}>
                        <Avatar jogador={j} />
                        <div className="item__main">
                          <div className="item__titulo">
                            {j.apelido} {j.goleiro && <GolBadge />}
                          </div>
                          {j.nome && <div className="item__sub">{j.nome}</div>}
                        </div>
                        <Stars value={j.estrelas} />
                        <span className={`check${on ? ' on' : ''}`}>
                          <Icon name="check" size={22} strokeWidth={3} />
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* DOCK INFERIOR CONTEXTUAL POR ETAPA */}
      <Dock>
        {etapa === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
            <button className="btn btn--outline" disabled={!podeSalvarBasico} onClick={() => salvarEProsseguir('home')}>
              Salvar
            </button>
            <button className="btn" disabled={!podeSalvarBasico} onClick={() => setEtapa(2)}>
              Regras <Icon name="direita" />
            </button>
          </div>
        )}

        {etapa === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
            <button className="btn btn--outline" disabled={!podeSalvarBasico} onClick={() => salvarEProsseguir('home')}>
              Salvar
            </button>
            <button className="btn" disabled={!podeSalvarBasico} onClick={() => setEtapa(3)}>
              Presença <Icon name="direita" />
            </button>
          </div>
        )}

        {etapa === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
            <button className="btn btn--outline" disabled={!podeSalvarBasico} onClick={() => salvarEProsseguir('home')}>
              Salvar
            </button>
            <button className="btn" disabled={!podeIrSorteio} onClick={() => salvarEProsseguir('sorteio')}>
              <Icon name="sorteio" /> Sortear
            </button>
          </div>
        )}
      </Dock>

      <Confirmar
        aberto={cancelando}
        titulo="Cancelar esta pelada?"
        icone="lixo"
        perigo
        confirmar={<><Icon name="lixo" /> Cancelar</>}
        onConfirmar={cancelar}
        onFechar={() => setCancelando(false)}
      >
        A lista de presença e o sorteio serão apagados.
      </Confirmar>
    </>
  )
}
