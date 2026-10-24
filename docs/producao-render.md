# Express + React no mesmo Web Service

## Estrutura e revisão

A integração está na branch `feat/render-mesma-origem`, no repositório do backend.
O frontend foi importado dos arquivos versionados do commit
`9e6cb86daf7681f8869eb1686e12fbf22628ec9a`, e o backend foi conferido no commit
`1e2cec795de31591bd913f5bca4cfabb97929469`. Ambos correspondiam ao GitHub durante
a revisão. O repositório original do frontend não foi alterado.

Arquivos criados/modificados:

- `app.js`: Router `/api`, frontend estático, fallback da SPA, erros JSON e porta.
- `package.json`, `package-lock.json`, `.node-version`: comandos na raiz e Node 24.
  O lockfile também atualiza apenas o `body-parser` indireto para 2.4.0, dentro
  da faixa já permitida pelo Express, corrigindo a auditoria de segurança.
- `.gitignore` e `.env.example`: exclusão de arquivos privados e modelo sem secrets.
- `.gitattributes`: mantém os patches históricos do frontend sem alterar seus
  espaços de contexto exigidos pelo formato de diff unificado.
- `frontend/`: fontes, componentes, estilos, serviços, testes, configurações e
  lockfile do frontend preservados.
- `frontend/vite.config.ts`: proxy local, sem remoção de `/api`, e HTTPS opcional.
- `frontend/package.json` e lockfile: engine alinhada e caminho do teste HTTP.
- `frontend/tests/backend-http.mjs`: rotas `/api` e compatibilidade com o Router.
- `frontend/tests/browser-check.mjs`: resolve a pasta do frontend a partir do
  próprio arquivo, permitindo executar o teste também pela raiz do backend.
- `tests/integracao.test.cjs`, `tests/helpers/aplicacao.cjs`,
  `tests/fixtures/iniciar.cjs`, `tests/producao-browser.mjs`: novos testes.
- `README.md`, `frontend/README.md` e este documento: instruções atuais.

Não foram copiados `node_modules`, `.env`, certificados, chaves ou builds antigos.
As dependências foram instaladas pelos lockfiles. `frontend/dist` é gerado pelo
build e não é versionado. `database.js`, `schemas.js`, `validar.js` e `schema.sql`
não tiveram sua lógica alterada. Não foi alterado o banco real.

## Como o Express entrega o React

O Helmet continua ativo na aplicação inteira. O Router atende `/api` primeiro,
com os mesmos middlewares de sessão, validação, autorização e limiter.
Qualquer rota não atendida nesse namespace termina em 404 JSON.

Depois vêm `express.static`, restrito ao caminho absoluto `frontend/dist`, e o
fallback GET `/{*pagina}`. Ele envia `index.html` quando a requisição aceita HTML
e não está buscando um arquivo ou dotfile. O wildcard nomeado com chaves atende
à sintaxe do Express 5 e inclui `/`. Atualizar `/dashboard/admin`, por exemplo,
entrega o React; o React consulta `/api/me` antes de exibir dados privados.

POST, PATCH e DELETE não passam pelo fallback. Assets ausentes e arquivos internos
recebem 404, em vez de HTML. A raiz do backend, `.env`, certificados, fontes,
testes e dependências não são conteúdo estático. Erros de parsing e erros internos
também recebem JSON, sem stack do servidor.

O Helmet padrão, incluindo CSP, HSTS e `nosniff`, foi mantido. Os JS/CSS compilados
usam a mesma origem e são compatíveis com a política atual; não foi adicionado
`unsafe-eval`, liberado domínio externo ou desativada CSP.
Referências: [Express 5](https://expressjs.com/en/guide/migrating-5/#path-syntax)
e [Helmet](https://helmet.js.org/).

## Rotas da API

Todos os caminhos existentes agora começam com `/api`. Corpos JSON, consultas SQL,
validações, status de negócio e permissões foram preservados. Não há aliases antigos.

| Método | Rota |
| --- | --- |
| POST | `/api/login` |
| GET | `/api/me` |
| POST | `/api/logout` |
| GET | `/api/admin/funcionarios` |
| POST | `/api/cadastro` (administrativo) |
| POST | `/api/criarConta` (público) |
| DELETE | `/api/delet` |
| GET / POST | `/api/servicos` |
| DELETE | `/api/servicos/delet` |
| POST | `/api/solicitacoes` |
| GET | `/api/consulsolicitacoes` |
| GET | `/api/minhassolicitacoes` |
| POST | `/api/ordem` |
| PATCH | `/api/ordem/status` |
| DELETE | `/api/ordem/:id` |
| GET | `/api/consultOrdens` (aceita `status`) |
| GET | `/api/minhasordens` |
| GET | `/api/funcionario/ordens` |

`GET /cadastro` e `GET /login` são páginas React. `POST /api/cadastro` e
`POST /api/login` são operações do Express. Consumidores externos antigos precisam
adotar o prefixo. Todos os arquivos em `frontend/src/services` foram conferidos:
já utilizam `/api` e não precisaram mudar seus contratos.

A API recebe `Cache-Control: no-store`. Sessão MySQL, nome do cookie, `Secure`,
`HttpOnly`, `SameSite=Lax`, validade e `trust proxy: 1` foram preservados. O
middleware de sessão agora atende apenas a API, evitando consultas de sessão para
entregar JS/CSS. Não há JWT, tokens no localStorage ou CORS entre dois serviços.

## Desenvolvimento e produção local

Use Node **24.22.1**, com limite de major no `engines`. Essa foi a versão usada
nos testes, com npm 11.19.1. Os lockfiles resolvem Express 5.3.0, Helmet 8.3.0,
Vite 8.3.5 e React Router 8.5.0; o Router exige pelo menos Node 22.22.

```sh
npm ci
test -f .env || cp .env.example .env
# Preencha apenas .env com banco de DESENVOLVIMENTO, CA_PATH e SESSION_SECRET.
npm run build
npm start
```

`npm run build` instala o frontend pelo lockfile, incluindo ferramentas de build,
e compila. `npm start` inicia somente o Express em `0.0.0.0`, usando `PORT` ou
`3000`. Não inicia Vite nem recompila. O CA do MySQL continua vindo de `CA_PATH`
ou `ca.pem`. Não versionar esse certificado nem credenciais.
Se já existe um `.env`, preserve-o e confira se aponta para um banco de
desenvolvimento antes de iniciar o ambiente local.

Para editar o React com atualização automática:

```sh
# Terminal 1
npm run dev

# Terminal 2, com certificado local confiável já disponível
DEV_HTTPS_KEY=/caminho/localhost.key DEV_HTTPS_CERT=/caminho/localhost.crt npm run dev:frontend
```

Abra `https://localhost:5173`. O proxy encaminha `/api` para
`http://127.0.0.1:3000` sem remover o prefixo. Use `API_PROXY_TARGET` se mudar a
porta/endereço local. Nenhuma chamada depende obrigatoriamente do Render.

Use certificados confiáveis gerados pela ferramenta/equipe de desenvolvimento.
Os dois caminhos TLS devem ser informados juntos e são lidos somente pelo Vite,
nunca pelo bundle. `X-Forwarded-Proto: https` é enviado apenas quando o Vite
termina TLS de verdade, permitindo cookies seguros através do proxy local.

Sem certificados, Vite pode servir a interface por HTTP, mas o login não emitirá
o cookie Secure. Não resolver removendo Secure ou fingindo HTTPS em conexões
HTTP. Na produção, a terminação TLS é feita pelo Render.

## Configuração exata do Render

Aplicar manualmente depois da revisão/autorização:

| Campo | Valor |
| --- | --- |
| Repository | `educarlettodeabreu/gestao-de-ordens-de-servicos` |
| Branch | Branch aprovada; `main` somente depois de integrar a revisão |
| Runtime | Node |
| Root Directory | Vazio, usando a raiz do repositório |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/` |
| `NODE_ENV` | `production` |
| Node | `.node-version` define `24.22.1`; se `NODE_VERSION` já existir no painel, alinhar para `24.22.1` ou remover o override |
| `PORT` | Usar o valor fornecido pelo Render |

Preservar os valores existentes de `SESSION_SECRET`, `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASS`, `DB_NAME` e `CA_PATH`. O CA continua um arquivo privado;
se for um Secret File chamado `ca.pem`, confirmar o caminho `/etc/secrets/ca.pem`
no painel antes de configurar. Não substituir credenciais ou caminhos existentes
sem verificar. Não definir `DEV_HTTPS_KEY`, `DEV_HTTPS_CERT` ou `API_PROXY_TARGET`
no Render.

O build usa `--include=dev` no frontend mesmo com `NODE_ENV=production`, pois
TypeScript e Vite são necessários para compilar. O Render termina HTTPS e
encaminha HTTP ao Express com os headers do proxy. O cookie não fixa domínio,
ficando na mesma origem do React. O health check `/` verifica o frontend
compilado, mas não comprova a disponibilidade do MySQL.

Conferir o modo de auto-deploy antes de publicar. Não foram feitos push, merge
em main, deploy ou alteração automática no Render nesta tarefa.
Referências: [deploy Express](https://render.com/docs/deploy-node-express-app),
[Node](https://render.com/docs/node-version) e
[portas/TLS](https://render.com/docs/web-services#port-binding).

## Testes e limitações

Depois do build:

```sh
npm run lint
npm test
npm run test:http
```

`npm test` cobre os testes novos do backend e os existentes do frontend. Inclui
um processo `npm start`, páginas diretas, JS/CSS, proteção de arquivos internos,
404 JSON em vários métodos, autenticação, autorização, cadastro, serviços,
solicitações, ordens, cookies e rate limiting. O lint faz verificação de sintaxe
do backend e executa o ESLint existente do frontend.

Teste integrado opcional com Playwright e Chromium já instalados externamente:

```sh
npm run test:production -- /caminho/playwright-core/index.js /caminho/navegador
# Teste antigo de interface, com respostas controladas, também preservado:
npm run test:browser -- /caminho/playwright-core/index.js /caminho/navegador
```

O teste integrado usa React compilado e Express em HTTPS, APIs e cookies reais
do navegador, sem interceptar chamadas HTTP. Também verifica o proxy HTTPS do
Vite para o Express local. O certificado autoassinado e a exceção de confiança
existem somente no teste. Não foi adicionada dependência ao projeto.

Somente banco e armazenamento de sessões são substituídos por fixtures/MemoryStore
isolados. A aplicação não ganhou modo mock ou atalho de autenticação. O `.env`
original não foi lido, copiado ou utilizado. Sem um MySQL identificado como
desenvolvimento, conexão, SQL e persistência reais ficam para homologação.
Capturas contêm só dados de teste e ficam em `/tmp/erp-producao-capturas`.
Cancelamentos de leitura de corpo após HTTP 2xx são distinguidos de falhas de
carregamento de JS/CSS, CSP e de requisições sem resposta.
Em desenvolvimento, os cancelamentos GET do StrictMode também são identificados;
as consultas seguintes precisam preencher a interface sem erro para o teste passar.

Resultados nesta revisão:

| Verificação | Resultado |
| --- | --- |
| `npm ci` e `npm run build`, Node 24.22.1 | Aprovados |
| `npm run lint` | Aprovado |
| `npm test` | 10 testes novos do backend e 88 existentes do frontend aprovados |
| `npm run test:http` | 28 verificações aprovadas, com banco/store substituídos |
| Navegador integrado HTTPS | 26 verificações aprovadas, incluindo proxy local; sem erros JS, falhas de assets ou violações CSP |
| Navegador existente do frontend | 42 verificações aprovadas a partir da nova raiz, com APIs controladas somente nesse teste |
| Banco MySQL de desenvolvimento/Render | Não testado com credenciais reais; requer homologação |

O teste de inicialização executou `npm start` como processo separado e confirmou
o HTML React em `/login` e 401 de `/api/me` sem sessão. Os testes HTTP também
verificaram JS/CSS, páginas diretas e todos os endpoints e permissões preservados.

## Pendências antes de liberar usuários reais

A auditoria final identificou o aviso alto
[GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828) no
`body-parser` 2.3.0 já presente. Foi atualizado pontualmente para 2.4.0 no
lockfile, sem adicionar dependência direta nem alterar a API. Foi incluído teste
de regressão com gzip, deflate e Brotli contendo bytes excedentes, verificando
respostas controladas e a continuidade do servidor. Após a correção, a auditoria
do backend não apontou vulnerabilidades conhecidas nessa execução; isso não
substitui as pendências abaixo ou uma revisão completa de segurança.

- Implementar e testar CSRF nas mutações e login/logout. Mesma origem e SameSite
  não substituem uma política CSRF do servidor; CORS não é proteção CSRF.
- Regenerar a sessão após login e revisar revogação/mudança de classe: os
  middlewares ainda conferem a classe armazenada na sessão no login.
- Validar os corpos administrativos no servidor, incluindo classe no cadastro
  e IDs de funcionários na criação de ordens.
- Tornar criação de ordens, atribuição e remoção de solicitações transacionais,
  evitando estado parcial/duplicação após falhas.
- Homologar as três classes com MySQL real, cookies, expiração, logout e origem
  HTTPS final antes de liberar usuários. Build e testes com fixtures não bastam.

Essas limitações existentes não foram ocultadas pela integração. O banco e as
políticas de cookies não foram alterados. Referência de CSRF:
[OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
