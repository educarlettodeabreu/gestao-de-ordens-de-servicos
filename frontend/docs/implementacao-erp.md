# Implementação do ERP — etapas A a F

Implementação local concluída para as funcionalidades existentes na API.
**A integração autenticada com o MySQL/Render real ainda exige publicar as duas
rotas novas e validar com contas autorizadas.** Não foi feito commit, push ou
deploy, nem instalada biblioteca. A configuração do Render e o proxy do Vite
permaneceram inalterados.

## 1. Arquivos criados e alterados

No frontend, incluindo a etapa A anterior:

| Área | Arquivos |
| --- | --- |
| Inicialização e roteamento | `src/App.tsx`, `src/main.tsx`, `index.html`, `src/routes/rotas.tsx`, `src/routes/autenticacao.ts` |
| Páginas | `src/pages/Login.tsx`, `src/pages/Cadastro.tsx`, `src/pages/Cliente.tsx`, `src/pages/Funcionario.tsx`, `src/pages/Admin.tsx` |
| Layout e estilos | `src/layouts/DashboardLayout.tsx`, `src/dashboard.css` |
| Componentes | `src/components/Header.tsx`, `Sidebar.tsx`, `Icone.tsx`, `Navegacao.tsx`, `Carregando.tsx`, `ErroSessao.tsx`, `EstadoConsulta.tsx`, `Indicadores.tsx`, `ListaOrdens.tsx`, `Dialogo.tsx` |
| API e tipos | `src/services/api.ts`, `src/services/Autenticacao.ts`, `src/services/ERP.ts`, `src/types/Autenticacao.ts`, `src/types/ERP.ts` |
| Consulta e apresentação | `src/hooks/useConsulta.ts`, `src/utils/formatacao.ts` |
| Testes | `tests/autenticacao.test.mjs`, `erp.test.mjs`, `backend-me.test.mjs`, `backend-funcionarios.test.mjs`, `browser-check.mjs`, `backend-http.mjs`, `package.json` |
| Documentação | Este relatório, `docs/etapa-a.md`, `docs/backend/me.patch`, `docs/backend/funcionarios.patch`, `README.md` |

`Cadastro.tsx` teve somente a remoção do viewport duplicado: essa meta agora fica
em `index.html` e atende todas as páginas. O cadastro público e seu serviço
continuam funcionando como antes. `src/index.css` não foi reescrito. A tela mínima
`PainelAcesso.tsx`, criada em A, foi substituída pelos três painéis completos.

No backend local `../gestaoordens`, foi alterado **somente `app.js`**, adicionando
`GET /me` e `GET /admin/funcionarios` após autorização de escrita fora do workspace.
Os patches no frontend preservam as mesmas alterações para revisão. O backend
de referência no GitHub foi conferido no commit
`245e8a20d7f46f3b95aa79af699340de07f60920`.

## 2. Funcionalidades concluídas

| Etapa | Entrega |
| --- | --- |
| A | Sessão por cookie, consulta `/me`, redirecionamento por classe, rotas protegidas, loading, erros e logout confirmado |
| B | Layout compartilhado, sidebar com links para as seções de cada classe, header com usuário/classe/logout, menu móvel, cards, tabelas e diálogos acessíveis |
| C | Serviços disponíveis, formulário de solicitação, solicitações próprias, ordens próprias, indicadores reais, carregamento, erro, repetição e listas vazias |
| D | Ordens atribuídas, descrição, datas, detalhes, filtro local e contagens dos status efetivamente retornados; sem ações de edição |
| E | Serviços: listagem, cadastro e exclusão por nome com confirmação; solicitações: consulta e conversão em ordem; ordens: consulta, filtro local, status e exclusão por ID com confirmação |
| F | Build/TypeScript, lint, testes automatizados, testes no navegador, testes HTTP do Express e revisão das limitações de produção |

Os painéis usam somente dados das respostas da API. Dados de exemplo existem
apenas nos testes. Antes do carregamento, os indicadores mostram `—`, sem
representar indisponibilidade como quantidade zero. Datas ausentes/inválidas
são apresentadas como não informadas. Os textos retornados são renderizados
como texto do React, sem HTML arbitrário.

Chamadas implementadas:

| Perfil | Endpoints usados pelo frontend, sempre com prefixo `/api` |
| --- | --- |
| Autenticação | `POST /login`, `GET /me`, `POST /logout` |
| Cliente | `GET /servicos`, `POST /solicitacoes`, `GET /minhassolicitacoes`, `GET /minhasordens` |
| Funcionário | `GET /funcionario/ordens` |
| Administrador | `GET/POST /servicos`, `DELETE /servicos/delet`, `GET /consulsolicitacoes`, `GET /consultOrdens`, `POST /ordem`, `PATCH /ordem/status`, `DELETE /ordem/:id`, `GET /admin/funcionarios` |

Solicitações enviam somente `{ servicoid, descricao }`; a propriedade do cliente
é determinada no backend pela sessão. Serviços usam `{ nome }`, criação de
ordens usa `{ solicitacao_id, funcionarios }`, e status usa `{ ordem, status }`.
Não se envia classe de usuário nem ID de cliente para determinar acesso privado.

Os filtros de status são locais, sobre a lista real recebida; `/consultOrdens`
continua compatível com a API existente sem parâmetros. Como o banco usa
`VARCHAR(30)` e o backend não define enum de status, o administrador pode
informar até 30 caracteres. As sugestões vêm dos status reais e do padrão
`aberta` existente no schema. Não foram inventados valores obrigatórios.

Operações bem-sucedidas recarregam as listas afetadas. Falhas não exibem sucesso
nem removem registros antecipadamente. Exclusões exigem um diálogo de
confirmação; cancelar não chama a API. Formulários ficam desabilitados durante
envio. Não há repetição automática de escritas após erro de rede/servidor.

## 3. Backend e dependências restantes

As duas rotas complementares foram implementadas no backend local:

- `/me`: exige autenticação, consulta pelo ID da sessão e retorna apenas `id`,
  `nome`, `email`, `classe`. Usuário excluído/sessão inválida: 401; erro interno:
  500; resposta com `Cache-Control: no-store`.
- `/admin/funcionarios`: exige autenticação e o middleware administrativo
  existente, filtra `classe = 'funcionario'` e retorna somente `id`, `nome`,
  `email`, ordenados por nome e ID. Não retorna senha ou hash.

No Render, as consultas sem credenciais a **ambas retornaram 404** na revisão
final; uma tentativa de `/me` expirou antes de a repetição confirmar o 404.
A publicação do backend continua pendente porque não foi autorizado deploy.
Até isso ocorrer, o frontend exibe indisponibilidade da verificação de sessão.

Se a seleção de funcionários retornar 404 ou outro erro, a interface informa a
indisponibilidade, permite repetir a consulta e continua permitindo criar ordens
com `funcionarios: []`. Não há funcionários fictícios. Depois de disponibilizar
a rota, a atribuição usa os IDs realmente recebidos.

Não foram implementadas ações sem suporte da API: funcionário não altera status;
não há gestão completa de usuários, edição/reatribuição posterior de equipes ou
listagens de usuários inventadas. A solicitação original permite essas limitações.

## 4. Resultados de testes

| Verificação | Resultado e alcance |
| --- | --- |
| `npm run build` | Aprovado; inclui `tsc -b` e bundle Vite |
| `npm run lint` | Aprovado, sem erros |
| `npm test` | 88 testes aprovados: autenticação/roteamento, contratos HTTP, validação das respostas, contagens e rotas novas isoladas |
| Navegador headless | 42 verificações aprovadas; sem exceções JavaScript; API interceptada exclusivamente no teste |
| HTTP com backend real | 28 verificações aprovadas; `app.js`, Express, bcrypt e express-session reais; banco e armazenamento MySQL substituídos por dados/MemoryStore somente no teste |
| `node --check ../gestaoordens/app.js` | Aprovado |
| `git diff --check` nos dois repositórios | Aprovado |
| Render sem credenciais | `/me` e `/admin/funcionarios`: 404 |

O navegador exercitou login e navegação por classe, solicitação de serviço,
filtros e detalhes, cadastro e exclusão de serviços, cancelamento de exclusão,
criação de ordens sem equipe e com equipe, alteração de status, exclusão com
erro e nova tentativa, logout com falha e sucesso, listas vazias, 401/500 e
verificação pendente sem consulta antecipada dos dados privados.

A revisão visual cobriu desktop (1440px), tablet (768px) e celular (375px/360px),
menu móvel e ausência de overflow da página. Tabelas largas rolam dentro do seu
próprio contêiner; a interface informa essa possibilidade no celular. Capturas
de teste ficam em `/tmp/erp-dashboards/` e contêm somente fixtures identificadas
como teste. Nenhum dado desses arquivos é enviado ao produto.

O teste HTTP verificou cookies HttpOnly/Secure/SameSite=Lax emitidos pelo Express,
login, leitura da sessão, seleção de funcionários, bloqueios 401/403, 500,
usuário excluído, propriedade pelo ID da sessão e destruição da sessão no logout.
Para reproduzir as condições de proxy sem alterar políticas, enviou
`X-Forwarded-Proto: https` no login e reapresentou o cookie explicitamente.
Isso **não comprova** armazenamento/reenvio automático dos cookies no navegador
contra o Render real nem a persistência do MySQL.

Comandos comuns:

```sh
npm test
npm run build
npm run lint
```

Testes opcionais aproveitam ferramentas já instaladas fora deste frontend:

```sh
# Requer as dependências já instaladas no repositório real do backend.
npm run test:backend -- ../gestaoordens

# Caminhos locais de um Playwright e Chromium/Brave já disponíveis.
npm run test:browser -- /caminho/playwright-core/index.js /caminho/navegador
```

Também são aceitas as variáveis `ERP_BACKEND_DIR`, `ERP_PLAYWRIGHT_PATH`,
`ERP_BROWSER_EXECUTABLE` e `ERP_SCREENSHOT_DIR`. Nenhuma dependência de testes
foi adicionada ao package.json além das ferramentas que o projeto já possuía.
Os testes opcionais precisam de permissão para abrir portas locais/navegador.

## 5. Segurança e limites antes de produção

- Autenticação segue no cookie HttpOnly; não há tokens/credenciais no
  localStorage/sessionStorage. As chamadas privadas usam `same-origin` e
  `no-store`. A classe da sessão retornada pela API determina a navegação.
- Guardas do React não substituem os middlewares do Express. Políticas de
  cookie, `trust proxy`, classes e permissões existentes não foram alteradas.
- O backend examinado não tem proteção CSRF explícita. Antes de liberar escrita
  em produção, implementar e testar proteção no servidor, com token vinculado
  à sessão e envio em header pelo frontend; validar Origin/Referer contra origens
  autorizadas e definir política para headers ausentes. SameSite é uma camada
  complementar; CORS não substitui CSRF. Referência:
  [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- O login existente ainda não regenera explicitamente a sessão. Rever proteção
  contra fixação de sessão e confirmar a persistência antes da resposta de
  sucesso; ver [express-session](https://expressjs.com/en/resources/middleware/session/).
- `/me` lê a classe atual do banco, mas os outros middlewares conferem a classe
  armazenada na sessão no login. Revisar revogação de acesso e mudanças de classe
  em sessões existentes no servidor; o frontend não resolve essa divergência.
- O `POST /ordem` existente não é transacional: pode inserir uma ordem e falhar
  depois na atribuição/exclusão da solicitação. Por isso, um 500 não garante que
  nada foi alterado. A interface informa que é preciso atualizar os dados antes
  de repetir. Recomenda-se transação, validação dos funcionários no servidor e
  prevenção de criação duplicada antes de produção.
- Exclusão de serviço vinculado pode ser recusada por chave estrangeira e
  responder 500. A interface preserva o registro e mostra a falha; não supõe uma
  resposta 409 que o backend não implementa.
- O proxy do Vite vale para desenvolvimento. Em produção, `/api` precisa
  continuar na mesma origem através da infraestrutura apropriada. A política
  Secure e o reenvio do cookie devem ser verificados no ambiente real.

## 6. Próximos passos

1. Revisar as alterações locais dos dois repositórios e publicar as duas rotas
   complementares quando autorizado. Nenhum commit/push/deploy foi feito aqui.
2. Validar com contas reais das três classes, MySQL e cookie do Render: login,
   atualização de página, URLs de outra classe, expiração, logout e Voltar.
3. Confirmar os fluxos de escrita em uma base de homologação e implementar as
   proteções CSRF e ajustes de consistência acima antes de declarar produção pronta.

As etapas de implementação foram concluídas no escopo local e verificável. A
publicação e a homologação real são pendências explícitas, sem autenticação
simulada ou fallback no código da aplicação.
