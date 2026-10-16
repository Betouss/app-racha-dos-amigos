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
    return { racha: base.rachas[0], presentes: [] as Id[] } // rachas vêm do mais recente para o mais antigo
  }, [base, rachaId])

  const [data, setData] = useState(proximoSabado)
  const [local, setLocal] = useState('')
  const [linha, setLinha] = useState(5)
  const [qtdTimes, setQtdTimes] = useState(2)
  const [duracaoRacha, setDuracaoRacha] = useState(90)
  const [duracaoPartida, setDuracaoPartida] = useState(10)
  const [idaVolta, setIdaVolta] = useState(false)
  const [formato, setFormato] = useState<FormatoRacha>('todos')
  const [golsParaVencer, setGolsParaVencer] = useState(0)
  const [presentes, setPresentes] = useState<Set<Id>>(new Set())
  const [carregado, setCarregado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  // Preenche com o racha em edição, ou repete o formato do último racha
  useEffect(() => {
    if (!anterior || carregado) return
    const r = anterior.racha
    if (r) {
      if (rachaId) setData(r.data)
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
  // Quem ganha fica não tem tabela fechada: estima quantas partidas cabem no tempo da pelada
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

  const ano = deIso(data).getFullYear()
  const dataValida = ano >= 2000 && ano <= 2100
  const podeSeguir = local.trim().length > 0 && confirmados >= minimo && dataValida && !salvando

  // O sorteio é feito pela tela de sorteio quando o racha ainda não tem times
  const seguir = () => {
    setSalvando(true)
    const id = salvarRacha(
      ctx,
      { data, local: local.trim(), jogadoresLinha: linha, qtdTimes, duracaoRachaMin: duracaoRacha, duracaoPartidaMin: duracaoPartida, idaVolta: !vencedorFica && idaVolta, formato, golsParaVencer },
      [...presentes],
      rachaId,
    )
    nav(`/racha/${id}/sorteio`, { replace: !!rachaId })
  }

  const cancelar = () => {
    if (!rachaId) return
    excluirRacha(ctx, rachaId)
    nav('/', { replace: true })
  }

  return (
    <>
      <main className="page">
        <p className="eyebrow">Passo 1 de 3</p>
        <h1>{rachaId ? 'Editar pelada' : 'Nova pelada'}</h1>

        <div className="form-2">
          <div>
            <label className="label" htmlFor="data">
              Data
            </label>
            <div className="campo">
              {dataValida ? diaHora(data) : 'Data inválida'}
              <input
                id="data"
                type="datetime-local"
                value={data}
                onChange={(e) => e.target.value && setData(e.target.value)}
                // No desktop o clique não abre o calendário de um input invisível; abre explicitamente
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker()
                  } catch {
                    /* navegador sem showPicker: segue o comportamento nativo */
                  }
                }}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="local">
              Local
            </label>
            <input id="local" className="campo" list="locais" placeholder="Onde?" value={local} onChange={(e) => setLocal(e.target.value)} />
            <datalist id="locais">{locais.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
        </div>

        <span className="label">Jogadores na linha</span>
        <Segmented
          label="Jogadores na linha"
          value={Math.min(linha, 7)}
          onChange={(v) => setLinha(v === 7 ? Math.max(7, linha) : v)}
          options={[4, 5, 6, 7].map((v) => ({ value: v, label: v === 7 ? '7+' : v }))}
        />
        {linha >= 7 && <Stepper value={linha} onChange={setLinha} min={7} max={11} suffix="na linha" />}

        <span className="label">Times</span>
        <Segmented
          label="Número de times"
          value={Math.min(qtdTimes, 5)}
          onChange={(v) => setQtdTimes(v === 5 ? Math.max(5, qtdTimes) : v)}
          options={[2, 3, 4, 5].map((v) => ({ value: v, label: v === 5 ? '5+' : v }))}
        />
        {qtdTimes >= 5 && <Stepper value={qtdTimes} onChange={setQtdTimes} min={5} max={8} suffix="times" />}
        <p className="hint">
          Cada time: 1 goleiro + {linha} na linha = {linha + 1} jogadores.
        </p>

        <div className="form-2">
          <div>
            <span className="label">Duração da pelada</span>
            <Stepper value={duracaoRacha} onChange={setDuracaoRacha} min={60} max={300} step={15} suffix="min" />
          </div>
          <div>
            <span className="label">Cada partida</span>
            <Stepper value={duracaoPartida} onChange={setDuracaoPartida} min={3} max={45} suffix="min" />
          </div>
        </div>

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
            ? 'O vencedor continua e enfrenta o time de fora; quem perde vai para o fim da fila. No empate sai quem está há mais tempo em quadra.'
            : 'Tabela pronta em que todos os times se enfrentam.'}
        </p>

        <span className="label">Partida acaba com</span>
        <div className="segmented--texto">
          <Segmented
            label="Gols para encerrar a partida"
            value={golsParaVencer}
            onChange={setGolsParaVencer}
            options={[0, 1, 2, 3, 4].map((v) => ({ value: v, label: v === 0 ? 'Só o tempo' : `${v} gol${v > 1 ? 's' : ''}` }))}
          />
        </div>
        <p className="hint">
          {golsParaVencer > 0
            ? `${golsParaVencer} gol${golsParaVencer > 1 ? 's' : ''} ou ${duracaoPartida} minutos, o que vier primeiro.`
            : `A partida dura ${duracaoPartida} minutos.`}
        </p>

        {!vencedorFica && (
          <label className="toggle">
            <span>
              Ida e volta
              <small>Cada confronto acontece duas vezes</small>
            </span>
            <input type="checkbox" checked={idaVolta} onChange={(e) => setIdaVolta(e.target.checked)} />
          </label>
        )}
        <p className="hint">
          {vencedorFica
            ? `Cabem cerca de ${partidas} partida${partidas === 1 ? '' : 's'} de até ${duracaoPartida} min nos ${duracaoRacha} min da pelada.`
            : `${partidas} ${partidas === 1 ? 'partida' : 'partidas'} × ${duracaoPartida} min = ${minutosDeJogo} min de bola rolando${minutosDeJogo > duracaoRacha ? ` — passa dos ${duracaoRacha} min da pelada.` : '.'}`}
        </p>

        <section className="secao">
          <div className="secao__head">
            <h2>Quem veio</h2>
            <span>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 40, color: 'var(--accent-strong)' }}>{confirmados}</span>{' '}
              <span className="eyebrow" style={{ display: 'inline' }}>
                confirmados
              </span>
            </span>
          </div>
          <div className="barra barra--clara">
            <span style={{ width: `${Math.min(100, (confirmados / vagas) * 100)}%` }} />
          </div>
          <div className="topo" style={{ alignItems: 'center' }}>
            <p className="hint" style={{ margin: 0 }}>
              {confirmados >= vagas
                ? `Times completos: ${qtdTimes} de ${linha + 1}${confirmados > vagas ? ` · ${confirmados - vagas} reserva${confirmados - vagas > 1 ? 's' : ''}` : ''}.`
                : `Faltam ${vagas - confirmados} para ${qtdTimes} times de ${linha + 1}.`}
              {goleiros < qtdTimes && confirmados > 0 && ` ${qtdTimes - goleiros} time${qtdTimes - goleiros > 1 ? 's' : ''} sem goleiro fixo.`}
            </p>
            <button
              className="link-btn"
              onClick={() => setPresentes(presentes.size === elenco.length ? new Set() : new Set(elenco.map((j) => j.id)))}
            >
              {presentes.size === elenco.length ? 'Limpar' : 'Todos'}
            </button>
          </div>

          {elenco.length === 0 ? (
            <Vazio titulo="Nenhum jogador cadastrado">
              <Link className="link-btn" to="/jogadores/novo">
                Adicionar jogador
              </Link>
            </Vazio>
          ) : (
            <ul className="lista" style={{ marginTop: 12 }}>
              {elenco.map((j) => {
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
          {rachaId && (
            <div className="acoes">
              <button className="btn btn--danger" onClick={() => setCancelando(true)}>
                Cancelar pelada
              </button>
            </div>
          )}
        </section>
      </main>
      <Dock>
        <button className="btn" disabled={!podeSeguir} onClick={seguir}>
          <Icon name="sorteio" /> Ir para o sorteio
        </button>
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
