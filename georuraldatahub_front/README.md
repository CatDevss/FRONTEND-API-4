# georuraldatahub_front

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Integração com o backend

A URL acessível pelo navegador é configurada em `VITE_API_BASE_URL`. O Vite não configura proxy; o backend deve permitir a origem do frontend por CORS. Variáveis `VITE_*` são públicas e não devem conter credenciais.

Na ingestão manual e automatizada, a escolha de dicionário permite pesquisar nome, versão ou ID entre os resultados de `GET /fontes/{sourceId}/dicionarios`. No upload, `dictionaryId` é um parâmetro junto de `userId`; na coleta, é um campo do JSON. O modo automático omite esse ID e deixa o backend escolher a versão mais recente. A versão efetivamente utilizada e o resultado são os retornados no relatório de validação, sem presumir aprovação por um HTTP 201.

## Quarentena — BE-05

A área Quarentena consulta `GET /quarentenas` com paginação do servidor (páginas a partir de zero, 20/50/100 registros), status e filtros Todas, Disponíveis (`unassigned=true`) e Minhas análises (`responsibleId` da sessão). Os resultados de ingestões rejeitadas ou parciais oferecem acesso à área, filtrado pelo ID real do arquivo quando disponível.

Os detalhes usam `GET /quarentenas/{id}`. Assumir e resolver usam POST nas ações `/assumir` e `/resolver`; salvar a observação usa PATCH em `/observacao`. O responsável vem do contexto existente e a observação é obrigatória, limitada a 500 bytes UTF-8 com `TextEncoder`, após remover espaços nas extremidades. Conflitos de responsabilidade atualizam lista e detalhes; requisições atrasadas não substituem a análise selecionada. O relatório é consultado pela `validationReportUrl` retornada, usando o mesmo cliente HTTP, e seu conteúdo é renderizado como texto.

Resolver exige confirmação e encerra apenas a análise: não aprova dados rejeitados, não altera o motivo e não substitui o relatório original. Na matriz da interface, o Operador prepara a correção; os demais perfis consultam. Isso não implementa autorização no backend: ele ainda recebe `userId` sem autenticar essa identidade nem restringir por cargo.
