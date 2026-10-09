# Atlas

<p align="center">
  <strong>Gestão de solicitações de condecorações para Discord</strong><br>
  Um bot desenvolvido em TypeScript para organizar solicitações, análise, comprovação e entrega de medalhas em comunidades.
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-24.x-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="discord.js" src="https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white">
</p>

Atlas centraliza o fluxo de solicitações de medalhas em um servidor Discord, oferecendo uma experiência organizada para solicitantes e equipe responsável. O projeto combina interações do Discord, persistência de dados com PostgreSQL e componentes visuais para facilitar o acompanhamento das solicitações.

> **Estado do projeto:** versão pública **v1.0.0**. O Atlas foi testado pelo mantenedor e aprovado para incorporação à comunidade do Exército Brasileiro (contexto Roblox/Discord). Antes de executar sua própria instância, configure um ambiente separado e valide as permissões, variáveis de ambiente e integrações do Discord.

## Funcionalidades

- **Solicitações de medalhas:** abertura e acompanhamento de pedidos a partir do painel público.
- **Análise interna:** painel da equipe com indicadores e solicitações em andamento.
- **Catálogo de medalhas:** apresentação organizada por categorias.
- **Coleta de evidências:** solicitação de provas ao usuário por mensagem direta.
- **Atualizações privadas:** comunicação de mudanças de estado e orientações por mensagem direta.
- **Decisão e entrega:** etapas separadas para análise do pedido e concessão efetiva da medalha.
- **Auditoria:** registro de eventos relevantes do fluxo.
- **Configuração por servidor:** canais e opções operacionais configurados no próprio Discord.
- **Persistência relacional:** dados armazenados em PostgreSQL por meio do Prisma ORM.

Os recursos disponíveis dependem da configuração do servidor Discord, das permissões concedidas ao bot e das variáveis de ambiente.

## Prévia visual

<p align="center">
  <img src="assets/panels/solicitacoes.png" alt="Painel público de solicitações do Atlas" width="31%">
  <img src="assets/panels/catalogo.png" alt="Apresentação do catálogo de medalhas do Atlas" width="31%">
  <img src="assets/panels/dashboard.png" alt="Painel interno de análise do Atlas" width="31%">
</p>

<p align="center">
  <sub>Painel de solicitações • Catálogo de medalhas • Central interna de análise</sub>
</p>

## Tecnologias

| Tecnologia | Uso |
| --- | --- |
| Node.js 24 | Ambiente de execução |
| TypeScript | Linguagem e verificação estática |
| discord.js 14 | API e interações do Discord |
| Prisma ORM 7 | Acesso ao banco de dados e geração do cliente |
| PostgreSQL | Banco de dados relacional |
| Zod | Validação de dados |
| Pino | Logging da aplicação |
| ESLint e Prettier | Qualidade e formatação do código |

## Requisitos

- Node.js **24.x**
- npm compatível com a versão instalada do Node.js
- PostgreSQL acessível pela aplicação
- Aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)
- Bot adicionado ao servidor de destino com as permissões necessárias

## Configuração local

### 1. Obtenha o código

```bash
git clone https://github.com/iagoalima/atlas.git
cd atlas
npm ci
```

Se estiver trabalhando em uma branch de desenvolvimento específica, troque para ela antes de continuar.

### 2. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha os valores no arquivo local `.env`:

```bash
cp .env.example .env
```

No Windows PowerShell, também é possível copiar com:

```powershell
Copy-Item .env.example .env
```

Configure, no mínimo:

- `DATABASE_URL`: URL de conexão com o PostgreSQL.
- `DISCORD_TOKEN`: token do bot do Discord.
- `ATLAS_EMOJI_*`: emojis personalizados opcionais; campos vazios usam os fallbacks previstos pelo projeto.

**Nunca publique o arquivo `.env`, tokens, senhas ou credenciais reais.** O arquivo `.env.example` contém apenas valores ilustrativos.

### 3. Prepare o banco e gere o cliente Prisma

Revise as instruções e o schema em [`prisma/schema.prisma`](prisma/schema.prisma). Com o banco configurado, gere o cliente:

```bash
npx prisma generate
```

Aplique as migrações existentes conforme o estado do banco:

```bash
npx prisma migrate deploy
```

Em um ambiente de desenvolvimento novo, confira primeiro se existem migrações em `prisma/migrations`. Não use comandos que redefinam ou apaguem o banco de dados de produção.

### 4. Compile e execute

```bash
npm run build
npm run dev
```

Para iniciar a versão compilada:

```bash
npm start
```

### 5. Registre os comandos do Discord

Depois de configurar as variáveis de ambiente e revisar a aplicação, registre os comandos de barra:

```bash
npm run register
```

Faça isso apenas no aplicativo e nos ambientes corretos do Discord.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Executa a aplicação em modo de desenvolvimento com recarga automática |
| `npm run build` | Gera o cliente Prisma e compila o TypeScript |
| `npm start` | Inicia a aplicação compilada |
| `npm run register` | Registra os comandos de barra |
| `npm run lint` | Executa o ESLint |
| `npm run format` | Formata arquivos com Prettier |

## Estrutura do projeto

A aplicação é organizada por responsabilidades. Os diretórios principais incluem:

- `src/commands`: comandos de barra do Discord.
- `src/interactions`: handlers de botões, menus de seleção, modais e outras interações.
- `src/services`: regras de negócio, solicitações, catálogo, entregas, auditoria e painéis.
- `src/core`: inicialização e integração dos componentes centrais.
- `prisma`: schema e migrações do banco de dados.
- `assets`: artes e recursos visuais usados pelos painéis.
- `docs`: documentação complementar do projeto.

Consulte [Arquitetura](docs/ARCHITECTURE.md) para uma visão de alto nível.

## Segurança e privacidade

- Nunca faça commit de `.env`, tokens, senhas, dumps de banco ou logs com dados de usuários.
- Use um bot e um banco de dados separados para desenvolvimento e produção.
- Conceda apenas as permissões do Discord necessárias ao funcionamento.
- Evite compartilhar capturas de tela que revelem IDs, nomes ou conteúdo privado.
- Consulte [SECURITY.md](SECURITY.md) para orientações de comunicação responsável de vulnerabilidades.

## Documentação

- [Configuração e operação](docs/SETUP.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Visão do projeto](docs/VISION.md)
- [Planejamento](docs/ROADMAP.md)
- [Checklist de validação para lançamento](docs/RELEASE_CHECKLIST.md)
- [Histórico de alterações](CHANGELOG.md)
- [Como contribuir](CONTRIBUTING.md)
- [Política de segurança](SECURITY.md)

## Licença

Este projeto está identificado como **MIT**. Consulte o arquivo [LICENSE](LICENSE) para os termos aplicáveis.

---

<p align="center">
  <sub>Atlas — organização, rastreabilidade e clareza no fluxo de solicitações.</sub>
</p>
