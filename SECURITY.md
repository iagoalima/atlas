# Política de segurança

## Relato de vulnerabilidades
Não publique tokens, dados pessoais, transcrições privadas ou detalhes exploráveis em issues públicas. Use um canal privado disponível no perfil do mantenedor e inclua a descrição, o impacto, as condições necessárias para reprodução e uma sugestão de correção, se possível.

## Boas práticas
- Armazene tokens e URLs privadas apenas em variáveis de ambiente ou gerenciador de segredos.
- Se um token for exposto, revogue-o imediatamente e gere outro.
- Não faça commit de arquivos `.env`, backups, dumps, logs ou transcrições com dados reais.
- Restrinja permissões do bot e acesso ao banco ao mínimo necessário.
- Separe ambientes de desenvolvimento e produção.
