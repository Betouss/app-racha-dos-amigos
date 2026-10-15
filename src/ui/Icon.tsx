const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  campo: 'M3 5h18v14H3zM12 5v14M3 9h3v6H3M21 9h-3v6h3M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  podio: 'M8 21V12h8v9M2 21v-6h6M16 21v-4h6v4M2 21h20M12 3l1 2.2 2.4.3-1.8 1.6.5 2.4L12 8.3 9.9 9.5l.5-2.4-1.8-1.6 2.4-.3z',
  sol: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41',
  lua: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
  trofeu: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0z',
  bola: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 7l4.5 3.3-1.7 5.2H9.2l-1.7-5.2zM12 7V2.5M16.5 10.3l4.3-1.4M14.8 15.5l2.7 3.7M9.2 15.5l-2.7 3.7M7.5 10.3 3.2 8.9',
  mais: 'M12 5v14M5 12h14',
  sorteio: 'M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22M18 2l4 4-4 4M2 6h1.9c1.5 0 2.9.9 3.6 2.2M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8M18 14l4 4-4 4',
  check: 'M20 6 9 17l-5-5',
  cadeado: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  aberto: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.75-1.4',
  relogio: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 6v6l4 2',
  desfazer: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  compartilhar: 'M12 2v13M16 6l-4-4-4 4M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8',
  busca: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.3-4.3',
  direita: 'M9 18l6-6-6-6',
  esquerda: 'M15 18l-6-6 6-6',
  luva: 'M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  assist: 'M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4',
  x: 'M18 6 6 18M6 6l12 12',
  editar: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  lixo: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  troca: 'M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4',
  play: 'M6 4l14 8-14 8z',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3zM12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  bandeira: 'M4 22V4M4 4h13l-2 4 2 4H4',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
