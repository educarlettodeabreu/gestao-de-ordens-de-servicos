> Esta cópia integra o repositório do backend. As instruções atuais de execução e Render estão no [README principal](../README.md) e em [produção](../docs/producao-render.md). Os relatórios abaixo registram a implementação anterior à integração.

# Gestão de Ordens — frontend

ERP em React, TypeScript e Vite, com painéis de cliente, funcionário e administrador.
A autenticação usa sessões HttpOnly do Express.

```sh
npm ci
npm run dev
```

O proxy de desenvolvimento encaminha `/api` para `https://gestao-de-ordens.onrender.com`
e remove o prefixo. O backend precisa disponibilizar `GET /me` e, para selecionar
funcionários na criação de ordens, `GET /admin/funcionarios`. As implementações
foram adicionadas ao backend local; não foram publicadas automaticamente.

```sh
npm test
npm run build
npm run lint
```

Leia o [relatório das etapas A–F](docs/implementacao-erp.md) para consultar arquivos,
contratos da API, testes opcionais de navegador/Express, limitações e pendências
de segurança e publicação. O [relatório inicial de A](docs/etapa-a.md) fica como
registro da primeira entrega.

Nenhum dado fictício é usado pela aplicação; fixtures ficam somente em `tests/`.
