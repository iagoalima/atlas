# Arquitetura do Atlas

## Objetivo
O Atlas organiza solicitações de condecorações em um servidor Discord, separando interações, regras de negócio e persistência para facilitar manutenção.

## Componentes
- **Core:** inicializa o cliente Discord e encaminha eventos e interações.
- **Commands:** define os comandos de barra.
- **Interactions:** processa botões, menus, modais e outras interações.
- **Services:** concentra regras de negócio de solicitações, catálogo, entrega, notificações, auditoria e painéis.
- **Prisma:** descreve os modelos e fornece acesso ao PostgreSQL.
- **Assets:** contém artes e recursos visuais usados pelo bot.

Os caminhos exatos podem variar entre branches; esta página descreve as responsabilidades funcionais, não substitui a leitura do código.

## Fluxo de solicitação
1. Um administrador configura os canais operacionais.
2. O bot publica o painel público.
3. O usuário inicia uma solicitação e informa os dados requeridos.
4. A equipe acompanha o pedido pelo painel interno.
5. Quando necessário, o bot solicita evidências por mensagem direta.
6. A equipe analisa o pedido e comunica atualizações.
7. A aprovação e a entrega efetiva da medalha são etapas distintas.
8. Eventos relevantes são registrados para auditoria.

Mensagens diretas dependem das configurações de privacidade do usuário e das permissões do bot.

## Persistência
O PostgreSQL armazena configurações, categorias, medalhas, solicitações, registros de entrega e dados de auditoria definidos no schema Prisma. A conexão é configurada por `DATABASE_URL`.

## Princípios operacionais
- Validar permissões antes de ações administrativas.
- Reconhecer interações do Discord dentro do prazo exigido pela plataforma.
- Não registrar uma medalha como entregue antes da conclusão da concessão.
- Tratar erros sem expor segredos.
- Manter credenciais fora do repositório.

## Checklist antes de produção
- [ ] Compilação TypeScript concluída sem erros.
- [ ] Migrações revisadas e aplicadas no banco correto.
- [ ] Comandos registrados no aplicativo Discord pretendido.
- [ ] Permissões e hierarquia de cargos conferidas.
- [ ] Solicitação, decisão, evidências e entrega testadas.
- [ ] Falhas de mensagens diretas e entrega testadas.
- [ ] Logs revisados para evitar exposição de dados privados.
