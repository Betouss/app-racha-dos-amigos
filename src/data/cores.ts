export interface CorTime {
  nome: string
  cor: string
  texto: string // cor do texto sobre a cor do time
}

export const CORES: CorTime[] = [
  { nome: 'Azul', cor: '#3B6FD9', texto: '#FFFFFF' },
  { nome: 'Vermelho', cor: '#C8413F', texto: '#FFFFFF' },
  { nome: 'Amarelo', cor: '#F2CA4C', texto: '#1E1E1E' },
  { nome: 'Branco', cor: '#EDE9DF', texto: '#1E1E1E' },
  { nome: 'Verde', cor: '#2F9E5B', texto: '#FFFFFF' },
  { nome: 'Preto', cor: '#2B2B2B', texto: '#FFFFFF' },
  { nome: 'Roxo', cor: '#7B4FC9', texto: '#FFFFFF' },
  { nome: 'Laranja', cor: '#E2772E', texto: '#FFFFFF' },
]

export function corDoTime(cor: string): CorTime {
  return CORES.find((c) => c.cor === cor) ?? { nome: '', cor, texto: '#FFFFFF' }
}

export function nomeTime(i: number): CorTime {
  return CORES[i % CORES.length]
}
