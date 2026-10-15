import { useEffect, useState } from 'react'
import { criarGrupo, sair } from '../data/grupo'
import { importarLocal, resumoLocal } from '../data/legado'
import { useApp } from '../data/store'
import { Icon } from '../ui/Icon'

export default function CriarGrupo() {
  const { usuario, grupo } = useApp()
  const [nome, setNome] = useState('')
  const [local, setLocal] = useState<{ jogadores: number; rachas: number } | null>(null)
  const [importar, setImportar] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    resumoLocal().then(setLocal)
  }, [])

  const criar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario) return
    setSalvando(true)
    setErro('')
    try {
      const gid = await criarGrupo(usuario, nome.trim())
      if (local && importar) await importarLocal(gid)
    } catch {
      setErro('Não foi possível criar o grupo. Verifique a conexão e tente de novo.')
      setSalvando(false)
    }
  }

  return (
    <main className="page page--sem-acao">
      <p className="eyebrow">Olá, {usuario?.displayName?.split(' ')[0] || usuario?.email}</p>
      <h1>Seu grupo</h1>
      {grupo === null && <p className="aviso">Você não faz mais parte do grupo anterior.</p>}
      <p className="sub">Crie o grupo da sua pelada. Você será o administrador: só quem administra edita; quem entra pelo convite acompanha.</p>

      <form onSubmit={criar}>
        <label className="label" htmlFor="nome-grupo">
          Nome do grupo
        </label>
        <input id="nome-grupo" className="campo" placeholder="Ex.: Racha de Sábado" value={nome} onChange={(e) => setNome(e.target.value)} required />
        {local && (
          <label className="toggle">
            <span>
              Trazer dados deste aparelho
              <small>
                {local.jogadores} jogador{local.jogadores === 1 ? '' : 'es'} e {local.rachas} racha{local.rachas === 1 ? '' : 's'} salvos aqui
              </small>
            </span>
            <input type="checkbox" checked={importar} onChange={(e) => setImportar(e.target.checked)} />
          </label>
        )}
        <div className="acoes">
          <button className="btn" disabled={!nome.trim() || salvando}>
            <Icon name="mais" /> {salvando ? 'Criando…' : 'Criar grupo'}
          </button>
        </div>
      </form>

      <section className="secao">
        <h2>Tem um convite?</h2>
        <p className="sub">Abra o link de convite que o administrador do grupo mandou para entrar como participante.</p>
      </section>

      {erro && (
        <p className="aviso" role="alert">
          {erro}
        </p>
      )}
      <div className="acoes">
        <button className="btn btn--ghost" onClick={sair}>
          Sair da conta
        </button>
      </div>
    </main>
  )
}
