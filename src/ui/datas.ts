const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DDTHH:mm' em hora local, formato do input datetime-local. */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function deIso(s: string): Date {
  return new Date(s)
}

export function hora(d: Date): string {
  return d.getMinutes() ? `${d.getHours()}h${pad(d.getMinutes())}` : `${d.getHours()}h`
}

/** "Sáb, 17 out" */
export function diaCurto(s: string | Date): string {
  const d = typeof s === 'string' ? deIso(s) : s
  return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`
}

/** "Sáb, 17 out · 8h" */
export function diaHora(s: string): string {
  const d = deIso(s)
  return `${diaCurto(d)} · ${hora(d)}`
}

/** "Quinta, 15 out" */
export function hojeLongo(d = new Date()): string {
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`
}

/** "EM 2 DIAS", "HOJE", "AMANHÃ", "HÁ 3 DIAS" */
export function relativo(s: string, agora = new Date()): string {
  const d = deIso(s)
  const dia = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000
  const diff = dia(d) - dia(agora)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff > 1) return `Em ${diff} dias`
  if (diff === -1) return 'Ontem'
  return `Há ${-diff} dias`
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
