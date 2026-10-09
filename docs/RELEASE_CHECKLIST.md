# Checklist de validação para lançamento

Use um servidor de teste e dados fictícios. Não execute testes destrutivos em um servidor operacional nem em um banco de produção.

## Ambiente e configuração

- [ ] O bot inicia com as variáveis de ambiente válidas.
- [ ] O processo falha com mensagem compreensível quando faltam variáveis obrigatórias.
- [ ] A conexão com PostgreSQL é estabelecida e encerrada corretamente.
- [ ] As migrações são aplicadas no banco de teste sem apagar dados existentes.
- [ ] Os comandos de barra são registrados no aplicativo Discord correto.
- [ ] Cada canal configurado é acessível ao bot.
- [ ] O bot possui permissões e posição hierárquica suficientes para atribuir os cargos configurados.

## Painéis e catálogo

- [ ] O painel público de solicitações é publicado no canal configurado.
- [ ] As artes dos painéis aparecem corretamente.
- [ ] A pessoa solicitante consegue iniciar o fluxo.
- [ ] O painel interno de análise mostra os estados corretos e atualiza após mudanças.
- [ ] O catálogo é publicado com apresentação única e mensagens por categoria.
- [ ] Criar, atualizar e desativar categorias/medalhas sincroniza o catálogo sem duplicar mensagens.
- [ ] Recriar uma mensagem apagada manualmente não deixa o catálogo permanentemente inconsistente.

## Solicitação e evidências

- [ ] Um usuário pode abrir uma solicitação válida.
- [ ] Entradas inválidas são recusadas com orientação clara.
- [ ] Os dados persistem corretamente no banco.
- [ ] O usuário recebe por mensagem direta os pedidos de evidência e as atualizações.
- [ ] Se as mensagens diretas estiverem fechadas, o bot informa o problema sem perder silenciosamente o estado da solicitação.
- [ ] Evidências anexadas são registradas e ficam associadas à solicitação correta.
- [ ] Mensagens sem anexos são tratadas conforme as regras atuais do fluxo.
- [ ] O aviso ou a mensagem temporária é removido quando previsto.
- [ ] A mensagem de solicitação expira ou é removida após o período de 24 horas, conforme a implementação atual.

## Decisão e entrega

- [ ] Apenas membros autorizados conseguem aprovar ou negar solicitações.
- [ ] A negação exige justificativa quando previsto.
- [ ] Uma medalha aprovada permanece distinta de uma medalha efetivamente entregue.
- [ ] Apenas membros autorizados conseguem executar a entrega.
- [ ] A tentativa de entregar uma medalha a si próprio é bloqueada.
- [ ] O bot recusa cargos inexistentes, gerenciados ou acima de sua hierarquia.
- [ ] Uma falha durante a atribuição de cargos é registrada e o rollback é verificado.
- [ ] Uma entrega concluída só é registrada como concedida após a confirmação dos cargos.
- [ ] A mesma medalha não pode ser entregue duas vezes por cliques concorrentes.
- [ ] O solicitante recebe uma atualização coerente com o resultado.

## Resiliência e permissões

- [ ] Uma interação lenta é reconhecida dentro do prazo da API do Discord.
- [ ] Mensagens apagadas ou canais inacessíveis não derrubam o processo.
- [ ] Falhas de banco são registradas sem revelar a URL de conexão ou credenciais.
- [ ] Erros da API do Discord são registrados com contexto suficiente para diagnóstico.
- [ ] Usuários sem permissão não conseguem contornar as verificações usando IDs de componentes alterados.
- [ ] O painel de análise e o catálogo não expõem informações destinadas apenas à equipe.
- [ ] Reiniciar o bot não corrompe nem duplica solicitações existentes.

## Auditoria e privacidade

- [ ] Os eventos de criação, decisão e concessão são registrados com o executor correto.
- [ ] Uma tentativa bloqueada de autoentrega não gera um evento falso de medalha concedida.
- [ ] Logs e mensagens de erro não expõem tokens, senhas ou conteúdo privado desnecessário.
- [ ] O arquivo `.env` não está versionado.
- [ ] Backups e transcrições de teste são armazenados e descartados de forma segura.

## Critério de aprovação

Marque o lançamento como aprovado somente depois de executar cada cenário aplicável em ambiente de teste, registrar os resultados e corrigir os defeitos bloqueadores. A compilação e o lint, isoladamente, não comprovam o funcionamento de ponta a ponta.
