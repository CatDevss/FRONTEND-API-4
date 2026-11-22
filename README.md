<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<p align="center">
  <img src="https://raw.githubusercontent.com/CatDevss/API-4/main/Docs/assets/Banner_Visiona.jpg" alt="Banner" width="900">
</p>

<h1 align="center">⌞ Manual de Instalação · Frontend ⌝</h1>

<p align="center">
  Guia de configuração, instalação de dependências, execução e validação da interface web do
  <strong>GeoRural DataHub</strong>, desenvolvida em parceria com a <strong>Visiona Tecnologia Espacial</strong>.
</p>

<p align="center">
  <sub>Aprendizagem por Projetos Integrados · 2026-2 &nbsp;|&nbsp; 4º Semestre - Banco de Dados &nbsp;|&nbsp; FATEC São José dos Campos</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/modulo-frontend_web-FE5000?style=for-the-badge&logoColor=white" alt="módulo" />
  <img src="https://img.shields.io/badge/node-22.18%2B_%7C_24.12%2B-2D2D2D?style=for-the-badge&logo=nodedotjs&logoColor=FFA300" alt="node" />
</p>

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/list-details.svg?color=%23FFFFFF" width="20" /> Sumário</h2>

<br>

<div align="center">

<table align="center" width="100%">
  <tr>
    <td width="50%" valign="top">
      <p>
        <img src="https://api.iconify.design/tabler/tool.svg?color=%23FFFFFF" width="16" />
        <a href="#-pré-requisitos">Pré-requisitos</a>
      </p>
      <p>
        <img src="https://api.iconify.design/tabler/git-branch.svg?color=%23FFFFFF" width="16" />
        <a href="#-clonagem-e-estrutura">Clonagem e Estrutura</a>
      </p>
      <p>
        <img src="https://api.iconify.design/tabler/settings.svg?color=%23FFFFFF" width="16" />
        <a href="#-variáveis-de-ambiente">Variáveis de Ambiente</a>
      </p>
      <p>
        <img src="https://api.iconify.design/tabler/package.svg?color=%23FFFFFF" width="16" />
        <a href="#-instalação-de-dependências">Instalação de Dependências</a>
      </p>
    </td>
    <td width="50%" valign="top">
      <p>
        <img src="https://api.iconify.design/tabler/player-play.svg?color=%23FFFFFF" width="16" />
        <a href="#-execução-local-e-build">Execução Local e Build</a>
      </p>
      <p>
        <img src="https://api.iconify.design/tabler/terminal-2.svg?color=%23FFFFFF" width="16" />
        <a href="#-scripts-e-qualidade-de-código">Scripts e Qualidade de Código</a>
      </p>
      <p>
        <img src="https://api.iconify.design/tabler/circle-check.svg?color=%23FFFFFF" width="16" />
        <a href="#-validação-do-ambiente">Validação do Ambiente</a>
      </p>
      <p>
        <img src="https://api.iconify.design/tabler/alert-triangle.svg?color=%23FFFFFF" width="16" />
        <a href="#-problemas-comuns">Problemas Comuns</a>
      </p>
    </td>
  </tr>
</table>

</div>

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/tool.svg?color=%23FFFFFF" width="20" /> Pré-requisitos</h2>

<br>

<p align="center">
  Para rodar o frontend localmente sem conflitos de runtime ou dependências, prepare o ambiente com os itens abaixo.
</p>

<br>

<div align="center">

<table>
  <tr>
    <td align="center" width="50%" valign="top">
      <img width="60" height="3" src="https://placehold.co/60x3/FE5000/FE5000.png"/>
      <br><strong>AMBIENTE E FERRAMENTAS</strong><br><br>
      <sub>
      <img src="https://api.iconify.design/tabler/brand-nodejs.svg?color=%23FFFFFF" width="16" /> <strong>Node.js</strong> - versões <code>^22.18.0</code> ou <code>>=24.12.0</code> conforme o <code>package.json</code><br><br>
      <img src="https://api.iconify.design/tabler/package.svg?color=%23FFFFFF" width="16" /> <strong>npm</strong> - gerenciador de pacotes compatível com Node.js 22 / 24<br><br>
      <img src="https://api.iconify.design/tabler/git-branch.svg?color=%23FFFFFF" width="16" /> <strong>Git</strong> - para clonar o repositório e acompanhar branches
      </sub>
    </td>
    <td align="center" width="50%" valign="top">
      <img width="60" height="3" src="https://placehold.co/60x3/FFA300/FFA300.png"/>
      <br><strong>SERVIÇOS E INTEGRAÇÃO</strong><br><br>
      <sub>
      <img src="https://api.iconify.design/tabler/server.svg?color=%23FFFFFF" width="16" /> <strong>Backend API</strong> - serviço REST disponível (padrão local em <code>http://localhost:8080</code>)<br><br>
      <img src="https://api.iconify.design/tabler/world.svg?color=%23FFFFFF" width="16" /> <strong>Navegador moderno</strong> - com suporte a WebGL/Canvas para mapas Leaflet e gráficos<br><br>
      <img src="https://api.iconify.design/tabler/plug.svg?color=%23FFFFFF" width="16" /> <strong>CORS habilitado</strong> - origem do frontend liberada na API para requisições via Axios
      </sub>
    </td>
  </tr>
</table>

</div>

<br>

> *Confira as versões instaladas no terminal antes de começar: `node -v`, `npm -v` e `git --version`.*

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/git-branch.svg?color=%23FFFFFF" width="20" /> Clonagem e Estrutura</h2>

<br>

<p align="center">
  Obtenha o código-fonte do repositório de frontend e entre no diretório do projeto.
</p>

<br>

```bash
git clone [https://github.com/CatDevss/FRONTEND-API-4.git](https://github.com/CatDevss/FRONTEND-API-4.git)
cd FRONTEND-API-4
```

<br>

<div align="center">

| Arquivo / Pasta | Função no Projeto |
| --- | --- |
| `package.json` | Define scripts (`dev`, `build`, `preview`, `test:unit`, `type-check`, `lint`, `format`), dependências e engines do Node.js |
| `vite.config.ts` | Configura plugins (`@vitejs/plugin-vue`, `vite-plugin-vue-devtools`, `vite-plugin-vuetify`) e o alias `@` apontando para `src/` |
| `.env` | Armazena variáveis de ambiente carregadas pelo Vite (como `VITE_API_BASE_URL`) |
| `src/` | Contém componentes, rotas, stores Pinia, serviços HTTP (Axios), telas e estilos |
| `index.html` | Template HTML raiz da aplicação |

</div>

<br>

> *O alias `@` em `vite.config.ts` mapeia diretamente para `./src`, facilitando importações internas no código TypeScript/Vue.*

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/settings.svg?color=%23FFFFFF" width="20" /> Variáveis de Ambiente</h2>

<br>

<p align="center">
  O frontend utiliza variáveis prefixadas com <code>VITE_</code> para expor configurações à aplicação em tempo de execução/build.
</p>

<br>

```env
VITE_API_BASE_URL=http://localhost:8080
```

<br>

<div align="center">

| Variável | Exemplo / Padrão | Descrição |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8080` | URL base da API backend consumida pelas chamadas HTTP da aplicação |

</div>

<br>

> *Se o arquivo `.env` não existir na raiz do projeto, crie-o com `VITE_API_BASE_URL` apontando para o backend local ou para o endereço exposto na Oracle Cloud.*

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/package.svg?color=%23FFFFFF" width="20" /> Instalação de Dependências</h2>

<br>

<p align="center">
  Instale as dependências de produção (<code>vue</code>, <code>vue-router</code>, <code>pinia</code>, <code>vuetify</code>, <code>@mdi/font</code>, <code>axios</code>, <code>leaflet</code>) e de desenvolvimento (<code>vite</code>, <code>vitest</code>, <code>vue-tsc</code>, <code>typescript</code>, <code>eslint</code>, <code>oxlint</code>, <code>prettier</code>).
</p>

<br>

```bash
npm install
```

<br>

> *Caso o ambiente tenha `package-lock.json` sincronizado em CI/CD ou contêineres, você também pode utilizar `npm ci` para instalação limpa.*

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/player-play.svg?color=%23FFFFFF" width="20" /> Execução Local e Build</h2>

<br>

<p align="center">
  Escolha o fluxo de execução conforme a etapa do desenvolvimento ou teste.
</p>

<br>

<div align="center">

<table>
  <tr>
    <td align="center" width="50%" valign="top">
      <img width="60" height="3" src="https://placehold.co/60x3/FE5000/FE5000.png"/>
      <br><strong>DESENVOLVIMENTO (VITE)</strong><br><br>
      <sub>
      <img src="https://api.iconify.design/tabler/player-play.svg?color=%23FFFFFF" width="16" /> <strong><code>npm run dev</code></strong> - inicia o servidor de desenvolvimento com recarregamento rápido<br><br>
      <img src="https://api.iconify.design/tabler/code.svg?color=%23FFFFFF" width="16" /> <strong>Vue DevTools</strong> - habilitado via <code>vite-plugin-vue-devtools</code> no ambiente de dev<br><br>
      <img src="https://api.iconify.design/tabler/palette.svg?color=%23FFFFFF" width="16" /> <strong>Vuetify autoImport</strong> - componentes e ícones <code>@mdi/font</code> carregados automaticamente
      </sub>
    </td>
    <td align="center" width="50%" valign="top">
      <img width="60" height="3" src="https://placehold.co/60x3/FFA300/FFA300.png"/>
      <br><strong>BUILD E PRÉ-VISUALIZAÇÃO</strong><br><br>
      <sub>
      <img src="https://api.iconify.design/tabler/hammer.svg?color=%23FFFFFF" width="16" /> <strong><code>npm run build</code></strong> - executa <code>type-check</code> e <code>build-only</code> (<code>vite build</code>) em paralelo<br><br>
      <img src="https://api.iconify.design/tabler/eye.svg?color=%23FFFFFF" width="16" /> <strong><code>npm run preview</code></strong> - serve localmente os arquivos compilados para conferência<br><br>
      <img src="https://api.iconify.design/tabler/file-check.svg?color=%23FFFFFF" width="16" /> <strong><code>npm run type-check</code></strong> - valida os tipos TypeScript com <code>vue-tsc --build</code>
      </sub>
    </td>
  </tr>
</table>

</div>

<br>

```bash
# Servidor de desenvolvimento
npm run dev

# Verificação de tipos + build de produção
npm run build

# Pré-visualização local do build
npm run preview
```

<br>

> *Sempre que alterar o `.env`, reinicie o processo (`npm run dev` ou `npm run build`) para que o Vite releia as variáveis.*

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/terminal-2.svg?color=%23FFFFFF" width="20" /> Scripts e Qualidade de Código</h2>

<br>

<p align="center">
  Comandos disponíveis em <code>scripts</code> no <code>package.json</code> para testes, tipagem, lint e formatação.
</p>

<br>

<div align="center">

| Script | Comando Executado | Finalidade |
| --- | --- | --- |
| `npm run dev` | `vite` | Sobe o servidor de desenvolvimento |
| `npm run build` | `run-p type-check "build-only {@}" --` | Roda checagem de tipos e gera o build da aplicação |
| `npm run preview` | `vite preview` | Pré-visualiza o bundle gerado localmente |
| `npm run test:unit` | `vitest` | Executa a suíte de testes unitários com Vitest |
| `npm run type-check` | `vue-tsc --build` | Verifica erros de tipagem TypeScript em templates e módulos |
| `npm run lint` | `run-s "lint:*"` | Executa `lint:oxlint` e `lint:eslint` em sequência |
| `npm run format` | `prettier --write --experimental-cli src/` | Formata os arquivos dentro de `src/` com Prettier |

</div>

<br>

```bash
npm run test:unit
npm run type-check
npm run lint
npm run format
```

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/circle-check.svg?color=%23FFFFFF" width="20" /> Validação do Ambiente</h2>

<br>

<p align="center">
  Checklist rápido para confirmar que a instalação do frontend está funcional antes de iniciar novas tarefas ou demonstrações.
</p>

<br>

- [ ] **Versão do Node.js** - `node -v` dentro de `^22.18.0` ou `>=24.12.0`;
- [ ] **Dependências instaladas** - `npm install` concluído sem erros críticos;
- [ ] **Variável de API** - `VITE_API_BASE_URL` configurada no `.env` apontando para o backend ativo;
- [ ] **Compilação e testes** - `npm run build` e `npm run test:unit` executados sem falhas.

<br>

> *Se precisar testar contra o backend rodando em outro host ou porta, ajuste `VITE_API_BASE_URL` antes de iniciar o servidor.*

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<h2 align="center"><img src="https://api.iconify.design/tabler/alert-triangle.svg?color=%23FFFFFF" width="20" /> Problemas Comuns</h2>

<br>

<div align="center">

| Sintoma | Causa Provável | O que Verificar |
| --- | --- | --- |
| Erro de `engine` ao instalar pacotes | Versão do Node.js fora de `^22.18.0 \|\| >=24.12.0` | Atualize o Node.js e rode `npm install` novamente |
| Falha de rede ao chamar a API | Backend desligado ou `VITE_API_BASE_URL` incorreta | Confirme se a API está acessível na URL configurada no `.env` |
| Bloqueio de requisição no navegador | Política de CORS do backend não permite a origem do frontend | Verifique a configuração de origens permitidas no serviço backend |
| Falha em `npm run build` | Erro de tipagem detectado pelo `vue-tsc --build` | Rode `npm run type-check` isoladamente para inspecionar os tipos |

</div>

<br>

<img width="100%" src="https://capsule-render.vercel.app/api?type=rect&color=0:FE5000,100:FFA300&height=4" />

<br>

<p align="center">
  <sub>Projeto GeoRural DataHub, desenvolvido para a <strong>Visiona Tecnologia Espacial</strong> - Governança e Rastreabilidade de Dados Geoespaciais.</sub>
</p>
