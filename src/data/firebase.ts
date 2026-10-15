import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  collection,
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore'

const env = import.meta.env
export const usaEmuladores = env.VITE_FIREBASE_EMULATORS === 'true'
export const configurado = usaEmuladores || (!!env.VITE_FIREBASE_API_KEY && !!env.VITE_FIREBASE_PROJECT_ID)

export const app = initializeApp(
  usaEmuladores
    ? { apiKey: 'demo-key', projectId: 'demo-racha', authDomain: 'localhost', appId: 'demo-app' }
    : {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      },
)

export const auth = getAuth(app)
auth.languageCode = 'pt'

// Cache persistente: o app lê e grava sem sinal e o Firestore sincroniza quando voltar.
export const fs = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})

if (usaEmuladores) {
  const host = location.hostname
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(fs, host, 8080)
}

export type Colecao = 'jogadores' | 'rachas' | 'presencas' | 'times' | 'timeJogadores' | 'partidas' | 'gols'

export function ref(gid: string, colecao: Colecao, id: string): DocumentReference {
  return doc(fs, 'grupos', gid, colecao, id)
}

export function novoId(): string {
  return doc(collection(fs, 'grupos')).id
}

/** Falhas de gravação (ex.: sem permissão) chegam aqui para a interface avisar. */
export const errosDeGravacao = new EventTarget()

function reportar(e: unknown) {
  console.error(e)
  errosDeGravacao.dispatchEvent(new CustomEvent('erro', { detail: e }))
}

/**
 * Lote de gravações. Não espera o servidor: offline, a promessa do commit só
 * resolve quando houver sinal, mas a tela já recebe a mudança na hora pelo
 * cache local. Divide em vários lotes para respeitar o limite de 500 operações.
 */
export class Lote {
  private lotes: WriteBatch[] = [writeBatch(fs)]
  private ops = 0

  private atual(): WriteBatch {
    if (this.ops >= 450) {
      this.lotes.push(writeBatch(fs))
      this.ops = 0
    }
    this.ops++
    return this.lotes.at(-1)!
  }

  set(r: DocumentReference, dados: object) {
    this.atual().set(r, dados)
  }

  update(r: DocumentReference, dados: Record<string, unknown>) {
    this.atual().update(r, dados)
  }

  delete(r: DocumentReference) {
    this.atual().delete(r)
  }

  enviar(): Promise<void> {
    const envio = Promise.all(this.lotes.map((l) => l.commit())).then(() => {})
    envio.catch(reportar)
    return envio
  }
}

/** Remove o campo id antes de gravar (o id é o próprio documento). */
export function semId<T extends { id?: unknown }>(obj: T): Omit<T, 'id'> {
  const { id: _id, ...resto } = obj
  return resto
}
