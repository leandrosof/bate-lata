# Guia de administração — Arena do Vôlei

Este guia explica o dia a dia do administrador. Não é preciso conhecimento técnico.

## 1. Primeiro acesso

1. Abra o site e clique em **Criar conta**.
2. O **primeiro cadastro** recebe automaticamente permissão de administrador.
3. Os demais jogadores se cadastram normalmente e entram como jogadores.
4. Se precisar dar acesso de administrador a outra pessoa: **Administração → Jogadores** →
   **Gerenciar acesso → Tornar admin**.

> O menu **Administração** só aparece para administradores. Mesmo que alguém acesse a URL
> diretamente, o servidor bloqueia.

## 2. Criar o próximo jogo

1. Vá em **Administração → Eventos**.
2. Preencha:
   - **Título** (ex.: “Vôlei de sábado”);
   - **Data e hora** (no fuso configurado, padrão America/Sao_Paulo);
   - **Limite de jogadores** (as vagas);
   - **Local** e **endereço**;
   - **Observações** (colete, horário de chegada etc.).
3. Clique em **Criar evento**.

O evento aparece em **Início**, **Próximos jogos** e **Presenças**. O jogador pode confirmar
presença pelo celular.

### Editar, cancelar ou reabrir
- Em **Eventos**, abra **Editar evento** para alterar data, local, vagas ou observações.
- **Cancelar** mantém o evento no histórico, mas fecha as confirmações.
- **Reabrir** volta o evento para “Agendado”.
- **Marcar realizado** é útil quando o encontro aconteceu mas não houve partida registrada.

> Se você reduzir o limite de vagas, ninguém é removido automaticamente. Ajuste a lista em
> **Presenças**.

## 3. Presenças e fila de espera

Em **Presenças** você vê três blocos:

- **Confirmados** — quem tem vaga.
- **Lista de espera** — quem chegaria depois do limite, em ordem.
- **Ainda não confirmaram** — jogadores ativos que não responderam.

### Regras automáticas
- Quando as vagas acabam, novas confirmações entram no **fim da fila**.
- Se alguém confirmado cancela, o **primeiro da fila é promovido automaticamente**.
- Cada jogador só pode ter um registro por evento (sem confirmação duplicada).

### Ações do administrador
- **X** ao lado de um confirmado: remove a presença (e promove o próximo da fila).
- Na fila: setas sobem/descem a posição, **✓** promove manualmente (precisa haver vaga) e
  **X** remove da fila.
- Em “Ainda não confirmaram”, **Confirmar** adiciona o jogador (se lotado, vai para a fila).

## 4. Sorteio de times

1. Vá em **Sorteio de times** e escolha o evento no topo (se houver mais de um).
2. O sistema mostra apenas jogadores **confirmados**.
3. Escolha **4, 5 ou 6 jogadores por time**.
4. Clique em **Gerar times automaticamente**.

O sorteio é aleatório de verdade e forma apenas **times completos**. Quem sobrar aparece em
“Fila de espera do sorteio”.

- **Sortear novamente**: permitido enquanto a partida não começou.
- **Priorizar quem ficou de fora**: coloca primeiro na distribuição quem sobrou da rodada
  anterior (rodízio justo), desde que ainda esteja confirmado.
- **Descartar sorteio**: apaga apenas o sorteio atual, que ainda não começou.
- **Iniciar partida**: escolha dois times e confirme. A partir daqui os times ficam **travados**.
- **Encerrar rodada**: libera um novo sorteio depois que as partidas da rodada acabarem.
  Nada do histórico é apagado.

Se faltarem jogadores para dois times completos, o sistema avisa quantos faltam.

## 5. Placar e resultados

- Ao iniciar uma partida, você é levado ao **placar ao vivo**.
- Use **+1/−1** em cada lado. Todas as alterações ficam registradas.
- **Corrigir placar manualmente**: ajuste os dois números de uma vez.
- **Encerrar partida**: exige placar diferente (não existe empate oficial). O vencedor é gravado
  e o resultado entra no histórico e no ranking.
- **Cancelar**: partida cancelada não conta para estatísticas.
- Depois de encerrar, é possível iniciar outra partida com os mesmos times (mesma rodada) ou
  encerrar a rodada para um novo sorteio.

### Corrigir um resultado antigo
1. Vá em **Histórico** (ou **Administração → Resultados**).
2. Abra **Corrigir placar**, ajuste os números e salve.
3. O ranking é recalculado na hora. A correção fica registrada na auditoria (quem, quando,
   antes e depois).

## 6. Ranking

- **Início → Ranking** mostra: geral, mensal (seletor de mês) e temporada (seletor).
- A pontuação padrão é **3 por vitória + 1 por derrota**. Para alterar:
  **Administração → Configurações → Pontos por vitória/derrota**. Todas as posições são
  recalculadas imediatamente.
- Para **ocultar o ranking** sem apagar nada: desligue **Exibir ranking** e salve. A página
  continua existindo, mas mostra “Ranking desativado”. Basta religar depois.
- Só partidas **Encerradas** contam. Partidas em andamento ou canceladas não alteram nada.

### Temporadas
Em **Configurações → Temporadas**:
- crie uma temporada com início e fim (o fim é opcional);
- ative a temporada desejada (só uma fica ativa);
- o ranking “Temporada” usa as datas configuradas.

## 7. Jogadores

Em **Administração → Jogadores**:
- **Tornar admin / Remover admin** — o sistema impede ficar sem administrador ativo e impede
  que você remova o próprio acesso.
- **Desativar conta** — o jogador não consegue mais entrar; o histórico é preservado.
- **Reativar conta** — devolve o acesso.
- **Gerar link de senha** — envia por e-mail (se configurado) e mostra o link para você repassar
  pelo WhatsApp. O link vale 1 hora e só pode ser usado uma vez.

## 8. Avisos

Em **Administração → Avisos**:
- publique um comunicado com título e mensagem;
- marque **Fixar no topo** para aparecer primeiro na página inicial;
- vincule a um evento, se quiser contextualizar;
- edite ou remova avisos publicados.

## 9. Nome, slogan e logotipo

Em **Administração → Configurações → Identidade e regras**:
- **Nome do site** — aparece no topo, no menu, no título das abas e no app instalado.
- **Slogan** — linha curta abaixo do nome.
- **URL do logotipo** — cole o endereço de uma imagem quadrada (recomendado 256×256 ou maior).
  Vazio usa o ícone padrão.

## 10. Boas práticas

- Crie o evento com antecedência e publique um aviso.
- Deixe o limite de vagas igual ao número de jogadores que cabem na quadra com segurança.
- Use “Priorizar quem ficou de fora” para manter o rodízio justo.
- Encerre a rodada antes de sortear novamente.
- Se um resultado foi lançado errado, corrija pelo histórico em vez de criar dados novos.
- Faça backup do banco em produção (o Supabase tem backups; veja docs/DEPLOY.md).
