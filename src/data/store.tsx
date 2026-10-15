import { onAuthStateChanged, type User } from 'firebase/auth'
import { collection, doc, onSnapshot, type DocumentReference, type DocumentSnapshot, type Query, type QuerySnapshot } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Base } from '../domain/stats'
import type { Gol, Id, Jogador, Partida, Presenca, Racha, Time, TimeJogador } from '../domain/types'
import { auth, fs, type Colecao } from './firebase'

export interface Perfil {
  nome: string
  email: string
}

export interface Grupo {
  id: Id
  nome: string
  admins: string[]
  membros: string[]
  perfis: Record<string, Perfil>
}

export interface BaseCompleta extends Base {
  jogadores: Jogador[]
  presencas: Presenca[]
}

/** Contexto das ações: grupo onde gravar + o estado atual para calcular as mudanças. */
export interface Ctx {
  gid: Id
  base: BaseCompleta
}

interface Estado {
  /** undefined enquanto o Firebase Auth ainda não respondeu */
  usuario: User | null | undefined
  /** undefined enquanto carrega; null = usuário sem grupo */
  grupoId: Id | null | undefined
  grupo: Grupo | null | undefined
  base: BaseCompleta | undefined
  /** Problema ao falar com o Firestore antes de saber o grupo do usuário */
  erroBanco: 'sem-resposta' | 'sem-permissao' | null
}

const AppContext = createContext<Estado>({ usuario: undefined, grupoId: undefined, grupo: undefined, base: undefined, erroBanco: null })

/**
 * onSnapshot que se reinscreve após erro. Logo depois de criar ou entrar num
 * grupo, o cache local já tem o grupo mas o servidor ainda não: a primeira
 * escuta é recusada por permissão e, sem isso, nunca mais receberia dados.
 */
function ouvir<T extends DocumentSnapshot | QuerySnapshot>(alvo: DocumentReference | Query, aoReceber: (s: T) => void, aoFalhar?: () => void) {
  let cancelar = () => {}
  let tentativa = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let ativo = true
  const inscrever = () => {
    cancelar = onSnapshot(
      alvo as Query,
      (s) => {
        tentativa = 0
        aoReceber(s as unknown as T)
      },
      () => {
        aoFalhar?.()
        if (!ativo) return
        timer = setTimeout(inscrever, Math.min(15000, 500 * 2 ** tentativa++))
      },
    )
  }
  inscrever()
  return () => {
    ativo = false
    clearTimeout(timer)
    cancelar()
  }
}

const COLECOES: Colecao[] = ['jogadores', 'rachas', 'presencas', 'times', 'timeJogadores', 'partidas', 'gols']

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null | undefined>(undefined)
  const [grupoId, setGrupoId] = useState<Id | null | undefined>(undefined)
  const [grupo, setGrupo] = useState<Grupo | null | undefined>(undefined)
  const [dados, setDados] = useState<Partial<Record<Colecao, unknown[]>>>({})
  const [erroBanco, setErroBanco] = useState<Estado['erroBanco']>(null)

  useEffect(() => onAuthStateChanged(auth, setUsuario), [])

  // Grupo atual do usuário
  useEffect(() => {
    if (!usuario) {
      setGrupoId(usuario === null ? null : undefined)
      return
    }
    setGrupoId(undefined)
    setErroBanco(null)
    // Banco não criado ou sem internet no primeiro acesso: o SDK fica tentando sem
    // avisar. Depois de 10 s a tela explica, e continua esperando a resposta.
    const timer = setTimeout(() => setErroBanco((e) => e ?? 'sem-resposta'), 10_000)
    const cancelar = onSnapshot(
      doc(fs, 'usuarios', usuario.uid),
      (s) => {
        // "Sem grupo" vindo só do cache local não é conclusivo (ex.: servidor inacessível)
        if (!s.exists() && s.metadata.fromCache) return
        clearTimeout(timer)
        setErroBanco(null)
        setGrupoId((s.data()?.grupoId as string | undefined) ?? null)
      },
      (e) => {
        clearTimeout(timer)
        setErroBanco(e.code === 'permission-denied' ? 'sem-permissao' : 'sem-resposta')
      },
    )
    return () => {
      clearTimeout(timer)
      cancelar()
    }
  }, [usuario])

  // Documento do grupo + as 7 coleções, em tempo real (e do cache quando offline)
  useEffect(() => {
    setGrupo(undefined)
    setDados({})
    if (!grupoId) return
    const cancelar = [
      ouvir<DocumentSnapshot>(doc(fs, 'grupos', grupoId), (s) => setGrupo(s.exists() ? ({ perfis: {}, ...s.data(), id: s.id } as Grupo) : null)),
      ...COLECOES.map((c) =>
        ouvir<QuerySnapshot>(collection(fs, 'grupos', grupoId, c), (s) =>
          setDados((d) => ({ ...d, [c]: s.docs.map((x) => ({ ...x.data(), id: x.id })) })),
        ),
      ),
    ]
    return () => cancelar.forEach((f) => f())
  }, [grupoId])

  const base = useMemo<BaseCompleta | undefined>(() => {
    if (COLECOES.some((c) => !dados[c])) return undefined
    return {
      jogadores: dados.jogadores as Jogador[],
      rachas: [...(dados.rachas as Racha[])].sort((a, b) => b.data.localeCompare(a.data)),
      presencas: dados.presencas as Presenca[],
      times: [...(dados.times as Time[])].sort((a, b) => a.ordem - b.ordem),
      timeJogadores: dados.timeJogadores as TimeJogador[],
      partidas: [...(dados.partidas as Partida[])].sort((a, b) => a.ordem - b.ordem),
      gols: dados.gols as Gol[],
    }
  }, [dados])

  return <AppContext.Provider value={{ usuario, grupoId, grupo, base, erroBanco }}>{children}</AppContext.Provider>
}

export function useApp() {
  return useContext(AppContext)
}

/** Base do grupo. As telas só renderizam depois que ela carregou (ver App). */
export function useBase(): BaseCompleta {
  return useContext(AppContext).base!
}

export function useCtx(): Ctx {
  const { grupoId, base } = useContext(AppContext)
  return { gid: grupoId!, base: base! }
}

/** Administrador do grupo edita; os demais só visualizam. */
export function useAdmin(): boolean {
  const { usuario, grupo } = useContext(AppContext)
  return !!usuario && !!grupo?.admins.includes(usuario.uid)
}

export function useRacha(rachaId: Id) {
  const base = useBase()
  return useMemo(() => {
    const racha = base.rachas.find((r) => r.id === rachaId)
    if (!racha) return null
    const presencas = base.presencas.filter((p) => p.rachaId === rachaId)
    const times = base.times.filter((t) => t.rachaId === rachaId)
    const timeIds = new Set(times.map((t) => t.id))
    const partidas = base.partidas.filter((p) => p.rachaId === rachaId)
    const partidaIds = new Set(partidas.map((p) => p.id))
    const presentes = new Set(presencas.map((p) => p.jogadorId))
    return {
      racha,
      presencas,
      times,
      partidas,
      timeJogadores: base.timeJogadores.filter((tj) => timeIds.has(tj.timeId)),
      gols: base.gols.filter((g) => partidaIds.has(g.partidaId)),
      jogadores: new Map(base.jogadores.filter((j) => presentes.has(j.id)).map((j) => [j.id, j])),
    }
  }, [base, rachaId])
}
