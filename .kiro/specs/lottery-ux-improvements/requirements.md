# Documento de Requisitos — Melhorias de UX no App Loterias Caixa

## Introdução

Este documento especifica os requisitos para um conjunto de melhorias de UX, performance e manutenibilidade no aplicativo web "Loterias Caixa - Meus Jogos". As melhorias incluem: cache permanente de resultados da API, navegação automática para o concurso mais recente, busca direta por número de concurso, separação visual de jogos ativos e encerrados, remoção do sistema de notificações push (não funcional), e melhorias gerais de UX/UI e performance.

## Glossário

- **App**: O aplicativo web Next.js "Loterias Caixa - Meus Jogos"
- **API_Lottery**: A rota interna do App (`/api/lottery/[game]/[contest]`) que faz proxy para a API da Caixa Econômica Federal via serviços de proxy intermediários
- **Cache_Server**: O cache em memória (Map) na rota API_Lottery do lado servidor que armazena respostas da API da Caixa
- **Cache_Client**: O cache do React Query no lado cliente que armazena resultados de consultas à API_Lottery
- **Resultado**: O objeto `LotteryResult` retornado pela API da Caixa contendo números sorteados, premiação e metadados de um concurso específico
- **Concurso**: Um sorteio específico de uma modalidade de loteria, identificado por um número sequencial inteiro positivo
- **Jogo**: Um registro (`Game`) no Supabase contendo os números apostados pelo usuário, o tipo de loteria e o range de concursos
- **Jogo_Ativo**: Um Jogo cujo `concurso_fim` (ou `concurso_inicio` se `concurso_fim` for nulo) é maior ou igual ao número do Concurso atualmente visualizado pelo usuário
- **Jogo_Encerrado**: Um Jogo cujo `concurso_fim` (ou `concurso_inicio` se `concurso_fim` for nulo) é menor que o número do Concurso mais recente disponível na API para aquela modalidade
- **Navegador_Concursos**: O componente de interface que permite ao usuário navegar entre concursos usando setas (anterior/próximo) e exibir resultados
- **Campo_Busca_Concurso**: Um campo de entrada numérica que permite ao usuário digitar um número de concurso específico para navegação direta
- **Seção_Jogos_Ativos**: A seção da interface que exibe os Jogos cujo range de concursos ainda não foi totalmente ultrapassado
- **Seção_Jogos_Encerrados**: A seção da interface que exibe os Jogos cujo range de concursos já foi totalmente ultrapassado, com estilo visual atenuado
- **Sistema_Push**: O conjunto de funcionalidades de notificações push incluindo: hook `usePushNotifications`, rotas `/api/push/subscribe` e `/api/push/notify`, service worker `sw-push.js`, tabela `push_subscriptions` no Supabase, dependência `web-push`, e configurações VAPID
- **Botão_Pesquisa**: O botão com ícone de lupa (Search) presente no GameCard que inicia a busca de resultados para um Jogo

## Requisitos

### Requisito 1: Cache Permanente de Resultados com Sucesso

**User Story:** Como usuário, eu quero que os resultados de concursos já sorteados sejam armazenados permanentemente após a primeira consulta bem-sucedida, para que o App não precise refazer chamadas à API instável para dados que nunca mudam.

#### Critérios de Aceitação

1. WHEN a API_Lottery recebe uma resposta HTTP 200 com dados JSON válidos da API da Caixa, THE Cache_Server SHALL armazenar o Resultado indefinidamente (sem TTL de expiração) para aquela combinação de jogo e concurso.
2. WHEN a API_Lottery recebe uma requisição para um concurso já presente no Cache_Server com dados válidos, THE API_Lottery SHALL retornar os dados do cache sem fazer nova requisição à API da Caixa.
3. WHEN a API_Lottery recebe uma resposta 404 (concurso não encontrado), THE Cache_Server SHALL armazenar o status "não encontrado" com TTL de 60 segundos, permitindo nova tentativa após esse período.
4. WHEN a API_Lottery recebe erro de todos os proxies, THE Cache_Server SHALL armazenar o erro com TTL de 30 segundos, permitindo nova tentativa rápida.
5. WHEN o Cache_Client recebe um Resultado válido, THE Cache_Client SHALL armazenar o Resultado com `staleTime` infinito e `gcTime` de 24 horas para evitar refetch desnecessário durante a sessão.

### Requisito 2: Navegação Automática para o Concurso Mais Recente

**User Story:** Como usuário, eu quero que ao clicar no Botão_Pesquisa de um Jogo, o App navegue automaticamente para o concurso mais recente disponível, para que eu veja o resultado mais atual sem precisar navegar manualmente.

#### Critérios de Aceitação

1. WHEN o usuário clica no Botão_Pesquisa de um Jogo com range de concursos (concurso_fim definido), THE App SHALL buscar o resultado do concurso mais recente dentro do range que possua resultado disponível e exibi-lo automaticamente.
2. WHEN o usuário clica no Botão_Pesquisa de um Jogo com concurso único (concurso_fim nulo), THE App SHALL buscar o resultado daquele concurso específico.
3. WHEN nenhum concurso dentro do range possui resultado disponível, THE App SHALL exibir o componente PendingResult para o concurso final do range.
4. WHILE a busca pelo concurso mais recente está em andamento, THE App SHALL exibir um indicador de carregamento ao usuário.

### Requisito 3: Busca Direta por Número de Concurso

**User Story:** Como usuário, eu quero poder digitar um número de concurso específico para navegar diretamente até ele, para que eu não precise usar as setas de navegação repetidamente.

#### Critérios de Aceitação

1. WHEN o Navegador_Concursos está visível, THE App SHALL exibir o Campo_Busca_Concurso que aceita entrada numérica.
2. WHEN o usuário submete um número válido no Campo_Busca_Concurso, THE App SHALL navegar diretamente para o concurso informado e buscar o resultado correspondente.
3. WHEN o usuário submete um número de concurso fora do range do Jogo atual (menor que concurso_inicio ou maior que concurso_fim), THE App SHALL exibir uma mensagem informando que o concurso está fora do range do jogo.
4. WHEN o usuário submete um valor não numérico ou vazio no Campo_Busca_Concurso, THE App SHALL manter o concurso atual sem alteração.
5. THE Campo_Busca_Concurso SHALL exibir o número do concurso atual como placeholder ou valor padrão.

### Requisito 4: Separação de Jogos Ativos e Encerrados

**User Story:** Como usuário, eu quero ver meus jogos separados em "Jogos Ativos" e "Jogos Encerrados", para que eu identifique facilmente quais jogos ainda estão válidos e quais já expiraram.

#### Critérios de Aceitação

1. THE App SHALL classificar cada Jogo como Jogo_Ativo ou Jogo_Encerrado com base na comparação entre o concurso final do Jogo (ou concurso_inicio se concurso_fim for nulo) e o número do concurso mais recente disponível para aquela modalidade de loteria.
2. THE App SHALL exibir a Seção_Jogos_Ativos com o título "Jogos Ativos" contendo todos os Jogos classificados como Jogo_Ativo.
3. WHEN existem Jogos classificados como Jogo_Encerrado, THE App SHALL exibir a Seção_Jogos_Encerrados com o título "Jogos Encerrados" abaixo da Seção_Jogos_Ativos.
4. WHILE um Jogo está na Seção_Jogos_Encerrados, THE App SHALL renderizar o card do Jogo com opacidade reduzida (50%) e escala de cinza para indicar visualmente que o jogo está encerrado.
5. WHEN não existem Jogos classificados como Jogo_Encerrado, THE App SHALL ocultar a Seção_Jogos_Encerrados.
6. WHEN não existem Jogos classificados como Jogo_Ativo, THE App SHALL exibir uma mensagem de estado vazio na Seção_Jogos_Ativos indicando que não há jogos ativos cadastrados.

### Requisito 5: Remoção do Sistema de Notificações Push

**User Story:** Como desenvolvedor, eu quero remover todo o sistema de notificações push que não está funcionando, para reduzir a complexidade do código e eliminar funcionalidades quebradas.

#### Critérios de Aceitação

1. THE App SHALL remover o hook `usePushNotifications` e todas as referências a ele em componentes.
2. THE App SHALL remover as rotas de API `/api/push/subscribe` e `/api/push/notify` e seus respectivos diretórios.
3. THE App SHALL remover o service worker `public/sw-push.js`.
4. THE App SHALL remover o botão de notificações (ícone de sino) do cabeçalho da página principal.
5. THE App SHALL remover a dependência `web-push` do `package.json`.
6. THE App SHALL remover os tipos `@types/web-push` do `devDependencies` do `package.json`.
7. THE App SHALL remover as configurações de cron jobs relacionadas a notificações push do arquivo `vercel.json`.
8. THE App SHALL remover a lógica de deep link via query parameters `?game=...&contest=...` que era usada pelas notificações push na página principal.
9. WHEN a remoção estiver completa, THE App SHALL compilar e funcionar sem erros relacionados a referências de notificações push.

### Requisito 6: Melhorias de Performance no Carregamento de Resultados

**User Story:** Como usuário, eu quero que a busca de resultados em lote (range de concursos) seja mais eficiente, para que eu não precise esperar muito tempo ao verificar múltiplos concursos.

#### Critérios de Aceitação

1. WHEN o App busca resultados para um range de concursos, THE App SHALL executar as requisições em paralelo com limite de concorrência de 5 requisições simultâneas para evitar sobrecarga na API.
2. WHILE a busca em lote está em andamento, THE App SHALL exibir o progresso atualizado mostrando quantos concursos já foram verificados do total.
3. WHEN um resultado é obtido com sucesso durante a busca em lote, THE App SHALL armazenar o resultado no Cache_Client imediatamente, evitando refetch ao navegar para aquele concurso.
4. WHEN a busca em lote encontra 3 erros consecutivos (concursos não encontrados ou falhas de rede), THE App SHALL interromper a busca e informar ao usuário quantos resultados foram encontrados.

### Requisito 7: Melhorias Gerais de UX/UI

**User Story:** Como usuário, eu quero uma interface mais polida e responsiva, para que a experiência de uso do App seja mais agradável e intuitiva.

#### Critérios de Aceitação

1. THE App SHALL exibir a contagem de jogos ativos e encerrados separadamente no cabeçalho de cada seção (ex: "Jogos Ativos (3)" e "Jogos Encerrados (2)").
2. WHEN o usuário navega entre concursos usando as setas, THE App SHALL aplicar uma transição suave (animação) ao trocar o resultado exibido.
3. THE Navegador_Concursos SHALL exibir o range completo do jogo (ex: "3665 - 3682") junto ao número do concurso atual para dar contexto ao usuário.
4. WHEN o App está em estado de carregamento inicial (buscando jogos do Supabase), THE App SHALL exibir skeletons de carregamento em vez de apenas um spinner genérico.
5. THE App SHALL remover a rota de debug `/api/debug` que expõe informações internas de diagnóstico dos proxies.
