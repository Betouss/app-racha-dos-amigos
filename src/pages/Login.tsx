import { useEffect, useState } from 'react'
import { concluirLinkPorEmail, ehLinkDeLogin, emailSalvo, entrarComGoogle, enviarLinkPorEmail } from '../data/grupo'
import { Icon } from '../ui/Icon'

const MENSAGENS: Record<string, string> = {
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/invalid-action-code': 'Este link já foi usado ou expirou. Peça outro.',
  'auth/network-request-failed': 'Sem conexão. O primeiro login precisa de internet.',
  // Erros de configuração do projeto Firebase (Console → Authentication)
  'auth/configuration-not-found': 'O login ainda não foi ativado no Firebase: abra Authentication no console e clique em "Vamos começar".',
  'auth/operation-not-allowed': 'Este tipo de login está desativado no Firebase (Authentication → Método de login).',
  'auth/unauthorized-domain': 'Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).',
  'auth/unauthorized-continue-uri': 'Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).',
  'auth/quota-exceeded': 'Limite diário de e-mails de login do Firebase atingido. Tente mais tarde ou entre com Google.',
}

function mensagem(e: unknown) {
  const codigo = (e as { code?: string }).code ?? ''
  return MENSAGENS[codigo] ?? `Não foi possível entrar. Tente de novo.${codigo ? ` (${codigo})` : ''}`
}

/** Remove os parâmetros do link de login da barra de endereço, mantendo o caminho (ex.: convite). */
function limparUrl() {
  history.replaceState(null, '', location.pathname)
}

export default function Login() {
  const veioDoLink = ehLinkDeLogin()
  const [email, setEmail] = useState(veioDoLink ? (emailSalvo() ?? '') : '')
  const [estado, setEstado] = useState<'pronto' | 'enviando' | 'enviado' | 'entrando'>(veioDoLink && emailSalvo() ? 'entrando' : 'pronto')
  const [erro, setErro] = useState('')
  const convite = location.pathname.startsWith('/convite/')

  // Abriu o link do e-mail neste aparelho: conclui o login sozinho
  useEffect(() => {
    if (!veioDoLink) return
    const salvo = emailSalvo()
    if (!salvo) return
    concluirLinkPorEmail(salvo)
      .then(limparUrl)
      .catch((e) => {
        setErro(mensagem(e))
        setEstado('pronto')
      })
  }, [veioDoLink])

  const google = async () => {
    setErro('')
    try {
      await entrarComGoogle()
    } catch (e) {
      setErro(mensagem(e))
    }
  }

  const porEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setEstado(veioDoLink ? 'entrando' : 'enviando')
    try {
      if (veioDoLink) {
        await concluirLinkPorEmail(email.trim())
        limparUrl()
      } else {
        await enviarLinkPorEmail(email.trim())
        setEstado('enviado')
      }
    } catch (err) {
      setErro(mensagem(err))
      setEstado('pronto')
    }
  }

  return (
    <main className="page page--sem-acao" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="pitch">
        <div className="pitch__eyebrow">{convite ? 'Você foi convidado' : 'Bem-vindo'}</div>
        <div className="pitch__titulo" style={{ fontSize: 44 }}>
          Racha
        </div>
        <p style={{ margin: '4px 0 0', lineHeight: 1.4 }}>
          {convite ? 'Entre para acompanhar os rachas do grupo.' : 'Times equilibrados, placar ao vivo e o histórico da pelada.'}
        </p>
      </div>

      {estado === 'entrando' ? (
        <p className="sub" style={{ textAlign: 'center', marginTop: 24 }}>
          Entrando…
        </p>
      ) : estado === 'enviado' ? (
        <div className="aviso" style={{ marginTop: 24 }}>
          Enviamos um link para <strong>{email}</strong>. Abra o e-mail neste aparelho e toque no link para entrar.
          <div style={{ marginTop: 8 }}>
            <button className="link-btn" style={{ padding: 0 }} onClick={() => setEstado('pronto')}>
              Usar outro e-mail
            </button>
          </div>
        </div>
      ) : (
        <>
          {!veioDoLink && (
            <div className="acoes" style={{ marginTop: 24 }}>
              <button className="btn" onClick={google}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.85.55 3.9 1.45l2.15-2.15A9 9 0 1 0 12 21c5.2 0 8.65-3.65 8.65-8.8 0-.4-.05-.75-.1-1.1z" />
                </svg>
                Entrar com Google
              </button>
            </div>
          )}
          <form onSubmit={porEmail} style={{ marginTop: 20 }}>
            <label className="label" htmlFor="email">
              {veioDoLink ? 'Confirme seu e-mail' : 'Ou receba um link por e-mail'}
            </label>
            <input
              id="email"
              className="campo"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="acoes">
              <button className="btn btn--ghost" disabled={!email.trim() || estado === 'enviando'}>
                <Icon name="check" /> {veioDoLink ? 'Entrar' : estado === 'enviando' ? 'Enviando…' : 'Enviar link'}
              </button>
            </div>
          </form>
        </>
      )}
      {erro && (
        <p className="aviso" role="alert">
          {erro}
        </p>
      )}
    </main>
  )
}
