import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { rotaDoRacha } from './data/acoes'
import { configurado, errosDeGravacao } from './data/firebase'
import { sair } from './data/grupo'
import { useAdmin, useApp, useBase } from './data/store'
import AoVivo from './pages/AoVivo'
import Classificacao from './pages/Classificacao'
import Convite from './pages/Convite'
import CriarGrupo from './pages/CriarGrupo'
import GrupoPage from './pages/Grupo'
import Inicio from './pages/Inicio'
import JogadorForm from './pages/JogadorForm'
import Jogadores from './pages/Jogadores'
import Jogos from './pages/Jogos'
import Login from './pages/Login'
import NovoRacha from './pages/NovoRacha'
import Perfil from './pages/Perfil'
import Rankings from './pages/Rankings'
import Sorteio from './pages/Sorteio'
import { useToast } from './ui/components'

/** Aba "Racha": leva ao racha em andamento ou à criação de um novo. */
function RachaAtual() {
  const base = useBase()
  const admin = useAdmin()
  const ativo = base.rachas.filter((r) => r.status !== 'encerrado').sort((a, b) => a.data.localeCompare(b.data))[0]
  if (!ativo) return <Navigate to={admin ? '/racha/novo' : '/'} replace />
  return <Navigate to={rotaDoRacha(ativo, base.partidas)} replace />
}

function ComId({ children }: { children: (id: string) => ReactNode }) {
  const { id } = useParams()
  return <>{children(id!)}</>
}

/** Telas de edição: só para o administrador do grupo. */
function SoAdmin({ children }: { children: ReactNode }) {
  return useAdmin() ? <>{children}</> : <Navigate to="/" replace />
}

function Tela({ children }: { children: ReactNode }) {
  return (
    <main className="page page--sem-acao" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', textAlign: 'center' }}>
      <div>{children}</div>
    </main>
  )
}

function Carregando() {
  return (
    <Tela>
      <h1 style={{ fontSize: 40 }}>PeladaFC</h1>
      <p className="sub">Carregando…</p>
    </Tela>
  )
}

function ErroBanco({ tipo }: { tipo: 'sem-resposta' | 'sem-permissao' }) {
  return (
    <Tela>
      <h1>{tipo === 'sem-permissao' ? 'Acesso negado' : 'Sem resposta do banco'}</h1>
      <p className="sub">
        {tipo === 'sem-permissao'
          ? 'O Firestore recusou o acesso. Publique as regras de segurança do app (firestore.rules) no projeto.'
          : 'O Firestore não respondeu. Confira a internet e se o banco foi criado no projeto (Console do Firebase → Firestore Database → Criar banco de dados).'}
      </p>
      <div className="acoes">
        <button className="btn btn--ghost" onClick={() => location.reload()}>
          Tentar de novo
        </button>
        <button className="btn btn--ghost" onClick={() => sair()}>
          Sair da conta
        </button>
      </div>
    </Tela>
  )
}

function SemConfiguracao() {
  return (
    <Tela>
      <h1>Falta configurar</h1>
      <p className="sub">
        Crie o arquivo <code>.env.local</code> com as chaves do Firebase (veja <code>.env.example</code>) e reinicie o servidor.
      </p>
    </Tela>
  )
}

export default function App() {
  const { usuario, grupoId, grupo, base, erroBanco } = useApp()
  const toast = useToast()
  const mostrar = toast.mostrar

  useEffect(() => {
    const aviso = (e: Event) => {
      const codigo = (e as CustomEvent).detail?.code
      mostrar({ texto: codigo === 'permission-denied' ? 'Só o administrador pode alterar.' : 'Não foi possível salvar. Tente de novo.' })
    }
    errosDeGravacao.addEventListener('erro', aviso)
    return () => errosDeGravacao.removeEventListener('erro', aviso)
  }, [mostrar])

  let conteudo: ReactNode
  if (!configurado) conteudo = <SemConfiguracao />
  else if (usuario === undefined) conteudo = <Carregando />
  else if (usuario === null) conteudo = <Login />
  else if (grupoId === undefined) conteudo = erroBanco ? <ErroBanco tipo={erroBanco} /> : <Carregando />
  else if (grupoId === null || grupo === null)
    conteudo = (
      <Routes>
        <Route path="/convite/:gid" element={<Convite />} />
        <Route path="*" element={<CriarGrupo />} />
      </Routes>
    )
  else if (grupo === undefined || !base) conteudo = <Carregando />
  else
    conteudo = (
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/convite/:gid" element={<Convite />} />
        <Route path="/grupo" element={<GrupoPage />} />
        <Route path="/racha" element={<RachaAtual />} />
        <Route path="/racha/novo" element={<SoAdmin><NovoRacha /></SoAdmin>} />
        <Route path="/racha/:id/editar" element={<SoAdmin><ComId>{(id) => <NovoRacha key={id} rachaId={id} />}</ComId></SoAdmin>} />
        <Route path="/racha/:id/sorteio" element={<ComId>{(id) => <Sorteio key={id} rachaId={id} />}</ComId>} />
        <Route path="/racha/:id/jogos" element={<ComId>{(id) => <Jogos key={id} rachaId={id} />}</ComId>} />
        <Route path="/racha/:id/partida/:pid" element={<AoVivo />} />
        <Route path="/racha/:id/classificacao" element={<ComId>{(id) => <Classificacao key={id} rachaId={id} />}</ComId>} />
        <Route path="/jogadores" element={<Jogadores />} />
        <Route path="/jogadores/novo" element={<SoAdmin><JogadorForm /></SoAdmin>} />
        <Route path="/jogadores/:id" element={<ComId>{(id) => <Perfil key={id} jogadorId={id} />}</ComId>} />
        <Route path="/jogadores/:id/editar" element={<SoAdmin><ComId>{(id) => <JogadorForm key={id} jogadorId={id} />}</ComId></SoAdmin>} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )

  return (
    <div className="app">
      {conteudo}
      {toast.view}
    </div>
  )
}
