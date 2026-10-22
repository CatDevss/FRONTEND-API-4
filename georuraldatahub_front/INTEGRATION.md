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

A biblioteca usa uma única busca local por nome, fonte, formato ou SHA-256, sem diferenciar maiúsculas ou acentos. O resumo conta apenas arquivos, fontes e volume efetivamente carregados; falhas parciais das fontes continuam visíveis com as mensagens da API. Os diálogos identificam o arquivo consultado e oferecem nova tentativa em caso de erro. A listagem não presume aprovação nem dispara consultas de validação para preencher indicadores.

## Conjuntos após a ingestão

A tela Conjuntos usa o relacionamento existente em conjunto_arquivo. Um arquivo pode participar de vários conjuntos. O Operador cria um conjunto e adiciona arquivos já recebidos de fontes diferentes.

A tela usa uma única busca local por nome ou número do conjunto, com lista e detalhes lado a lado. Os totais de arquivos/fontes se referem somente ao conjunto cuja estrutura foi carregada. Filtrar a lista não altera o conjunto selecionado. A associação é feita em um diálogo que consulta as fontes somente quando aberto; leitores não dependem desse catálogo para consultar os conjuntos. A criação exige um único envio do formulário e usa o ID do contexto atual; renomeação, exclusão de conjuntos vazios e remoção de vínculos mantêm seus contratos e bloqueios.

- GET/POST `/conjuntos`; PUT `/conjuntos/{id}` envia somente name; POST envia name e userId da sessão.
- GET `/conjuntos/{id}/estrutura` agrupa fontes → arquivos → referências de visualização, incluindo dictionaryId, dictionaryVersion e ingestionId.
- PUT `/conjuntos/{datasetId}/arquivos/{fileId}` associa um arquivo existente, sem corpo.
- DELETE na mesma rota remove apenas o vínculo. Preserva arquivo, versões, relatórios e participação em outros conjuntos.
- DELETE `/conjuntos/{id}` só é oferecido para conjunto vazio; conflitos da API são apresentados.
- Depois de alterar um vínculo, a estrutura e as opções de arquivos são consultadas novamente. As camadas retornadas pela estrutura são renovadas. Ao abrir o mapa, ele consulta novamente as camadas do conjunto.

Associação não equivale a validação, tratamento ou aprovação. Arquivos sem referências permanecem na estrutura. O mapa usa `/conjuntos/{id}/camadas` e `/arquivos/{id}/geojson`, que acessam apenas o conteúdo validado. Essas referências não representam conclusão de tratamento ou publicação por um Gestor.

## Cargos e integração com o login

`src/access/session.ts` centraliza permissões, navegação e o contexto do usuário. O módulo de login, mantido separadamente, deve chamar `setSessionUser(user)` com `{id,name,userType,userStatus}` ao estabelecer o contexto, e `setSessionUser(null)` ao encerrá-lo. O ID deve vir do cadastro real. `allowedNavigation()` fornece as páginas disponíveis. Não há usuário ou cargo padrão; valores inválidos/inativos são recusados. O contexto é apenas em memória.

A implementação não autentica, não verifica senhas, não cria tokens e não persiste credenciais. A LoginView não foi substituída por autenticação simulada. Sem contexto, rotas protegidas levam à página Acesso indisponível. Em desenvolvimento (`import.meta.env.DEV`), há um painel de prévia que usa cadastros ativos de GET `/usuarios` para testar os cargos. Esse painel não aparece em builds de produção.

A prévia guarda somente o ID escolhido no `sessionStorage` da aba. Ao recarregar, consulta novamente os cadastros e restaura o cargo atual da API antes de verificar o acesso à rota. Usuários removidos, inativos ou com cargo inválido não são restaurados. Falhas temporárias oferecem nova tentativa sem apagar a preferência; Sair ou limpar o seletor remove a preferência. Navegar, alternar as abas do workspace ou selecionar novamente o mesmo cadastro não recria a sessão. A troca de cadastro mantém a página atual quando ela é permitida para o novo cargo. Essa persistência se limita à prévia de desenvolvimento; o login de produção continua sendo uma integração separada.

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

## Gestão de fontes e dicionários

A lista de fontes tem busca por nome/URL e atalhos para `/dictionaries?source={id}`. Após cadastrar uma fonte, a interface oferece configurar seu dicionário. O atalho da ingestão também mantém a fonte em contexto.

A tela de dicionários usa um painel com fonte e versões à esquerda e consulta/edição à direita. As versões são ordenadas da mais recente para a mais antiga, e a maior versão é selecionada ao carregar a fonte. Os campos são editados em linhas compactas com tipos descritos em português, obrigatoriedade, unicidade e domínio. Chaves locais das linhas não fazem parte do DTO enviado à API.

Rascunhos podem ser editados ou excluídos com confirmação; versões utilizadas são somente leitura e oferecem criação de nova versão. Criar uma versão já persiste a cópia no backend e pode torná-la a maior versão disponível para ingestão, mesmo com status RASCUNHO. Não há etapa de homologação de dicionário inventada pelo frontend.

A interface confirma o descarte de alterações ao trocar fonte, versão ou página. Erros de gravação mantêm os campos preenchidos e mostram a mensagem da API. Um conflito atualiza o status da versão e bloqueia a edição caso ela tenha sido utilizada. Respostas atrasadas de outra fonte são descartadas.

Verificação em 22/10/2026: testes de restauração da prévia após recarregamento, navegação, indisponibilidade temporária, logout e cargo atual da API; testes da criação, edição, exclusão, versionamento, conflitos e descarte de alterações com componentes Vuetify reais em DOM simulado. A API local estava indisponível e não havia navegador conectado nesta revisão; gravações reais e inspeção visual permanecem pendentes.

As responsabilidades adicionais descritas na matriz do usuário — administração de usuários/permissões, configurações técnicas, aprovação/publicação de versões, quarentena, revalidação, tratamento, indicadores e históricos completos — não foram simuladas com endpoints inexistentes. Devem ser integradas quando seus contratos estiverem disponíveis. A API de fontes desta versão só oferece cadastro e consulta; não foram inventadas operações de edição/exclusão.

## Workspace geográfico

A página `/home` usa o tema Vuetify existente com um explorador compacto inspirado no VS Code: conjunto → fonte → arquivo → camada, abas Mapa e Medidores e uma barra de estado. Arquivos sem referência continuam no explorador. Fontes e arquivos podem ser recolhidos sem perder a seleção do conjunto.

O mapa ocupa o fundo completo da área de visualização. Explorador, abas, ações, mensagens e resumo ficam em painéis flutuantes arredondados com superfícies do tema; só os painéis interativos capturam eventos, permitindo navegar no mapa nas áreas livres. O explorador pode ser ocultado sem desmontar a árvore nem o Leaflet. Em áreas estreitas, ele passa para a parte inferior. Erros da árvore e das camadas continuam acessíveis quando o explorador está oculto.

Os controles de ruas/satélite e zoom ficam no canto inferior direito. Controles e popups usam o tema da aplicação, e as cores das geometrias continuam distintas. O enquadramento das camadas e a ação Ver Paraná consideram as dimensões dos painéis, atualizadas por ResizeObserver, com limite de preenchimento para manter uma área útil em telas pequenas. A alteração visual não troca os serviços de mapas de fundo nem altera os contratos da API.

`src/stores/workspace.ts` mantém no Pinia o conjunto selecionado, a aba ativa, visibilidade e opacidade por conjunto. Essas preferências sobrevivem à saída/retorno à página durante a sessão; não são persistidas no navegador. A troca de usuário limpa o workspace. Instâncias Leaflet, cache de geometria e controladores de requisição ficam fora do Pinia.

Ao selecionar ou atualizar o conjunto, GET `/conjuntos/{id}/estrutura` e GET `/conjuntos/{id}/camadas` são consultados. As referências da árvore são confrontadas com a listagem disponível antes de habilitar uma camada. O frontend não usa objetos brutos como alternativa. As geometrias são carregadas sob demanda por GET `/arquivos/{fileId}/geojson`; desativar a camada a remove do mapa, preservando o cache enquanto a página permanece aberta. Pontos usam circleMarker; linhas e polígonos usam o suporte GeoJSON do Leaflet. Os atributos aparecem em popups construídos com textContent, sem interpretar HTML dos arquivos.

Trocar ou atualizar o conjunto invalida a geração anterior, remove as camadas e aborta pedidos de geometria. Respostas antigas de estrutura, referências ou GeoJSON são descartadas mesmo que um transporte termine após o aborto. Reentrar no workspace atualiza os metadados antes de restaurar as camadas visíveis. O botão Enquadrar camadas usa a extensão combinada das geometrias carregadas e visíveis; Ver Paraná restaura o enquadramento estadual. Redimensionamento e troca de aba invalidam o tamanho do mapa.

O Operador pode associar arquivos pelo diálogo Adicionar arquivos e remover um vínculo pelo explorador. São usados somente PUT/DELETE `/conjuntos/{datasetId}/arquivos/{fileId}`, sem corpo. A estrutura e as referências são renovadas após cada mudança; referências removidas deixam de estar visíveis. O arquivo e suas demais associações são preservados. A página Conjuntos continua responsável pela criação/edição dos conjuntos e oferece Abrir no workspace.

Medidores é uma área informativa: não solicita APIs inexistentes nem calcula indicadores no navegador. As referências disponíveis são prévias de registros aprovados pela validação, sem alegar tratamento concluído ou aprovação de publicação pelo Gestor.

Verificações específicas: testes de estado no Pinia, persistência entre conjuntos, metadados atrasados, associação/desassociação, árvore com arquivos sem camada, abas, erros da API, GeoJSON de pontos/linhas/polígonos, popups seguros, sobreposição, enquadramento e descarte de geometrias antigas. Leaflet é simulado nos testes de ciclo de vida; esses testes não substituem inspeção visual. A API real respondeu 200 em estrutura e camadas do conjunto 41 e em um GeoJSON com 399 feições Polygon/MultiPolygon, sem gravações. Não havia navegador conectado para revisão visual nesta sessão.
