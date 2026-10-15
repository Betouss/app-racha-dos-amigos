import Dexie from 'dexie'
import { Lote, ref } from './firebase'
import { novoId } from './firebase'

// Banco local da primeira versão (IndexedDB "racha"). Só é lido para levar os
// dados deste aparelho para o grupo no Firebase.

type Linha = Record<string, unknown> & { id?: number }

async function abrir(): Promise<Dexie | null> {
  if (!(await Dexie.exists('racha'))) return null
  const db = new Dexie('racha')
  db.version(1).stores({
    jogadores: '++id',
    rachas: '++id',
    presencas: '[rachaId+jogadorId]',
    times: '++id, rachaId',
    timeJogadores: '[timeId+jogadorId]',
    partidas: '++id',
    gols: '++id',
  })
  await db.open()
  return db
}

export async function resumoLocal(): Promise<{ jogadores: number; rachas: number } | null> {
  try {
    const db = await abrir()
    if (!db) return null
    const r = { jogadores: await db.table('jogadores').count(), rachas: await db.table('rachas').count() }
    db.close()
    return r.jogadores || r.rachas ? r : null
  } catch {
    return null
  }
}

/** Copia tudo do banco local para o grupo, trocando os IDs numéricos por IDs do Firestore. */
export async function importarLocal(gid: string) {
  const db = await abrir()
  if (!db) return
  const ler = (t: string) => db.table(t).toArray() as Promise<Linha[]>
  const [jogadores, rachas, presencas, times, timeJogadores, partidas, gols] = await Promise.all(
    ['jogadores', 'rachas', 'presencas', 'times', 'timeJogadores', 'partidas', 'gols'].map(ler),
  )
  const mapa = (linhas: Linha[]) => new Map(linhas.map((l) => [l.id as number, novoId()]))
  const J = mapa(jogadores)
  const R = mapa(rachas)
  const T = mapa(times)
  const P = mapa(partidas)
  const id = (m: Map<number, string>, v: unknown) => (v === undefined || v === null ? undefined : m.get(v as number))
  const sem = ({ id: _id, ...resto }: Linha) => resto

  const l = new Lote()
  for (const j of jogadores) l.set(ref(gid, 'jogadores', J.get(j.id!)!), sem(j))
  for (const r of rachas) l.set(ref(gid, 'rachas', R.get(r.id!)!), sem(r))
  for (const p of presencas) {
    const rachaId = id(R, p.rachaId)
    const jogadorId = id(J, p.jogadorId)
    if (rachaId && jogadorId) l.set(ref(gid, 'presencas', `${rachaId}_${jogadorId}`), { ...p, rachaId, jogadorId })
  }
  const ordem = new Map<string, number>()
  for (const t of [...times].sort((a, b) => a.id! - b.id!)) {
    const rachaId = id(R, t.rachaId)!
    const n = ordem.get(rachaId) ?? 0
    ordem.set(rachaId, n + 1)
    l.set(ref(gid, 'times', T.get(t.id!)!), { ...sem(t), rachaId, ordem: n })
  }
  for (const tj of timeJogadores) {
    const timeId = id(T, tj.timeId)
    const jogadorId = id(J, tj.jogadorId)
    if (timeId && jogadorId) l.set(ref(gid, 'timeJogadores', `${timeId}_${jogadorId}`), { ...tj, timeId, jogadorId })
  }
  for (const p of partidas) l.set(ref(gid, 'partidas', P.get(p.id!)!), { ...sem(p), rachaId: id(R, p.rachaId), timeAId: id(T, p.timeAId), timeBId: id(T, p.timeBId) })
  for (const g of gols)
    l.set(ref(gid, 'gols', novoId()), {
      ...sem(g),
      partidaId: id(P, g.partidaId),
      jogadorId: id(J, g.jogadorId),
      timeId: id(T, g.timeId),
      assistenciaId: id(J, g.assistenciaId),
    })
  await l.enviar()
  db.close()
  await Dexie.delete('racha')
}
