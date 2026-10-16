import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { aceitarConvite, lerConvite } from '../data/grupo'
import { useApp } from '../data/store'
import { Icon } from '../ui/Icon'

export default function Convite() {
  const { gid } = useParams()
  const { usuario, grupoId } = useApp()
  const nav = useNavigate()
  const [grupo, setGrupo] = useState<{ nome: string; membros: string[] } | null | undefined>(undefined)
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (gid) lerConvite(gid).then(setGrupo).catch(() => setGrupo(null))
  }, [gid])

  if (!gid) return <Navigate to="/" replace />
  if (grupoId === gid) return <Navigate to="/" replace />

  const aceitar = async () => {
    if (!usuario) return
    setEntrando(true)
    try {
      await aceitarConvite(usuario, gid)
      nav('/', { replace: true })
    } catch {
      setErro('Não foi possível entrar no grupo. Verifique a conexão e tente de novo.')
      setEntrando(false)
    }
  }

  return (
    <main className="page page--sem-acao">
      <p className="eyebrow">Convite</p>
      {grupo === undefined ? (
        <p className="sub">Carregando…</p>
      ) : grupo === null ? (
        <>
          <h1>Convite inválido</h1>
          <p className="sub">Este grupo não existe mais ou o link está incompleto. Peça um novo link ao administrador.</p>
        </>
      ) : (
        <>
          <h1>{grupo.nome}</h1>
          <p className="sub">
            {grupo.membros.length} participante{grupo.membros.length === 1 ? '' : 's'}. Você vai acompanhar as peladas, o placar ao vivo e os rankings. Só o
            administrador edita.
          </p>
          {grupoId && <p className="aviso">Você vai sair do grupo atual neste aparelho e passar a ver este.</p>}
          <div className="acoes">
            <button className="btn" onClick={aceitar} disabled={entrando}>
              <Icon name="check" /> {entrando ? 'Entrando…' : 'Entrar no grupo'}
            </button>
          </div>
        </>
      )}
      {erro && (
        <p className="aviso" role="alert">
          {erro}
        </p>
      )}
    </main>
  )
}
