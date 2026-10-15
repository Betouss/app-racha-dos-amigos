import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAdmin, useBase } from '../data/store'
import { Avatar, Dock, GolBadge, Stars, Vazio } from '../ui/components'
import { Icon } from '../ui/Icon'

type Filtro = 'todos' | 'linha' | 'goleiros' | 'inativos'

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export default function Jogadores() {
  const nav = useNavigate()
  const todos = useBase().jogadores
  const admin = useAdmin()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')

  const ativos = todos.filter((j) => j.ativo)
  const linha = ativos.filter((j) => !j.goleiro).length
  const goleiros = ativos.length - linha
  const inativos = todos.length - ativos.length
  const termo = semAcento(busca.trim())
  const lista = todos
    .filter((j) => (filtro === 'inativos' ? !j.ativo : j.ativo))
    .filter((j) => filtro !== 'linha' || !j.goleiro)
    .filter((j) => filtro !== 'goleiros' || j.goleiro)
    .filter((j) => !termo || semAcento(`${j.apelido} ${j.nome}`).includes(termo))
    .sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'))

  const alternar = (f: Filtro) => setFiltro(filtro === f ? 'todos' : f)

  return (
    <>
      <main className="page">
        <p className="eyebrow">{ativos.length} no elenco</p>
        <h1>Jogadores</h1>
        <label className="campo campo--busca" style={{ marginTop: 16 }}>
          <Icon name="busca" />
          <span className="sr-only">Buscar</span>
          <input type="search" placeholder="Buscar por apelido ou nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="filtros">
          <button className={`filtro${filtro === 'linha' ? ' on' : ''}`} onClick={() => alternar('linha')}>
            {linha} de linha
          </button>
          <button className={`filtro${filtro === 'goleiros' ? ' on' : ''}`} onClick={() => alternar('goleiros')}>
            {goleiros} goleiro{goleiros === 1 ? '' : 's'}
          </button>
          {inativos > 0 && (
            <button className={`filtro${filtro === 'inativos' ? ' on' : ''}`} onClick={() => alternar('inativos')}>
              {inativos} inativo{inativos === 1 ? '' : 's'}
            </button>
          )}
        </div>

        {lista.length === 0 ? (
          <Vazio titulo={todos.length === 0 ? 'Ninguém no elenco ainda' : 'Ninguém encontrado'}>
            {todos.length === 0 && 'Adicione a galera para sortear os times.'}
          </Vazio>
        ) : (
          <ul className="lista">
            {lista.map((j) => (
              <li key={j.id}>
                <Link className={`item${j.ativo ? '' : ' item--off'}`} to={`/jogadores/${j.id}`}>
                  <Avatar jogador={j} />
                  <div className="item__main">
                    <div className="item__titulo">
                      {j.apelido} {j.goleiro && <GolBadge />}
                    </div>
                    {j.nome && <div className="item__sub">{j.nome}</div>}
                  </div>
                  <Stars value={j.estrelas} />
                  <Icon name="direita" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Dock>
        {admin && (
          <button className="btn" onClick={() => nav('/jogadores/novo')}>
            <Icon name="mais" size={26} /> Adicionar jogador
          </button>
        )}
      </Dock>
    </>
  )
}
