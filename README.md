# Encontro de Violeiros — versão Netlify

Esta versão mantém a arte oficial e o comportamento do site, com autenticação própria por usuário e senha. A versão ChatGPT permanece independente e protegida pelo login original.

## Configuração

1. Crie um banco remoto Turso/libSQL. Configure na Netlify as variáveis privadas `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`.
2. No diretório `netlify-app`, execute `npm ci` e `npm run db:migrate`, com as mesmas variáveis disponíveis no terminal. Execute as migrações uma vez antes da publicação; o comando controla as migrações já aplicadas.
3. Execute `npm run admin:create -- seu.usuario`. Digite a senha no terminal (entrada oculta). O comando aceita seis dígitos ou outra senha entre 6 e 128 caracteres e gera apenas o hash. Defina os valores resultantes de `ADMIN_USERS_JSON` e `SESSION_SECRET` como variáveis privadas na Netlify. Nunca salve esses valores em arquivos versionados.
4. Para vários organizadores, reúna os objetos gerados no mesmo array `ADMIN_USERS_JSON`; mantenha o mesmo `SESSION_SECRET`. Não existe cadastro aberto. Todos os usuários cadastrados têm acesso administrativo completo.
5. Conecte o repositório à Netlify usando o `netlify.toml` da raiz. Ele usa `netlify-app` como base, `npm run build` e `dist` como publicação. Não use publicação estática por arrastar e soltar: as funções precisam ser compiladas.
6. Teste o endereço publicado: `/` para o público; `/acesso` para entrar; `/organizacao` para o painel. O login não exige ChatGPT nem conta Netlify dos organizadores.

## Dados existentes

O banco novo começa vazio. Criar tabelas não transfere as inscrições da hospedagem anterior. Antes de trocar o link oficial, obtenha uma exportação completa e autenticada do banco anterior (SQL SQLite/D1), importe no Turso preservando IDs, protocolos, participantes, números, presenças e histórico de sorteios; confira os totais e faça um teste de consulta. Não use somente o CSV de inscrições, que não contém todos os campos necessários. Não mantenha dois sites recebendo inscrições durante a troca: pause as novas inscrições na origem durante a exportação final e ative o novo endereço após a conferência.

Não há dados reais ou credenciais no pacote. A transferência dos registros atuais depende do acesso à origem; não foi executada por estes scripts.

## Validação

`npm test` compila e testa o login, bloqueio de tentativas, cookies, origem das requisições, acesso ao painel, inscrições, preço calculado no servidor, idempotência, privacidade, confirmação, presença, histórico e repetição de sorteios. Os testes usam SQLite local em memória (Node 24+); a produção pode usar Node 22.

`node ../scripts/test-interface.mjs` verifica a interface da recepção e a contagem de 5 segundos no sorteio. O modo telão é mantido pelo mesmo arquivo de interface.

As funções da Netlify usam `context.ip` para limites de acesso; valores de IP enviados pelo visitante são descartados. Sessões duram 8 horas, usam cookie seguro HttpOnly, e alterações de senha invalidam as sessões daquele usuário. HTTPS é obrigatório. Não existem senhas padrão.

As migrações vêm de `../drizzle`. A compilação lê os arquivos originais de interface e API do projeto; mantenha o repositório completo.
