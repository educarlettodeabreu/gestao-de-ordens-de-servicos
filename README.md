# Gestão de Ordens de Serviços

Express e React no mesmo Web Service. O backend atende `/api/*` e entrega o
frontend compilado de `frontend/dist`. O frontend original permanece no seu
[repositório de referência](https://github.com/educarlettodeabreu/gestao-de-ordens-frontend).

Use **Node 24.22.1**, conforme `.node-version` e `engines`.

```sh
npm ci
# Configure seu ambiente privado, usando .env.example como modelo.
npm run build
npm start
```

O Express usa `PORT` ou `3000` localmente, com bind em `0.0.0.0`. `npm start`
inicia somente o Express. O build instala as dependências do frontend pelo
lockfile e gera `frontend/dist`, que não é versionado.

Para desenvolvimento:

```sh
# Terminal 1
npm run dev

# Terminal 2, com certificado local confiável
DEV_HTTPS_KEY=/caminho/localhost.key DEV_HTTPS_CERT=/caminho/localhost.crt npm run dev:frontend
```

O proxy usa `http://127.0.0.1:3000` e preserva `/api`. Ajuste com `API_PROXY_TARGET`
se necessário. Sem certificados, o Vite funciona por HTTP, mas o login com
cookies `Secure` precisa de HTTPS. As proteções dos cookies foram preservadas.

Depois do build:

```sh
npm run lint
npm test
npm run test:http
```

Leia [docs/producao-render.md](docs/producao-render.md) para a configuração exata
do Render, testes de navegador, alterações de rotas e pendências de segurança.
A integração está na branch de revisão `feat/render-mesma-origem`.
