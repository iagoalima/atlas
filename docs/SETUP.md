# Configuração e operação

## Pré-requisitos
- Node.js 24.x
- npm
- PostgreSQL
- Aplicação de bot criada no Discord Developer Portal

## Variáveis de ambiente
Crie um arquivo local `.env` a partir de `.env.example`.

| Variável | Obrigatória | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | Sim | Conexão com PostgreSQL |
| `DISCORD_TOKEN` | Sim | Autenticação do bot |
| `ATLAS_EMOJI_MEDAL_GRANTED` | Não | Emoji personalizado de concessão |
| `ATLAS_EMOJI_ERROR` | Não | Emoji de erro |
| `ATLAS_EMOJI_SUCCESS` | Não | Emoji de sucesso |
| `ATLAS_EMOJI_WARNING` | Não | Emoji de aviso |
| `ATLAS_EMOJI_LOADING` | Não | Emoji de carregamento |
| `ATLAS_EMOJI_ANALYSIS` | Não | Emoji de análise |
| `ATLAS_EMOJI_CONFIGURATION` | Não | Emoji de configuração |

Nunca use credenciais de produção em desenvolvimento. Não compartilhe o token do bot.

## Instalação
```bash
npm ci
npx prisma generate
```

Revise `prisma/migrations` e confirme que a URL aponta para o banco correto antes de aplicar migrações:

```bash
npx prisma migrate deploy
npm run build
npm run register
npm start
```

Para desenvolvimento, use `npm run dev`.

## Configuração no Discord
1. Crie a aplicação e o bot no Discord Developer Portal.
2. Copie o token para o arquivo `.env` local.
3. Convide o bot ao servidor de teste com as permissões necessárias.
4. Registre os comandos.
5. Configure os canais operacionais pelos comandos do Atlas.
6. Confirme permissões de visualização, envio de mensagens, resposta a interações e atribuição de cargos quando aplicável.
7. Teste com contas de teste antes da operação real.

## Operação segura
- Mantenha o processo supervisionado por um gerenciador adequado ao ambiente.
- Faça backups regulares do PostgreSQL e teste a restauração.
- Revise logs e transcrições antes de compartilhá-los.
- Separe ambientes de desenvolvimento e produção.
