import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { salvarJogador } from '../data/acoes'
import { useCtx } from '../data/store'
import type { Id } from '../domain/types'
import { Avatar, Dock, Segmented, Stars, Voltar } from '../ui/components'
import { Icon } from '../ui/Icon'

const NIVEIS = ['', 'Iniciante', 'Regular', 'Bom', 'Craque', 'Fenômeno']

/** Reduz a foto para caber bem no IndexedDB (lado maior de 256 px). */
function reduzirFoto(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const lado = 256
      const escala = Math.min(1, lado / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * escala)
      c.height = Math.round(img.height * escala)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(arquivo)
  })
}

export default function JogadorForm({ jogadorId }: { jogadorId?: Id }) {
  const nav = useNavigate()
  const ctx = useCtx()
  const existente = jogadorId ? ctx.base.jogadores.find((j) => j.id === jogadorId) : undefined
  const [apelido, setApelido] = useState('')
  const [nome, setNome] = useState('')
  const [goleiro, setGoleiro] = useState(false)
  const [estrelas, setEstrelas] = useState(3)
  const [foto, setFoto] = useState<string | undefined>()
  const [ativo, setAtivo] = useState(true)
  const [pronto, setPronto] = useState(!jogadorId)
  const arquivo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!existente || pronto) return
    setApelido(existente.apelido)
    setNome(existente.nome)
    setGoleiro(existente.goleiro)
    setEstrelas(existente.estrelas)
    setFoto(existente.foto)
    setAtivo(existente.ativo)
    setPronto(true)
  }, [existente, pronto])

  if (jogadorId && !pronto) return null

  const salvar = () => {
    const id = salvarJogador(ctx, { id: jogadorId, apelido: apelido.trim(), nome: nome.trim(), goleiro, estrelas, foto, ativo })
    nav(jogadorId ? `/jogadores/${id}` : '/jogadores', { replace: true })
  }

  return (
    <>
      <main className="page page--solo">
        <Voltar label={jogadorId ? 'Perfil' : 'Jogadores'} />
        <h1 style={{ marginTop: 4 }}>{jogadorId ? 'Editar jogador' : 'Novo jogador'}</h1>

        <div className="preview">
          <button type="button" className="foto-btn" onClick={() => arquivo.current?.click()} aria-label="Escolher foto">
            <Avatar jogador={{ apelido: apelido || '?', foto }} size={72} destaque />
            <span className="foto-btn__cam">
              <Icon name="camera" size={16} />
            </span>
          </button>
          <input
            ref={arquivo}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setFoto(await reduzirFoto(f))
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="preview__nome">{apelido || 'Apelido'}</div>
            <div className="item__sub">{goleiro ? 'Goleiro' : 'Linha'}</div>
            <Stars value={estrelas} size={18} />
          </div>
        </div>

        <label className="label" htmlFor="apelido">
          Apelido
        </label>
        <input id="apelido" className="campo" placeholder="Como a galera chama" value={apelido} onChange={(e) => setApelido(e.target.value)} autoComplete="off" />

        <label className="label" htmlFor="nome">
          Nome completo <small>(opcional)</small>
        </label>
        <input id="nome" className="campo" placeholder="Nome e sobrenome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />

        <span className="label">Posição</span>
        <Segmented
          label="Posição"
          value={goleiro ? 'g' : 'l'}
          onChange={(v) => setGoleiro(v === 'g')}
          options={[
            { value: 'l', label: 'Linha' },
            { value: 'g', label: 'Goleiro' },
          ]}
        />

        <div className="topo" style={{ alignItems: 'baseline' }}>
          <span className="label">Nível</span>
          <span className="hint">
            {estrelas} · {NIVEIS[estrelas]}
          </span>
        </div>
        <Stars value={estrelas} size={38} onChange={setEstrelas} />
        <p className="hint">O nível equilibra o sorteio. Goleiro não entra na soma.</p>

        {jogadorId && (
          <label className="toggle" style={{ marginTop: 20 }}>
            <span>
              Ativo
              <small>Inativos somem da lista de presença, mas o histórico fica</small>
            </span>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          </label>
        )}
      </main>
      <Dock nav={false}>
        <button className="btn" disabled={!apelido.trim()} onClick={salvar}>
          <Icon name="check" /> Salvar jogador
        </button>
      </Dock>
    </>
  )
}
