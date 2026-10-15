# Racha

PWA mobile first para organizar a pelada: presença, sorteio de times equilibrado por estrelas, jogo ao vivo com registro de gols, classificação, histórico, perfil e rankings.

- Regras: [Racha App — Requisitos](https://claude.ai/code/artifact/96d132d4-a171-4109-859a-c56b5f2cbf05)
- Stack: Vite + React + TypeScript, vite-plugin-pwa, Firebase (Auth + Firestore com cache offline)

## Rodar

```bash
npm install
cp .env.example .env.local   # preencha com a config do app web do Firebase
npm run dev                  # http://localhost:5173 (com --host para abrir no celular na mesma rede)
npm test                     # regras de negócio (sorteio, tabela, classificação)
```

Sem projeto Firebase, dá para rodar tudo local com os emuladores (precisa de Java 11+):

```bash
npm run emuladores   # Auth + Firestore com as regras de firestore.rules; painel em http://localhost:4000
npm run dev:local    # app apontando para os emuladores
```

No emulador o e-mail de login não é enviado: o link aparece no painel, em Authentication.

## Configurar o Firebase (uma vez)

1. Crie o projeto em https://console.firebase.google.com e adicione um **app Web**; copie a config para `.env.local`.
2. **Authentication → Método de login**: ative **Google** e **E-mail/senha** com **Link por e-mail (login sem senha)**.
3. **Firestore Database → Criar banco** (modo produção; região `southamerica-east1` para o Brasil).
4. Publique as regras e o app: `npx firebase-tools login`, `npx firebase-tools use --add` e `npm run deploy`.
5. Se for hospedar fora do Firebase Hosting, adicione o domínio em **Authentication → Configurações → Domínios autorizados**.

## Como funciona

- **Grupo:** quem cria é administrador. Os outros entram pelo link de convite (tela Grupo) e só visualizam; o administrador pode promover outros.
- **Permissões:** garantidas no servidor por `firestore.rules` (participante não grava; quem não é do grupo não lê).
- **Offline:** o Firestore guarda tudo no aparelho. Gols e partidas registrados sem sinal aparecem na hora e sobem quando a conexão voltar. O primeiro login precisa de internet.
- **Dados da versão sem login:** ao criar o grupo (ou na tela Grupo) dá para importar os jogadores e rachas salvos no aparelho.
- Na tela inicial vazia, o administrador pode "Carregar dados de exemplo" (23 jogadores, 3 rachas encerrados e o próximo com a lista fechada).

## Onde está cada regra

| Regra | Arquivo |
| --- | --- |
| Sorteio por potes, goleiros, travados, reservas | `src/domain/sorteio.ts` |
| Todos contra todos (método do círculo), ida e volta | `src/domain/tabela.ts` |
| Placar a partir dos gols, gol contra, classificação e desempate, estatísticas | `src/domain/stats.ts` |
| Modelo de dados (7 coleções por grupo) | `src/domain/types.ts`, `src/data/store.tsx` |
| Ações do fluxo do racha (gravações em lote, offline) | `src/data/acoes.ts` |
| Login, grupo, convite, administradores | `src/data/grupo.ts`, `firestore.rules` |
| Importação do banco local antigo | `src/data/legado.ts` |
