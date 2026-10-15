// Modelo de dados (7 tabelas). Placar e estatísticas nunca são armazenados:
// saem sempre de partidas + gols. IDs são os IDs de documento do Firestore.

export type Id = string

export interface Jogador {
  id: Id
  nome: string
  apelido: string
  foto?: string // data URL reduzida
  estrelas: number // 1–5
  goleiro: boolean
  ativo: boolean
}

export type StatusRacha = 'aberto' | 'em_andamento' | 'encerrado'

export interface Racha {
  id: Id
  data: string // 'YYYY-MM-DDTHH:mm' (hora local)
  local: string
  jogadoresLinha: number
  qtdTimes: number
  duracaoRachaMin: number // ≥ 60
  duracaoPartidaMin: number
  idaVolta: boolean
  status: StatusRacha
}

export interface Presenca {
  rachaId: Id
  jogadorId: Id
  reserva: boolean
}

export interface Time {
  id: Id
  rachaId: Id
  nome: string
  cor: string
  ordem: number
}

export interface TimeJogador {
  timeId: Id
  jogadorId: Id
  travado: boolean
  goleiro: boolean
}

export type StatusPartida = 'agendada' | 'em_andamento' | 'encerrada'

export interface Partida {
  id: Id
  rachaId: Id
  timeAId: Id
  timeBId: Id
  ordem: number
  status: StatusPartida
  iniciadaEm?: number // epoch ms
  encerradaEm?: number
}

export interface Gol {
  id: Id
  partidaId: Id
  jogadorId: Id
  timeId: Id // time do jogador que fez o gol
  minuto?: number
  assistenciaId?: Id
  contra: boolean // gol contra: conta para o adversário de timeId
  criadoEm: number
}
