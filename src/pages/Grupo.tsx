import { useEffect, useState } from 'react'
import { definirAdmin, linkDeConvite, renomearGrupo, sair } from '../data/grupo'
import { importarLocal, resumoLocal } from '../data/legado'
import { useAdmin, useApp } from '../data/store'
import { compartilharTexto, Dock, useToast, Voltar } from '../ui/components'
import { Icon } from '../ui/Icon'

export default function GrupoPage() {
  const { usuario, grupo } = useApp()
  const admin = useAdmin()
  const toast = useToast()
  const [nome, setNome] = useState(grupo?.nome ?? '')
  const [local, setLocal] = useState<{ jogadores: number; rachas: number } | null>(null)
  const [importando, setImportando] = useState(false)

  useEffect(() => {
    if (admin) resumoLocal().then(setLocal)
  }, [admin])

  if (!grupo || !usuario) return null
  const link = linkDeConvite(grupo.id)
  const membros = grupo.membros
    .map((uid) => ({ uid, ...(grupo.perfis[uid] ?? { nome: 'Participante', email: '' }), admin: grupo.admins.includes(uid) }))
    .sort((a, b) => Number(b.admin) - Number(a.admin) || a.nome.localeCompare(b.nome, 'pt-BR'))

  const convidar = () => compartilharTexto(`Entre no grupo "${grupo.nome}" no Racha para acompanhar os jogos: ${link}`)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.mostrar({ texto: 'Link copiado.' })
    } catch {
      toast.mostrar({ texto: link })
    }
  }

  return (
    <>
      <main className="page">
        <Voltar to="/" label="Início" />
        <p className="eyebrow">
          {grupo.membros.length} participante{grupo.membros.length === 1 ? '' : 's'}
        </p>
        <h1>Grupo</h1>

        <label className="label" htmlFor="nome-grupo">
          Nome
        </label>
        {admin ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (nome.trim() && nome.trim() !== grupo.nome) renomearGrupo(grupo.id, nome.trim()).then(() => toast.mostrar({ texto: 'Nome salvo.' }))
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input id="nome-grupo" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
            <button className="icon-btn" style={{ height: 58, width: 58 }} aria-label="Salvar nome" disabled={!nome.trim() || nome.trim() === grupo.nome}>
              <Icon name="check" />
            </button>
          </form>
        ) : (
          <p style={{ fontWeight: 800, fontSize: 20, margin: 0 }}>{grupo.nome}</p>
        )}

        <section className="secao">
          <h2>Convidar</h2>
          <p className="sub" style={{ marginTop: 0 }}>
            Quem entrar pelo link acompanha rachas, placar ao vivo e rankings. Só administradores editam.
          </p>
          <div className="acoes acoes--2">
            <button className="btn btn--sm btn--ghost" onClick={copiar}>
              Copiar link
            </button>
            <button className="btn btn--sm" onClick={convidar}>
              <Icon name="compartilhar" /> Enviar
            </button>
          </div>
        </section>

        <section className="secao">
          <h2>Participantes</h2>
          <ul className="lista lista--junta">
            {membros.map((m) => (
              <li key={m.uid} className="item">
                <div className="item__main">
                  <div className="item__titulo">
                    {m.nome}
                    {m.uid === usuario.uid && <small style={{ fontWeight: 600, color: 'var(--muted)' }}>(você)</small>}
                  </div>
                  <div className="item__sub">{m.admin ? 'Administrador' : 'Participante'}{m.email ? ` · ${m.email}` : ''}</div>
                </div>
                {admin && m.uid !== usuario.uid && (
                  <button className="link-btn" onClick={() => definirAdmin(grupo.id, m.uid, !m.admin)}>
                    {m.admin ? 'Tirar admin' : 'Tornar admin'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {admin && grupo.admins.length === 1 && <p className="hint">Você é o único administrador. Promova alguém para não depender só do seu aparelho.</p>}
        </section>

        {admin && local && (
          <section className="secao">
            <h2>Dados deste aparelho</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              Há {local.jogadores} jogador{local.jogadores === 1 ? '' : 'es'} e {local.rachas} racha{local.rachas === 1 ? '' : 's'} da versão sem login salvos aqui.
            </p>
            <div className="acoes">
              <button
                className="btn btn--ghost"
                disabled={importando}
                onClick={async () => {
                  setImportando(true)
                  await importarLocal(grupo.id)
                  setLocal(null)
                  setImportando(false)
                  toast.mostrar({ texto: 'Dados importados para o grupo.' })
                }}
              >
                {importando ? 'Importando…' : 'Importar para o grupo'}
              </button>
            </div>
          </section>
        )}

        <section className="secao">
          <h2>Conta</h2>
          <p className="sub" style={{ marginTop: 0 }}>
            {usuario.email}
          </p>
          <div className="acoes">
            <button className="btn btn--danger" onClick={sair}>
              Sair da conta
            </button>
          </div>
        </section>
      </main>
      {toast.view}
      <Dock />
    </>
  )
}
