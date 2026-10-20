# Integração do frontend com BE-03, BE-04 e conjuntos

## Ambiente e contratos

O `.env` local usa `VITE_API_BASE_URL=http://localhost:8080`. O Vite não configura proxy: o navegador acessa essa API diretamente. Em outra máquina, use a URL acessível pelo navegador. Não copie credenciais Oracle/OCI para variáveis `VITE_*`.

O novo `BACKEND-API-4.zip` foi extraído apenas para leitura fora do frontend. Foram consultados README, controladores, DTOs e serviços, incluindo SourceFileController, DatasetFileController, DatasetStructureController, DictionaryService, FileService, DatasetFileService, DatasetStructureService e CollectionService. Backend e schema não foram alterados.

Em 20/10/2026, a API local respondeu 200 em GET `/fontes/2/arquivos` e GET `/conjuntos/41/estrutura`. Os preflights de POST no upload por fonte e PUT na associação passaram com origem `http://127.0.0.1:5173` e `Access-Control-Allow-Origin: *`. Verificações anteriores também cobriram catálogo, fontes, usuários, relatórios, metadados de coleta e CORS de DELETE. Não foram efetuadas gravações nesses ensaios reais.

## Ingestão sem conjunto

A tela Nova ingestão pede a modalidade: manual ou automática. O responsável vem do contexto de sessão; não há seleção de responsável nem de conjunto nessa tela.

- Manual: POST `/fontes/{sourceId}/arquivos`, multipart `file`, parâmetro userId do contexto. Somente CSV e GeoJSON. Cada arquivo gera uma ingestão própria.
- Automática: GET `/fontes/conectores` e POST `/fontes/{sourceId}/coletas` com product, userId, competence e filtros compatíveis. O frontend omite datasetId. Os quatro produtos homologados no contrato são IBGE_MUNICIPIOS, IBGE_BIOMAS, INPE_PRODES e INPE_QUEIMADAS, com escopo Paraná. Agendamento continua no backend.
- A fonte é preenchida se houver uma única URL compatível com o órgão. Múltiplas opções exigem escolha; nenhuma bloqueia a coleta. O catálogo não fornece vínculo produto–sourceId; não são criados IDs ou fontes ocultas.
- O backend seleciona a maior versão do dicionário da fonte. Dicionários utilizados não podem ser editados/excluídos. Não há operação de publicação de dicionário presumida pelo frontend.
- HTTP 201 não é aprovação: upload usa validation.status e coleta usa file.validation.status. VALIDO, PARCIAL e REJEITADO são exibidos com contagens, versão, conteúdo e erros por registro. Relatório ausente permanece sem aprovação presumida.

A lista Arquivos por fonte usa GET `/fontes` e GET `/fontes/{sourceId}/arquivos`, incluindo arquivos sem conjunto. GET `/arquivos/{id}/validacao` consulta o relatório; GET `/arquivos/{id}/coleta` consulta proveniência, quando se trata de coleta automática. A listagem não contém o relatório completo. Datas receivedDate de LocalDateTime são mostradas sem presumir offset de origem.

## Conjuntos após a ingestão

A tela Conjuntos usa o relacionamento existente em conjunto_arquivo. Um arquivo pode participar de vários conjuntos. O Operador cria um conjunto e adiciona arquivos já recebidos de fontes diferentes.

- GET/POST `/conjuntos`; PUT `/conjuntos/{id}` envia somente name; POST envia name e userId da sessão.
- GET `/conjuntos/{id}/estrutura` agrupa fontes → arquivos → referências de visualização, incluindo dictionaryId, dictionaryVersion e ingestionId.
- PUT `/conjuntos/{datasetId}/arquivos/{fileId}` associa um arquivo existente, sem corpo.
- DELETE na mesma rota remove apenas o vínculo. Preserva arquivo, versões, relatórios e participação em outros conjuntos.
- DELETE `/conjuntos/{id}` só é oferecido para conjunto vazio; conflitos da API são apresentados.
- Depois de alterar um vínculo, a estrutura e as opções de arquivos são consultadas novamente. As camadas retornadas pela estrutura são renovadas. Ao abrir o mapa, ele consulta novamente as camadas do conjunto.

Associação não equivale a validação, tratamento ou aprovação. Arquivos sem referências permanecem na estrutura. O mapa usa `/conjuntos/{id}/camadas` e `/arquivos/{id}/geojson`, que acessam apenas o conteúdo validado. Essas referências não representam conclusão de tratamento ou publicação por um Gestor.

## Cargos e integração com o login

`src/access/session.ts` centraliza permissões, navegação e o contexto do usuário. O módulo de login, mantido separadamente, deve chamar `setSessionUser(user)` com `{id,name,userType,userStatus}` ao estabelecer o contexto, e `setSessionUser(null)` ao encerrá-lo. O ID deve vir do cadastro real. `allowedNavigation()` fornece as páginas disponíveis. Não há usuário ou cargo padrão; valores inválidos/inativos são recusados. O contexto é apenas em memória.

A implementação não autentica, não verifica senhas, não cria tokens e não persiste credenciais. A LoginView não foi substituída por autenticação simulada. Sem contexto, rotas protegidas levam à página Acesso indisponível. Em desenvolvimento (`import.meta.env.DEV`), há um painel explicitamente marcado como prévia que usa cadastros ativos de GET `/usuarios` para testar os cargos. Esse painel não aparece em builds de produção.

| Cargo | Funcionalidades disponíveis neste escopo |
| --- | --- |
| ADMIN | Consulta de fontes e arquivos para acompanhamento técnico. Não herda gestão ou aprovação de negócio. |
| GESTOR | Cadastro de fontes; consulta e gestão de dicionários; consulta de arquivos, conjuntos e mapa. |
| OPERADOR | Ingestão manual/automática; criação/renomeação/exclusão de conjuntos vazios e gestão dos vínculos; consultas de dados e dicionários. |
| ANALISTA | Consulta de conjuntos, mapa, fontes, arquivos e regras. Sem alteração de arquivos brutos ou aprovação. |
| AUDITOR | Consulta de arquivos, fontes, dicionários, estrutura, versões de regras, hashes, validação e proveniência. Sem gravações. |

Menus e rotas usam a mesma matriz; métodos de gravação também conferem a permissão e, quando aplicável, o usuário do contexto. A troca de contexto remonta as telas para evitar preservar um editor do usuário anterior. O painel de prévia impede troca durante ingestão/coleta. O cadastro de fontes fica separado da ingestão e disponível ao Gestor.

Isso organiza a interface por cargos; não é autorização da API. O backend fornecido ainda permite requisições sem autenticação. A proteção efetiva e a identidade confiável deverão ser integradas pelas equipes de login/backend. A escolha de cadastro na prévia não prova identidade.

## Verificação e pendências

Execute `npm ci`, `npm run build`, `npm run test:unit -- --run` e `npx eslint .`. Os testes de frontend cobrem permissões dos cinco cargos, menus e rotas diretas, ausência de contexto, métodos protegidos, ingestão sem conjunto, payloads dos quatro conectores, status de validação, identificação de fontes e associação/desassociação sem upload.

Permanecem pendentes a integração com o login real, autorização no servidor, revisão visual em navegador conectado e gravações ponta a ponta em homologação Oracle/OCI. As verificações reais descritas acima são de leitura e preflight; testes simulados não homologam persistência, triggers ou serviços oficiais.

As responsabilidades adicionais descritas na matriz do usuário — administração de usuários/permissões, configurações técnicas, aprovação/publicação de versões, quarentena, revalidação, tratamento, indicadores e históricos completos — não foram simuladas com endpoints inexistentes. Devem ser integradas quando seus contratos estiverem disponíveis. A API de fontes desta versão só oferece cadastro e consulta; não foram inventadas operações de edição/exclusão.

## Workspace geográfico

A página `/home` usa o tema Vuetify existente com um explorador compacto inspirado no VS Code: conjunto → fonte → arquivo → camada, abas Mapa e Medidores e uma barra de estado. Arquivos sem referência continuam no explorador. Fontes e arquivos podem ser recolhidos sem perder a seleção do conjunto.

`src/stores/workspace.ts` mantém no Pinia o conjunto selecionado, a aba ativa, visibilidade e opacidade por conjunto. Essas preferências sobrevivem à saída/retorno à página durante a sessão; não são persistidas no navegador. A troca de usuário limpa o workspace. Instâncias Leaflet, cache de geometria e controladores de requisição ficam fora do Pinia.

Ao selecionar ou atualizar o conjunto, GET `/conjuntos/{id}/estrutura` e GET `/conjuntos/{id}/camadas` são consultados. As referências da árvore são confrontadas com a listagem disponível antes de habilitar uma camada. O frontend não usa objetos brutos como alternativa. As geometrias são carregadas sob demanda por GET `/arquivos/{fileId}/geojson`; desativar a camada a remove do mapa, preservando o cache enquanto a página permanece aberta. Pontos usam circleMarker; linhas e polígonos usam o suporte GeoJSON do Leaflet. Os atributos aparecem em popups construídos com textContent, sem interpretar HTML dos arquivos.

Trocar ou atualizar o conjunto invalida a geração anterior, remove as camadas e aborta pedidos de geometria. Respostas antigas de estrutura, referências ou GeoJSON são descartadas mesmo que um transporte termine após o aborto. Reentrar no workspace atualiza os metadados antes de restaurar as camadas visíveis. O botão Enquadrar camadas usa a extensão combinada das geometrias carregadas e visíveis; Ver Paraná restaura o enquadramento estadual. Redimensionamento e troca de aba invalidam o tamanho do mapa.

O Operador pode associar arquivos pelo diálogo Adicionar arquivos e remover um vínculo pelo explorador. São usados somente PUT/DELETE `/conjuntos/{datasetId}/arquivos/{fileId}`, sem corpo. A estrutura e as referências são renovadas após cada mudança; referências removidas deixam de estar visíveis. O arquivo e suas demais associações são preservados. A página Conjuntos continua responsável pela criação/edição dos conjuntos e oferece Abrir no workspace.

Medidores é uma área informativa: não solicita APIs inexistentes nem calcula indicadores no navegador. As referências disponíveis são prévias de registros aprovados pela validação, sem alegar tratamento concluído ou aprovação de publicação pelo Gestor.

Verificações específicas: testes de estado no Pinia, persistência entre conjuntos, metadados atrasados, associação/desassociação, árvore com arquivos sem camada, abas, erros da API, GeoJSON de pontos/linhas/polígonos, popups seguros, sobreposição, enquadramento e descarte de geometrias antigas. Leaflet é simulado nos testes de ciclo de vida; esses testes não substituem inspeção visual. A API real respondeu 200 em estrutura e camadas do conjunto 41 e em um GeoJSON com 399 feições Polygon/MultiPolygon, sem gravações. Não havia navegador conectado para revisão visual nesta sessão.
