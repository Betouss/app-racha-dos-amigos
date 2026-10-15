import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { arrayRemove, arrayUnion, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { auth, fs, novoId } from './firebase'
import type { Grupo, Perfil } from './store'

const CHAVE_EMAIL = 'racha:email-login'

function perfilDe(u: User): Perfil {
  return { nome: u.displayName || u.email?.split('@')[0] || 'Sem nome', email: u.email ?? '' }
}

export async function entrarComGoogle() {
  await signInWithPopup(auth, new GoogleAuthProvider())
}

export async function enviarLinkPorEmail(email: string) {
  await sendSignInLinkToEmail(auth, email, { url: `${location.origin}${location.pathname}`, handleCodeInApp: true })
  try {
    localStorage.setItem(CHAVE_EMAIL, email)
  } catch {
    /* sem armazenamento: o e-mail será pedido de novo ao abrir o link */
  }
}

export function ehLinkDeLogin(url = location.href) {
  return isSignInWithEmailLink(auth, url)
}

export function emailSalvo(): string | null {
  try {
    return localStorage.getItem(CHAVE_EMAIL)
  } catch {
    return null
  }
}

export async function concluirLinkPorEmail(email: string, url = location.href) {
  await signInWithEmailLink(auth, email, url)
  try {
    localStorage.removeItem(CHAVE_EMAIL)
  } catch {
    /* nada a limpar */
  }
}

export function sair() {
  return signOut(auth)
}

/** Cria o grupo com o usuário como administrador e o torna o grupo atual. */
export async function criarGrupo(u: User, nome: string): Promise<string> {
  const gid = novoId()
  const b = writeBatch(fs)
  b.set(doc(fs, 'grupos', gid), { nome, admins: [u.uid], membros: [u.uid], perfis: { [u.uid]: perfilDe(u) }, criadoEm: Date.now() })
  b.set(doc(fs, 'usuarios', u.uid), { grupoId: gid })
  await b.commit()
  return gid
}

export async function lerConvite(gid: string): Promise<Pick<Grupo, 'id' | 'nome' | 'membros'> | null> {
  const s = await getDoc(doc(fs, 'grupos', gid))
  return s.exists() ? { id: s.id, nome: s.data().nome, membros: s.data().membros ?? [] } : null
}

/** Entra no grupo do convite como visualizador. */
export async function aceitarConvite(u: User, gid: string) {
  await updateDoc(doc(fs, 'grupos', gid), { membros: arrayUnion(u.uid), [`perfis.${u.uid}`]: perfilDe(u) })
  await setDoc(doc(fs, 'usuarios', u.uid), { grupoId: gid })
}

export function linkDeConvite(gid: string) {
  return `${location.origin}/convite/${gid}`
}

export async function definirAdmin(gid: string, uid: string, admin: boolean) {
  await updateDoc(doc(fs, 'grupos', gid), { admins: admin ? arrayUnion(uid) : arrayRemove(uid) })
}

export async function renomearGrupo(gid: string, nome: string) {
  await updateDoc(doc(fs, 'grupos', gid), { nome })
}
