import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { corDoTime } from '../data/cores'
import type { Jogador, Time } from '../domain/types'
import { Icon, type IconName } from './Icon'

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className={`stars${onChange ? ' stars--edit' : ''}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) =>
        onChange ? (
          <button key={i} type="button" role="radio" aria-checked={i === value} aria-label={`${i} estrela${i > 1 ? 's' : ''}`} onClick={() => onChange(i)}>
            <Star on={i <= value} size={size} />
          </button>
        ) : (
          <Star key={i} on={i <= value} size={size} />
        ),
      )}
    </span>
  )
}

export function Star({ on = true, size = 16 }: { on?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={on ? 'star' : 'star star--off'} aria-hidden="true">
      <path fill="currentColor" d="M12 2.5l2.95 6.1 6.7.9-4.9 4.6 1.2 6.6L12 17.5l-5.95 3.2 1.2-6.6-4.9-4.6 6.7-.9z" />
    </svg>
  )
}

export function Avatar({ jogador, size = 40, destaque = false }: { jogador?: Pick<Jogador, 'apelido' | 'foto'>; size?: number; destaque?: boolean }) {
  const letra = jogador?.apelido?.trim()[0]?.toUpperCase() ?? '?'
  return (
    <span className={`avatar${destaque ? ' avatar--destaque' : ''}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {jogador?.foto ? <img src={jogador.foto} alt="" /> : letra}
    </span>
  )
}

export function GolBadge() {
  return (
    <span className="gol-badge">
      <Icon name="luva" size={14} /> GOL
    </span>
  )
}

export function TeamDot({ cor, size = 14 }: { cor: string; size?: number }) {
  return <span className="team-dot" style={{ background: cor, width: size, height: size }} />
}

export function TeamName({ time, className }: { time?: Time; className?: string }) {
  if (!time) return null
  return (
    <span className={`team-name ${className ?? ''}`}>
      <TeamDot cor={time.cor} /> {time.nome}
    </span>
  )
}

export function teamStyle(cor: string) {
  const c = corDoTime(cor)
  return { '--team': c.cor, '--on-team': c.texto } as React.CSSProperties
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Diminuir" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <output>
        {value}
        {suffix && <small>{suffix}</small>}
      </output>
      <button type="button" aria-label="Aumentar" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
    </div>
  )
}

const ABAS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Início', icon: 'home' },
  { to: '/racha', label: 'Pelada', icon: 'campo' },
  { to: '/jogadores', label: 'Jogadores', icon: 'users' },
  { to: '/rankings', label: 'Rankings', icon: 'podio' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Principal">
      {ABAS.map((a) => (
        <NavLink key={a.to} to={a.to} end={a.to === '/'} className={({ isActive }) => (isActive ? 'on' : '')}>
          <Icon name={a.icon} size={24} />
          <span>{a.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/** Barra fixa com a ação principal da tela, acima da navegação. */
export function Dock({ children, nav = true }: { children?: ReactNode; nav?: boolean }) {
  // Publica a altura real da barra para a página reservar espaço e o último item não ficar escondido
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const raiz = document.documentElement
    const medir = () => raiz.style.setProperty('--dock-h', `${el.offsetHeight}px`)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => {
      ro.disconnect()
      raiz.style.removeProperty('--dock-h')
    }
  }, [])
  return (
    <div ref={ref} className={`dock${nav ? '' : ' dock--solo'}`}>
      {children && <div className="dock__acao">{children}</div>}
      {nav && <BottomNav />}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        {title && (
          <div className="sheet__head">
            <h2>{title}</h2>
            <button className="icon-btn" aria-label="Fechar" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** Modal de confirmação centralizado, no lugar do confirm() do navegador. */
export function Confirmar({
  aberto,
  titulo,
  children,
  icone = 'bandeira',
  confirmar,
  cancelar = 'Voltar',
  perigo = false,
  onConfirmar,
  onFechar,
}: {
  aberto: boolean
  titulo: ReactNode
  children?: ReactNode
  icone?: IconName
  confirmar: ReactNode
  cancelar?: string
  perigo?: boolean
  onConfirmar: () => void
  onFechar: () => void
}) {
  useEffect(() => {
    if (!aberto) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aberto, onFechar])
  if (!aberto) return null
  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className={`modal${perigo ? ' modal--perigo' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="modal-titulo" onClick={(e) => e.stopPropagation()}>
        <span className="modal__icone">
          <Icon name={icone} size={30} />
        </span>
        <h2 id="modal-titulo">{titulo}</h2>
        {children && <div className="modal__texto">{children}</div>}
        <div className="modal__acoes">
          <button className="btn btn--ghost" onClick={onFechar} autoFocus>
            {cancelar}
          </button>
          <button className={`btn${perigo ? ' btn--perigo' : ''}`} onClick={onConfirmar}>
            {confirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Voltar({ to, label }: { to?: string; label: string }) {
  const nav = useNavigate()
  return (
    <button className="voltar" onClick={() => (to ? nav(to) : nav(-1))}>
      <Icon name="esquerda" size={20} /> {label}
    </button>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ texto: string; acao?: { label: string; fn: () => void } } | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])
  const view = toast ? (
    <div className="toast" role="status">
      <span>{toast.texto}</span>
      {toast.acao && (
        <button
          onClick={() => {
            toast.acao!.fn()
            setToast(null)
          }}
        >
          {toast.acao.label}
        </button>
      )}
    </div>
  ) : null
  return { mostrar: setToast, view }
}

export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <p className="vazio__titulo">{titulo}</p>
      {children}
    </div>
  )
}

export async function compartilharTexto(texto: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text: texto })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
}
