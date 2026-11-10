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

O progresso da ingestão manual e da coleta automatizada aparece em um painel flutuante no canto superior direito, disponível durante a navegação. No envio manual, a porcentagem corresponde aos bytes transferidos do arquivo atual; após a transferência, a barra fica indeterminada enquanto aguarda validação e registro pelo backend. A coleta usa indicador indeterminado e tempo decorrido, pois a API não fornece progresso intermediário. O resultado final permanece visível até ser fechado, respeitando `validation.status` e `file.validation.status`, com acesso à quarentena quando aplicável. Cancelar o envio interrompe a requisição no navegador e os próximos arquivos do lote; não desfaz operações concluídas no servidor. A troca de usuário limpa o painel.

Na ingestão manual e automatizada, a escolha de dicionário permite pesquisar nome, versão ou ID entre os resultados de `GET /fontes/{sourceId}/dicionarios`. No upload, `dictionaryId` é um parâmetro junto de `userId`; na coleta, é um campo do JSON. O modo automático omite esse ID e deixa o backend escolher a versão mais recente. A versão efetivamente utilizada e o resultado são os retornados no relatório de validação, sem presumir aprovação por um HTTP 201.

## Quarentena — BE-05

A área Quarentena consulta `GET /quarentenas` com paginação do servidor (páginas a partir de zero, 20/50/100 registros), status e filtros Todas, Disponíveis (`unassigned=true`) e Minhas análises (`responsibleId` da sessão). Os resultados de ingestões rejeitadas ou parciais oferecem acesso à área, filtrado pelo ID real do arquivo quando disponível.

Na biblioteca Arquivos, o grupo Quarentena cruza a etapa atual com todas as páginas de ocorrências de `GET /quarentenas`, sem filtrar status ou responsável. Cada arquivo é contado uma vez, incluindo rejeições parciais e análises encerradas, com acesso à quarentena filtrada pelo arquivo. A etapa e o local da versão mais recente permanecem separados dessa indicação; encerrar a análise não aprova os registros rejeitados. Falhas na consulta de ocorrências são informadas sem apresentar uma contagem incompleta como definitiva.

A tabela exibe a etapa da versão que segue o fluxo; o grupo Bruta continua incluindo todos os originais permanentes. Para compatibilidade com versões antigas (`BRUTA`, versão maior que 1 e caminho `validada/`), consulta o relatório de validação: somente aprovação integral confirma a exibição como Tratada. Validação parcial e relatórios indisponíveis/inconsistentes ficam explicitamente identificados sem presumir aprovação ou movimentação física. Essa compatibilidade ajusta a exibição, os filtros e as contagens; não altera objetos ou registros no backend. Etapas explícitas de versões atuais continuam sendo respeitadas sem consultas adicionais de relatório.

Os detalhes usam `GET /quarentenas/{id}`. Assumir e resolver usam POST nas ações `/assumir` e `/resolver`; salvar a observação usa PATCH em `/observacao`. O responsável vem do contexto existente e a observação é obrigatória, limitada a 500 bytes UTF-8 com `TextEncoder`, após remover espaços nas extremidades. Conflitos de responsabilidade atualizam lista e detalhes; requisições atrasadas não substituem a análise selecionada. O relatório é consultado pela `validationReportUrl` retornada, usando o mesmo cliente HTTP, e seu conteúdo é renderizado como texto.

Resolver exige confirmação e encerra apenas a análise: não aprova dados rejeitados, não altera o motivo e não substitui o relatório original. Na matriz da interface, o Operador prepara a correção; os demais perfis consultam. Isso não implementa autorização no backend: ele ainda recebe `userId` sem autenticar essa identidade nem restringir por cargo.


## Conectores e formatos de ingestão

A tela Nova ingestão utiliza o catálogo de `GET /fontes/conectores` e suporta os onze produtos automáticos atuais: IBGE Municípios/Biomas, INPE PRODES/Queimadas, ICMBio Unidades de Conservação/Embargos, MMA, FUNAI, INCRA, SFB e IBAMA. CAR/SICAR permanece manual. A compatibilidade da URL da fonte segue os domínios e caminhos aceitos pelo backend.

- **Consultar edições publicadas** chama `GET /fontes/conectores/{product}/edicoes`. O usuário pode selecionar uma edição descoberta ou informar a competência. Não há substituição silenciosa da competência solicitada. Bases sem série histórica usam `ATUAL`; MMA aceita também `AAAA` e `AAAA-MM`.
- **Verificar sem salvar** chama `POST /fontes/conectores/{product}/verificacao` com competência e filtros. Dispensa fonte cadastrada e dicionário, preservando a permissão de acesso à ingestão. Mostra registros, bytes e proveniência e distingue `DISPONIVEL`, `SEM_REGISTROS` e erros do canal oficial. Não cadastra arquivos nem comprova validação pelo dicionário. A operação bloqueia novas coletas/uploads enquanto aguarda a resposta.
- **Modelos de dicionário**, dentro do editor de Dicionários, consultam `GET /fontes/conectores/{product}/dicionario` com competência opcional. Aplicar o modelo preenche o editor; somente **Salvar dicionário** persiste as regras. Edições de biomas exigem 2019 ou 2025. Alterações não salvas continuam protegidas pela confirmação existente.
- O upload manual aceita `.csv`, `.json`, `.geojson`, `.zip` (Shapefile), `.gpkg`, `.tif` e `.tiff`. O backend valida o conteúdo, a camada e o sistema de coordenadas; aceitar a extensão não garante aprovação. GeoTIFF usa metadados/cobertura, sem converter células em vetores.

Na regra atual, aprovação integral pelo dicionário gera `TRATADA`; qualquer falha envia o arquivo inteiro para `QUARENTENA`. Contagens de registros válidos em relatório rejeitado servem para diagnóstico, não indicam um subconjunto disponibilizado. `PARCIAL` permanece reconhecido para leitura de relatórios legados.

O workspace continua usando `/conjuntos/{id}/estrutura`, `/conjuntos/{id}/camadas` e `/arquivos/{id}/geojson`, inclusive para os vetores convertidos pelo backend. Não foi adicionada uma tela de operações espaciais: o uso do Spatial está reservado aos indicadores no workspace. O backend analisado ainda não expõe endpoint de cálculo de indicadores; a aba Medidores mantém o estado de indisponibilidade, sem fórmulas ou resultados simulados no navegador.

### Consulta de camadas no mesmo local

Um clique no mapa abre **Informações do local**, com os atributos de todas as
feições encontradas nas camadas visíveis, agrupados por arquivo e identificados
pela cor da camada. A consulta usa os GeoJSONs já carregados, sem nova requisição
por clique. Polígonos respeitam seus contornos e buracos; pontos e linhas usam
tolerância de 7 pixels, ajustada ao zoom. Geometrias múltiplas e coleções também
são reconhecidas. O ponto consultado fica marcado no mapa.

Ativar/ocultar camadas e concluir carregamentos atualiza o resultado. O painel
informa carregamentos e falhas, oferece acesso progressivo quando há muitas
feições e limpa a consulta ao atualizar/trocar o conjunto. Em telas estreitas,
o explorador cede espaço temporariamente à consulta e volta ao fechar o painel.


## Navegação entre páginas

As sete páginas de trabalho ficam em memória com `KeepAlive` durante a sessão. Voltar pelo menu ou pelo histórico preserva filtros, seleção e a instância do mapa, sem repetir a carga inicial. Login e acesso negado não são mantidos nesse cache. Trocar o usuário ou cargo, ou sair, destrói as instâncias anteriores.

Respostas bem-sucedidas de escrita na API marcam os dados para atualização quando uma página for reativada; consultas e verificações sem persistência não invalidam o cache. Os botões Atualizar continuam disponíveis para consultar mudanças externas. Links com filtros de fonte, arquivo ou conjunto continuam sendo aplicados ao retornar à página correspondente. A confirmação de descarte do dicionário continua removendo as edições não salvas.


## Dicionário gerado a partir do conteúdo

Na Nova ingestão, **Gerar e salvar dicionário** lê o conteúdo de qualquer produto/edição dos conectores compatíveis ou de um arquivo manual selecionado. Não depende de modelo fixo por fonte ou ano, nem da existência de um dicionário anterior. No envio manual, selecione um único arquivo como referência.

A ação salva uma nova versão, mostra os campos/tipos e o resumo de validação, e seleciona explicitamente seu ID para a próxima ingestão. Versões existentes permanecem disponíveis. Geração e ingestão são ações separadas: o envio/coleta posterior valida o conteúdo novamente; na coleta automática há um novo download, pois não há cache temporário de arquivos entre as duas ações.

O Operador pode gerar a cópia pelo conteúdo (`dictionaries.generate`); a edição manual continua restrita ao Gestor (`dictionaries.manage`). Reprovações na análise não são exibidas como aprovação do arquivo. O relatório mostra até 20 ocorrências e orienta a revisão; inferência não define domínios fechados nem unicidade de negócio automaticamente.

Endpoints utilizados: `POST /fontes/{sourceId}/dicionarios/gerar-arquivo` (multipart `file`, parâmetro `userId`) e `POST /fontes/{sourceId}/dicionarios/gerar-coleta` (produto, competência, filtros e `userId`). A geração não exige `dictionaryId` e retorna a nova versão salva. Erros de estrutura/download ou persistência não geram seleção fictícia no front.
