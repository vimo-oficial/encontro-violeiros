# Histórico de versões — Encontro de Violeiros

O histórico é mantido no repositório. As versões não incluem senhas, tokens nem cópias de dados pessoais. Os commits do GitHub preservam o código anterior; os deploys da Netlify preservam as publicações anteriores.

## 1.1.0 — 19/11/2026

- Selos vermelhos nas abas Inscrições e Organizadores mostram a quantidade de solicitações pendentes.
- Inscrições conta pedidos, e não o número de pessoas: uma inscrição em grupo equivale a uma solicitação.
- Somente pedidos com status pendente entram na contagem; aprovados, confirmados, recusados e cancelados não entram.
- Atualização automática a cada 15 segundos enquanto o painel estiver visível, ao voltar à página e ao abrir Inscrições.
- A lista de inscrições acompanha a atualização do contador. Confirmação ou cancelamento atualiza o selo; aprovação ou recusa de organizador também.
- Selos desaparecem quando a contagem chega a zero. Falhas de conexão preservam o último valor conhecido e indicam possível desatualização na descrição do botão.
- Organizadores continua disponível somente ao proprietário juliocnovais. Não houve alteração nas permissões, dados existentes, banner oficial ou sorteio de 5 segundos e modo telão.
- Testes: cadastro e autorização, inscrições, presença, sorteio, contadores, pausa em segundo plano e respostas de leitura concorrentes.

## 1.0.0 — 18/11/2026

Registro retrospectivo da versão publicada antes dos contadores.

- Site público, inscrições, consulta, confirmação de pagamento e recepção na Netlify com banco Turso.
- Sorteio com contagem de 5 segundos e modo telão.
- Cadastro de organizadores com nome de usuário e senha de exatamente seis dígitos numéricos; acesso pendente até aprovação do proprietário.
- Sessões protegidas e decisões de aprovação restritas ao proprietário.
- Referência do código: commit 88954ad31f9a25c1db08130c4046c8ce490160c5.

## Como registrar futuras alterações

Acrescentar uma nova entrada no topo deste arquivo, com versão, data, mudanças e validações. Não sobrescrever as entradas anteriores. A versão do código não representa uma cópia do banco de dados: restaurações de dados exigem backup próprio.
