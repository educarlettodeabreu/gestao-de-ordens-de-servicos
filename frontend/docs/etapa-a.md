# Etapa A — Autenticação e navegação

> Registro da entrega inicial de A. A continuação autorizada e o estado atual
> de todas as etapas estão em [implementacao-erp.md](implementacao-erp.md).
> Os patches citados abaixo foram posteriormente aplicados ao backend local.

O frontend está preparado para sessões reais do Express. O fluxo completo ainda
depende de adicionar `GET /me` ao backend e disponibilizá-lo na API. A consulta
sem credenciais a `https://gestao-de-ordens.onrender.com/me` retornou **404**.
Não foram criadas contas nem enviadas tentativas de login à API real.

## Código examinado e escopo

- Frontend: `Login.tsx`, `Cadastro.tsx`, serviços existentes, `App.tsx`, estilos,
  versões instaladas do React Router e proxy do Vite.
- Backend: cópia local em `../gestaoordens`, remota
  [gestao-de-ordens-de-servicos](https://github.com/educarlettodeabreu/gestao-de-ordens-de-servicos),
  commit `245e8a20d7f46f3b95aa79af699340de07f60920`, também confirmado no GitHub.
  Foram examinados `app.js`, schemas de validação e tabelas de `schema.sql`.
- O backend tem `POST /login` e `POST /logout`; o login retorna somente uma
  mensagem e preenche `req.session.usuarioLogado`. Não há `GET /me`.
- O backend está fora da área de escrita deste workspace. Foi preparado
  [um patch separado](backend/me.patch), sem modificar esse repositório.
- Esta entrega contém somente A. Os painéis usam uma tela mínima com identidade
  real do usuário e botão Sair para revisar o acesso. Layout compartilhado,
  sidebar, header e funcionalidades de negócio ficam para B–E.
- Nenhum commit, push, deploy ou instalação de dependência foi realizado.

## Plano em etapas

1. **A:** consultar sessão, redirecionar por classe, proteger rotas e sair.
2. **B:** layout compartilhado, navegação visual e responsividade, após revisão A.
3. **C:** serviços, solicitações e ordens do cliente.
4. **D:** consulta e filtros das ordens atribuídas ao funcionário.
5. **E:** administração dos serviços, solicitações e ordens, respeitando os
   endpoints realmente existentes.
6. **F:** revisão integrada de fluxos, estados e segurança. Build, lint e testes
   apropriados também devem ser executados em cada etapa.

## Comportamento implementado

- `/` e `/login` continuam públicos, assim como `/cadastro`.
- Depois de `POST /api/login` retornar 200, navega-se para `/dashboard`. Seu
  loader consulta `GET /api/me` e redireciona por `classe` para
  `/dashboard/cliente`, `/dashboard/funcionario` ou `/dashboard/admin`.
- O mesmo loader verifica acesso direto, atualização da página e navegação
  entre painéis. O usuário vai sempre para a rota da classe devolvida pela API.
- Uma tela de carregamento substitui o conteúdo enquanto a navegação/verificação
  está pendente. JSON malformado, ID inválido ou classe desconhecida não liberam
  o painel. Somente `id`, `nome`, `email` e `classe` são mantidos no estado.
- `401` em `/me` redireciona para `/login`. `403`, `404`, `429`, `500` e falhas
  de rede mostram mensagens adequadas, sem presumir logout, com opção de tentar
  novamente. O erro bloqueia a exibição do painel, inclusive em revalidações.
- O estado de autenticação é o dado do loader do React Router, sem contexto
  global redundante e sem armazenamento persistente no navegador.
- Sair envia `POST /api/logout`. Só uma resposta HTTP bem-sucedida provoca o
  redirecionamento ao login e a remoção dos dados do loader protegido. Falhas
  permitem tentar novamente e não confirmam o encerramento. Após a ação, o
  Router revalida a sessão; se ela já expirou, um `401` de `/me` leva ao login.
- Voltar ou reabrir um painel exige consultar a sessão novamente. Requisições
  abandonadas recebem o sinal de cancelamento do Router.
- As chamadas de autenticação usam `/api`, `credentials: "same-origin"` e
  `cache: "no-store"`. O proxy e as políticas de sessão/cookies foram preservados.
- Cadastro permanece público e não autentica automaticamente.

## Alteração necessária no backend

O arquivo [backend/me.patch](backend/me.patch) adiciona `GET /me` após o login,
reutilizando `verifAutenticacao` e a conexão `db` existentes. A consulta é:

```sql
SELECT id, nome, email, classe FROM users WHERE id = ?
```

O parâmetro vem exclusivamente de `req.session.usuarioLogado.id`. Não há filtro
recebido por body, query ou parâmetros do navegador. Usuário ausente ou sessão
inválida retornam 401; erro do banco retorna 500 sem detalhes internos. A resposta
200 expõe somente os quatro campos necessários e usa `Cache-Control: no-store`.

Para revisar no diretório do backend, usando o caminho real deste frontend:

```sh
git apply --check ../gestao-de-ordens-frontend/docs/backend/me.patch
git apply ../gestao-de-ordens-frontend/docs/backend/me.patch
```

Somente `--check` foi executado nesta entrega, com sucesso. O segundo comando
fica para uma aplicação autorizada no backend. Não é necessário mudar o schema
do banco nem a configuração de produção do Render para adicionar esta rota.
Disponibilizar a alteração na API e testar a sessão real continuam pendentes.

## Arquivos

Alterados:

- `src/App.tsx`: conecta o Router com loaders/actions às rotas.
- `src/pages/Login.tsx`: navegação autenticada após sucesso e erros de acesso.
- `src/services/Autenticacao.ts`: login, consulta da sessão e logout.
- `package.json`: comando `npm test`, sem novas dependências.

Criados:

- `src/routes/rotas.tsx`: rotas públicas e protegidas.
- `src/routes/autenticacao.ts`: verificação/redirecionamento e ação de logout.
- `src/types/Autenticacao.ts`: usuário e classes permitidas.
- `src/services/api.ts`: prefixo da API, cookies e erro HTTP tipado.
- `src/components/Carregando.tsx`, `ErroSessao.tsx` e `Navegacao.tsx`: feedback
  durante a verificação e bloqueio da interface em caso de erro.
- `src/pages/PainelAcesso.tsx`: identidade real e logout, sem dashboard fictício.
- `tests/autenticacao.test.mjs`: serviços, Router e renderização estática.
- `tests/backend-me.test.mjs`: teste isolado da rota proposta no patch.
- `docs/backend/me.patch` e este relatório.

## Verificação

```sh
npm test
npm run build
npm run lint
```

Resultados desta entrega:

| Verificação | Resultado |
| --- | --- |
| `npm test` | 47 testes aprovados: 42 de frontend e 5 do patch proposto |
| `npm run build` | Aprovado, incluindo verificação TypeScript (`tsc -b`) |
| `npm run lint` | Aprovado, sem erros |
| `git diff --check` | Aprovado |
| `git apply --check` no backend | Patch aplicável, sem alterar o repositório |
| `GET /me` real no Render, sem credenciais | 404; endpoint ainda ausente |

Os testes usam o executor nativo do Node e o Vite já instalado para carregar os
arquivos TypeScript/TSX. Respostas controladas existem apenas em `tests/`, sem
fallbacks ou dados fictícios no produto. O roteamento é exercitado com
`createMemoryRouter`, e o HTML é inspecionado com `renderToStaticMarkup`.

Cobertura: três classes e URLs distintas; rotas públicas; 401/403/404/429/500;
falha de rede; resposta inválida; carregamento sem conteúdo privado;
revalidação/recuperação e cancelamento; logout confirmado e com falha;
remoção do estado protegido e retorno pelo histórico. O patch é executado
isoladamente, com banco e middleware controlados, cobrindo 200/401/500,
ID vindo da sessão e ausência de senha na resposta.

Isso não testa cookies em um navegador real, o MySQL ou a sessão do Render.
Ainda faltam aplicar `/me`, fazer login com contas autorizadas das três classes,
atualizar cada painel, tentar URLs de outra classe, testar expiração, sair e
usar Voltar. Nenhum teste com a API autenticada real é declarado concluído.
A revisão visual completa e dos layouts responsivos pertence às próximas etapas.

## Segurança e dependências antes de produção

- Não há tokens, senhas ou identidade persistidos no localStorage/sessionStorage.
  Cookies HttpOnly continuam sob controle do servidor. O frontend apenas
  direciona a navegação; cada operação privada continua exigindo autorização
  no Express.
- O backend usa `secure: true`, `httpOnly: true`, `sameSite: "lax"` e
  `trust proxy: 1`. Essas políticas não foram alteradas. Verificar, no navegador,
  se o cookie é emitido e reenviado pelo proxy no ambiente de desenvolvimento.
  `Secure` depende de HTTPS e da configuração correta do proxy; não remover
  essa proteção como solução automática. A
  [documentação de express-session](https://expressjs.com/en/resources/middleware/session/)
  explica essas condições.
- Não foi encontrado middleware explícito de proteção CSRF no backend examinado.
  Antes de liberar escrita em produção, revisar todas as mutações, inclusive
  login e logout, e implementar proteção no servidor: token CSRF vinculado à
  sessão, com envio em header pelo frontend; validação de `Origin`/`Referer`
  com origens autorizadas e política explícita para headers ausentes; considerar
  Fetch Metadata como camada adicional. O endpoint que fornece o token ainda
  precisa ser definido/implementado. CORS não substitui CSRF, e SameSite é uma
  camada complementar. Referência:
  [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- O login atual não regenera explicitamente a sessão após autenticar. Recomenda-se
  revisar regeneração contra fixação de sessão no backend e testar persistência
  antes de responder. Essa mudança não foi incluída no patch de `/me`.
- `/me` lê a classe atual do banco, mas os middlewares existentes ainda conferem
  a classe salva na sessão no momento do login. Se houver mudança de classe ou
  exclusão do usuário durante a sessão, revisar revogação/atualização das
  permissões no servidor para todas as rotas; a proteção do frontend não resolve
  esse problema.
- O proxy do Vite vale para desenvolvimento. A infraestrutura de produção deve
  manter `/api` sob a mesma origem ou oferecer um proxy equivalente. Nenhuma
  configuração de hospedagem foi alterada.

Próximo passo: revisar A e o patch de `/me`. B começa apenas após aprovação.
