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

### Tratamento e catálogo raster

O envio manual aceita CSV, JSON/GeoJSON, Shapefile em ZIP, GeoPackage e GeoTIFF (`.tif`/`.tiff`), mantendo a seleção de fonte e dicionário. A extensão não substitui a validação do backend; HTTP 201 registra o envio, e o resultado continua sendo `validation.status`.

Em **Arquivos → Tratar / histórico** ou no ícone de tratamento do explorador, o Operador pode iniciar `POST /arquivos/{fileId}/tratamentos`. O ID vem da sessão existente. Para vetores, a interface consulta `GET /conjuntos/{id}/estrutura`, exige associação prévia e envia `datasetId`; para rasters envia apenas `userId`. As regras opcionais de transformação e dissolução ficam omitidas nesta primeira integração. O backend aplica as regras oficiais e limitações geográficas. Não há processamento de dados ou indicadores no navegador.

O histórico paginado usa `GET /arquivos/{fileId}/tratamentos` (páginas a partir de zero), com status, erros, versões, parâmetros e rastreabilidade. Após sucesso ou falha ao iniciar, o histórico é atualizado. Respostas atrasadas são descartadas e o envio bloqueia cliques duplicados. Falhas 400/403/409/422/503 preservam a mensagem retornada pela API.

**Abrir camada no mapa** recupera a execução por `GET /tratamentos/{id}`, verifica o conjunto e o arquivo associado e usa exatamente `GET /camadas/{layerId}/geojson`. O Pinia mantém essas referências e a visibilidade por conjunto, separando IDs de camada dos IDs de arquivo. As referências existentes por `GET /arquivos/{id}/geojson` continuam mostrando a visualização mais recente do arquivo. Tratamento concluído não implica publicação nem aprovação por um Gestor.

O catálogo **Rasters** consulta `GET /rasters` com paginação e filtro opcional `bbox=oeste,sul,leste,norte` em EPSG:4326. `GET /rasters/{id}` fornece os metadados, bandas e `metadata.summary.footprint` para o contorno de cobertura no Leaflet. Isso não renderiza a imagem GeoTIFF nem lê ou transforma pixels. `location`, `quarantineLocation` e `quarantineReportLocation` são identificadores internos do bucket, exibidos como texto, sem links públicos. As referências de quarentena são consultadas por `GET /quarentenas?fileId=...` junto aos relatórios PARCIAL/REJEITADO.

A configuração da API permanece em `VITE_API_BASE_URL`, sem proxy Vite ou cópia de credenciais. O catálogo e o tratamento podem retornar 503 quando a persistência do backend estiver desativada. A interface não aplica migrações nem altera o schema. A matriz de perfis só organiza a interface; enviar `userId` não implementa autenticação ou autorização no backend. A homologação completa de Oracle/OCI e dos conversores continua necessária.
