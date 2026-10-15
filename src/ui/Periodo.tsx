import type { Racha } from '../domain/types'

export type Periodo = string // ano ('2026') ou 'tudo'

export function anoAtual(): Periodo {
  return String(new Date().getFullYear())
}

export function filtroPeriodo(p: Periodo) {
  return (r: Racha) => p === 'tudo' || r.data.startsWith(p)
}

export function PeriodoFiltro({ rachas, value, onChange }: { rachas: Racha[]; value: Periodo; onChange: (p: Periodo) => void }) {
  const anos = [...new Set([anoAtual(), ...rachas.map((r) => r.data.slice(0, 4))])].sort().reverse()
  return (
    <div className="filtros" role="radiogroup" aria-label="Período">
      {anos.map((a) => (
        <button key={a} role="radio" aria-checked={value === a} className={`filtro${value === a ? ' on' : ''}`} onClick={() => onChange(a)}>
          Temporada {a}
        </button>
      ))}
      <button role="radio" aria-checked={value === 'tudo'} className={`filtro${value === 'tudo' ? ' on' : ''}`} onClick={() => onChange('tudo')}>
        Desde o início
      </button>
    </div>
  )
}
