# Arena do Vôlei

Site completo para organizar um grupo de vôlei: presenças com lista de espera, sorteio
automático de times, placar ao vivo, histórico e ranking individual.

Feito para usar **no celular** antes do jogo, mas responsivo também para computador e tablet.

> Nome, slogan e logotipo são configuráveis em **Administração → Configurações**. O nome
> provisório é “Arena do Vôlei”.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend / Backend | Next.js 16 (App Router, Server Actions) + React 19 + TypeScript |
| Estilo | Tailwind CSS 4 (tema escuro, componentes próprios) |
| Banco | PostgreSQL via Drizzle ORM |
| Banco local | PostgreSQL 18 embarcado (`embedded-postgres`, sem Docker e sem instalação manual) |
| Banco em produção | Supabase (mesmo schema/SQL) |
| Autenticação | Sessões próprias no banco + cookies `httpOnly` + hash **scrypt** |
| E-mail | Resend ou SMTP (opcional; em dev os e-mails caem em `.data/outbox`) |
| Testes | Vitest (unitários e integração) + Playwright (E2E desktop e mobile) |
| PWA | Manifest + ícone; instalável na tela inicial do celular |

Todas as regras sensíveis (permissões, capacidade, sorteio, placar, ranking) são aplicadas
**no servidor**. Esconder um botão na interface não é usado como controle de acesso.

---

## Rodar localmente

Pré-requisitos: **Node.js 20.9+** (recomendado 24) e **Yarn 1.22+**.

```bash
yarn install
cp .env.example .env.local      # no Windows: Copy-Item .env.example .env.local
yarn dev
```

O comando `yarn dev` faz tudo:

1. inicia um **PostgreSQL 18 local** na porta `54364` (dados em `.data/postgres`);
2. aplica as migrações e cria as configurações/temporada padrão;
3. sobe o Next.js em **http://localhost:3000**.

Abra o site e **crie a primeira conta** — o primeiro usuário cadastrado vira administrador.

### Dados de demonstração (opcional)

```bash
yarn db:demo
```

Cria 14 jogadores, evento cheio com fila, avisos, sorteio pronto e um histórico com partidas
encerradas. Contas (senha `Arena@2026`):

- Administrador: `admin@arena.local`
- Jogadores: `ana@arena.local`, `bruno@arena.local`, … `natalia@arena.local`

Para começar do zero (remove todos os dados e volta a exigir o primeiro cadastro como admin):

```bash
yarn db:reset
```

O banco local fica em `.data/postgres` (ignorado pelo git). Para usar outro PostgreSQL local,
basta alterar `DATABASE_URL` em `.env.local`.

---

## Scripts

| Comando | O que faz |
|---|---|
| `yarn dev` | PostgreSQL local + migrações + seed + Next.js em `:3000` |
| `yarn build` | Build de produção do Next.js |
| `yarn start` | Sobe o build já gerado (requer `DATABASE_URL` acessível) |
| `yarn lint` | ESLint |
| `yarn typecheck` | TypeScript sem emitir arquivos |
| `yarn test` | Vitest: testes unitários e de integração (sobe um Postgres isolado em `:54366`) |
| `yarn test:e2e` | Playwright: fluxos completos em `:3100` com banco próprio em `:54365` |
| `yarn db:migrate` | Aplica migrações em `DATABASE_URL` |
| `yarn db:seed` | Garante configurações e temporada ativa |
| `yarn db:setup` | `db:migrate` + `db:seed` |
| `yarn db:demo` | Recria o banco com dados de demonstração |
| `yarn db:reset` | Limpa todos os dados e recria configurações/temporada |
| `yarn db:generate` | Gera nova migração a partir do schema Drizzle |

> `yarn test` e `yarn test:e2e` são autossuficientes: sobem seus próprios bancos isolados e
> recriam os dados de demonstração. Você pode executá-los com o `yarn dev` aberto.

---

## Funcionalidades

### Contas e permissões
- Cadastro com nome, e-mail e senha; login/logout; sessões revogáveis no banco.
- Senhas com **scrypt** (salt aleatório, comparação em tempo constante). Nunca são exibidas.
- Recuperação de senha por link de uso único com validade de 1 hora.
- Primeiro cadastrado vira administrador; o painel permite promover/rebaixar, ativar/desativar
  e gerar links de redefinição.
- Todas as rotas e ações administrativas revalidam a permissão no servidor.
- Perfil com foto (upload recortado em 256×256), apelido e estatísticas.

### Eventos e presenças
- Administrador cria, edita, cancela, reabre e marca eventos como realizados.
- Data/hora, local, endereço, limite de jogadores e observações.
- Confirmação e cancelamento pelo jogador, com atualização imediata dos números.
- Capacidade controlada em transação (sem overbooking), com **lista de espera** ordenada.
- Ao cancelar uma presença, o primeiro da fila é promovido automaticamente.
- Administrador pode adicionar/remover jogadores e reordenar a fila.
- Avisos do grupo com destaque para fixados.

### Racha (lista única, times e rotação)
- **Uma lista única de jogadores** por evento: presentes, fila, em quadra e quem saiu.
- O administrador escolhe o formato (**4, 5 ou 6** por time) e clica em **“Iniciar racha”**:
  o sistema monta os dois primeiros times automaticamente e deixa o restante na fila.
- A partida tem placar ao vivo (+1/−1 ou digitar o placar) e **“Finalizar partida”**.
- Ao finalizar, a rotação é **automática**: o vencedor fica, o perdedor vai para o fim da fila e
  o próximo adversário é formado pelos próximos jogadores da fila (priorizando quem jogou menos).
  A próxima partida já aparece montada — não existe escolher “Time A × Time B”.
- **Substituição**: se alguém sair, o próximo da fila entra automaticamente; sem ninguém na fila,
  a partida fica pausada até chegar um substituto.
- Chegada atrasada entra no fim da fila; partidas passadas não mudam (elenco fica registrado).
- **Desfazer último resultado** restaura o placar e a fila; **reiniciar racha** começa outra
  sequência mantendo o histórico/ranking anteriores; **encerrar racha** fecha a sessão.
- Cada partida finalizada entra no histórico e no ranking com o elenco real.
- Cores automáticas (inclusive preto, branco e marrom), sem repetir quando há muitos times.

### Placar, histórico e ranking
- Placar ao vivo com +1/−1, correção manual e registro de cada alteração.
- Encerramento exige placar decisivo; vencedor é gravado.
- Histórico completo com times, participantes, placar e vencedor.
- Administrador corrige resultados já encerrados; a correção fica auditada (quem/quando/antes/depois).
- Ranking **geral**, **mensal** e por **temporada**, com filtros de mês/temporada.
- Pontuação configurável (padrão: 3 por vitória + 1 por derrota) e ranking pode ser ocultado
  sem apagar resultados.
- Estatísticas individuais: partidas, vitórias, derrotas, aproveitamento, pontos e posições.

### Celular
- Barra inferior fixa com as áreas principais e menu “Mais” com todas as páginas.
- Layout adaptado para toque, alvos ≥ 44 px, fontes legíveis, sem scroll horizontal.
- Instalável como app (PWA) pelo navegador.
- Aviso de falta de conexão e mensagens de erro amigáveis.

---

## Como o ranking é calculado

Somente partidas com status **Encerrada** contam. Partidas em andamento, canceladas ou sem
confirmação de resultado não alteram nenhum número.

```
pontos = vitórias × pontos_por_vitória + derrotas × pontos_por_derrota
aproveitamento = vitórias ÷ partidas
```

A classificação ordena por pontos, vitórias, aproveitamento, partidas e nome. O ranking mensal
considera o mês do calendário no fuso configurado; o ranking de temporada usa as datas da
temporada ativa. Os valores de pontuação são configuráveis em **Administração → Configurações**.

---

## E-mail

- Com `RESEND_API_KEY` definida, os e-mails são enviados pela API do Resend.
- Com `SMTP_URL`/`SMTP_HOST`, o envio usa SMTP.
- Sem nenhum provedor, o conteúdo é gravado em `.data/outbox/*.txt` e o link aparece no log do
  servidor — suficiente para testar a recuperação de senha localmente.
- O administrador também pode gerar um link de redefinição no painel e enviar pelo WhatsApp.

---

## Deploy

Instruções detalhadas em **[docs/DEPLOY.md](docs/DEPLOY.md)**: Supabase + Vercel, variáveis de
ambiente, migrações, domínio próprio e observações de segurança/RLS.

Resumo:

1. Crie um projeto no Supabase e rode as migrações no banco de produção.
2. Importe o repositório na Vercel.
3. Configure `DATABASE_URL` (pooler), `APP_URL` e, opcionalmente, Resend/SMTP.
4. Faça o deploy e cadastre a primeira conta (vira administrador).

---

## Segurança (resumo)

- Sessões opacas com token aleatório; apenas o hash SHA-256 fica no banco.
- Cookies `httpOnly`, `SameSite=Lax`, `Secure` em produção; rotação de token no login.
- Senhas e tokens nunca aparecem no frontend nem em logs.
- Autorização centralizada no servidor em todas as Server Actions.
- Rate limit em login, cadastro e recuperação de senha.
- Upload de avatar validado por tipo/tamanho e reprocessado pelo `sharp`.
- Validação de todos os formulários com Zod (cliente e servidor).
- Consultas parametrizadas pelo Drizzle (sem SQL concatenado).
- A conexão com o banco usa credenciais exclusivamente do servidor.

Limitações conhecidas e recomendações estão em
[docs/RELATORIO.md](docs/RELATORIO.md#limitações-e-recomendações).

---

## Estrutura do projeto

```
src/
  app/                 páginas, layouts, rotas de API, erro/404/loading
  actions/             Server Actions (auth, presenças, sorteio, jogos, admin, perfil)
  components/
    ui/                kit de interface (botões, cards, inputs, alertas…)
    layout/            shell, navegação desktop/mobile, marca
    features/          componentes de domínio (times, presenças, upload…)
    forms/             formulários de autenticação
  db/
    schema.ts          tabelas, enums, índices e relações
    client.ts          conexão PostgreSQL + Drizzle
    queries/           consultas de leitura organizadas por domínio
  lib/                 auth, sessão, senha, e-mail, sorteio, ranking, validação, tempo
drizzle/               migrações SQL geradas
scripts/               dev, migrações, seed, demo, reset e testes
tests/                 unitários e integração (Vitest)
e2e/                   fluxos completos (Playwright)
docs/                  administração, deploy e relatório de entrega
```

---

## Documentação

- **[docs/ADMIN.md](docs/ADMIN.md)** — guia simples de administração.
- **[docs/DEPLOY.md](docs/DEPLOY.md)** — publicar com Supabase + Vercel.
- **[docs/RELATORIO.md](docs/RELATORIO.md)** — funcionalidades entregues, testes executados,
  decisões técnicas e limitações.

---

Projeto privado, sem pagamentos ou controle financeiro, por decisão de escopo.
