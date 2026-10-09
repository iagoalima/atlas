# Como contribuir

Obrigado pelo interesse em contribuir com o Atlas.

## Fluxo recomendado
1. Confira a documentação e as issues existentes.
2. Discuta mudanças grandes antes de implementá-las.
3. Crie uma branch descritiva a partir da branch apropriada.
4. Faça alterações pequenas e focadas.
5. Execute as verificações disponíveis:
   ```bash
   npm ci
   npm run build
   npm run lint
   ```
6. Descreva no pull request o motivo, o comportamento alterado e os testes executados.

## Critérios
- Preserve os fluxos existentes, salvo quando a mudança pedir explicitamente o contrário.
- Trate erros e permissões de forma explícita.
- Evite dependências sem necessidade.
- Atualize a documentação quando comandos, configuração ou comportamento mudarem.
- Nunca inclua tokens, credenciais, dados reais de usuários ou informações privadas nos commits.
