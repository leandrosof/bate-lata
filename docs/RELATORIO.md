# Relatório de entrega — Arena do Vôlei

Data: 25 de outubro de 2026
Ambiente validado: Windows 11, Node.js 24.15, pnpm 10.22, PostgreSQL 18.4 local
(embarcado) e build de produção Next.js 16.4.

---

## 1. O que foi entregue

| Área | Status | Detalhes |
|---|---|---|
| Design esportivo escuro | ✅ | Tema azul/branco, cards, tipografia esportiva, animações leves, mobile-first |
| Nome/logo configuráveis | ✅ | `settings.siteName`, `tagline` e `logoUrl` no painel |
| Cadastro/login/logout | ✅ | Contas individuais, sessões no banco, cookies `httpOnly` |
| Recuperação de senha | ✅ | Token de uso único (1 h), e-mail via Resend/SMTP; outbox em dev |
| Perfil com foto e estatísticas | ✅ | Upload validado/redimensionado, apelido, stats e últimos jogos |
| Permissões jogador/admin | ✅ | Verificação no servidor em páginas e todas as Server Actions |
| Início com próximo jogo | ✅ | Data, local, endereço, contagem, vagas, progresso, avatares |
| Confirmar/cancelar presença | ✅ | Atualização imediata, bloqueio de duplicidade, transação |
| Lista de espera | ✅ | Ordem, promoção automática ao cancelar, gestão manual pelo admin |
| Avisos | ✅ | Criar, editar, fixar, excluir e exibir na home |
| Sorteio de times | ✅ | Aleatório criptográfico, 4/5/6 por time, times completos, fila de sobras |
| Travas do sorteio | ✅ | Times travados ao iniciar; rodada encerrada libera novo sorteio |
| Priorizar reservas | ✅ | Opção de rodízio para quem ficou de fora na rodada anterior |
| Placar ao vivo | ✅ | +1/−1, correção manual, log de alterações, atualização automática |
| Encerrar partida | ✅ | Exige placar decisivo, grava vencedor, entra no histórico/ranking |
| Histórico | ✅ | Partidas, times, participantes, placar, vencedor, paginação |
| Correção de resultado | ✅ | Admin corrige; auditoria com antes/depois; ranking recalculado |
| Ranking geral/mensal/temporada | ✅ | Filtros de período, mês e temporada; posições e aproveitamento |
| Pontuação configurável | ✅ | Padrão 3/vitória + 1/derrota, alterável no painel |
| Ranking opcional | ✅ | Toggle sem apagar dados |
| Temporadas | ✅ | CRUD e ativação de uma temporada |
| Painel administrativo | ✅ | Eventos, presenças, avisos, jogadores, resultados, configurações |
| Banco persistente | ✅ | PostgreSQL + Drizzle; local embarcado; produção Supabase |
| Menu com 10 páginas | ✅ | Sidebar no desktop; barra inferior + drawer no celular |
| Segurança | ✅ | scrypt, sessões hasheadas, rate limit, Zod, autorização server-side |
| Testes automatizados | ✅ | 33 unitários/integração + 11 E2E |
| Build de produção | ✅ | `pnpm build` conclui; todas as rotas dinâmicas |
| Documentação e deploy | ✅ | README, guia do admin, deploy Supabase+Vercel, RLS opcional |

Sem pagamentos, cobranças ou controle financeiro, conforme o escopo.

---

## 2. Testes executados

### Resultado final

```
pnpm lint        ✔ sem erros
pnpm typecheck   ✔ sem erros
pnpm test        ✔ 5 arquivos, 33 testes
pnpm test:e2e    ✔ 11 testes (1 worker)
pnpm build       ✔ compilação + TypeScript + geração de páginas
```

### Unitários e integração (Vitest)

**`tests/unit/draw.test.ts` (7)**
- 23 confirmados e 5 por time → 4 times completos + 3 reservas, sem duplicados.
- Entradas duplicadas não geram jogador repetido.
- Jogadores prioritários entram nos times.
- Menos de dois times completos gera erro explicativo.
- Validação de 4/5/6 por time.
- Sementes diferentes produzem combinações diferentes.
- `shuffle` preserva os elementos e não muta o array original.

**`tests/unit/password.test.ts` (4)**
- Formato scrypt, verificação correta, rejeição de senha errada, salts diferentes,
  hashes malformados.

**`tests/unit/time.test.ts` (7)**
- Conversão America/Sao_Paulo → UTC, datas inválidas rejeitadas (inclusive 31 de fevereiro),
  ida e volta `datetime-local`, formatação pt-BR, intervalo mensal e dias até o evento.

**`tests/unit/validations.test.ts` (8)**
- Cadastro (senhas divergentes/curta), evento e limites, tamanho de time, times diferentes no
  início da partida, placar negativo, checkbox ausente vira desativado.

**`tests/integration/ranking.test.ts` (7)**
- Agregação real no PostgreSQL: partidas, vitórias, derrotas, aproveitamento, pontos e posição.
- Partidas em andamento não contam.
- Filtro de período (mês) e pontuação personalizada.
- Posição individual e total de jogadores.
- Roster: confirmados, fila ordenada, pendentes, inativos ignorados, mapa de presença.

### E2E (Playwright, Chromium)

Executados em servidor isolado (`:3100`, PostgreSQL `:54321`, banco próprio) com dados de
demonstração recriados a cada execução. Viewport desktop 1280×720 e um teste mobile 390×844.

1. Login do admin e navegação pelas 10 áreas.
2. Jogador entra na fila (vaga esgotada) e vê a posição.
3. Admin remove da fila, remove um confirmado e o sistema promove o próximo automaticamente.
4. Sorteio → início → placar 1×1 → bloqueio de empate → correção para 25×18 → encerramento →
   correção oficial → histórico (3 partidas) → ranking atualizado.
5. Encerrar rodada → novo sorteio → histórico intacto.
6. Admin cria evento e publica aviso; aviso aparece na home.
7. Novo jogador se cadastra, não vê/acede a administração, confirma e cancela presença.
8. Admin desativa o ranking (página mostra “Ranking desativado”) e reativa.
9. Recuperação de senha lida do outbox, redefinição, senha antiga rejeitada e login novo.
10. Perfil: atualizar apelido e enviar foto; endpoint devolve `image/webp`.
11. Mobile: barra inferior, drawer “Mais” e navegação para Administração.

### Verificações manuais complementares

- Layout desktop e mobile conferido por captura de tela em todas as páginas.
- Fluxo de sorteio/partida executado também com Postgres real e recarregamento de página.
- Confirmação de que o ranking mensal/temporada e as posições individuais respondem.
- Verificação de que o app inicia com banco vazio e primeiro cadastro recebe papel ADMIN.
- Build sem banco disponível: rotas dinâmicas, sem consulta em tempo de build.

---

## 3. Decisões técnicas

### Banco PostgreSQL (local e produção)
- **Drizzle ORM** com schema único (`pg-core`) e migrações SQL versionadas.
- **Local**: `embedded-postgres` baixa e executa um PostgreSQL 18 real na porta 54320, com
  dados em `.data/postgres`. Sem Docker, sem instalação manual, com concorrência real.
- **Produção**: basta apontar `DATABASE_URL` para o Supabase/Neon/etc. O mesmo schema e as
  mesmas migrações funcionam.
- Avaliamos o PGlite (Postgres em WASM): funciona em uso simples, mas apresentou deadlocks
  sob requisições concorrentes do dev server. Foi removido para priorizar confiabilidade.

### Autenticação
- Sessões opacas (32 bytes aleatórios) com apenas o hash SHA-256 no banco, permitindo revogação
  (logout geral e troca de senha).
- **scrypt** (`node:crypto`, N=16384, r=8, p=1, 64 bytes) com salt aleatório e comparação em
  tempo constante. Sem dependências nativas.
- Primeiro cadastro vira ADMIN dentro de transação com advisory lock, evitando corrida.
- Recuperação: token aleatório de 32 bytes, hash no banco, validade de 1 hora, uso único e
  revogação de todas as sessões após a troca.

### Sorteio
- Elegíveis = apenas presenças `CONFIRMED` de jogadores ativos.
- Times = `floor(confirmados / tamanho)`; exige ≥ 2 times completos.
- Embaralhamento Fisher–Yates com `crypto.randomInt` (não `Math.random`).
- Distribuição round-robin após embaralhar, garantindo times do mesmo tamanho.
- Reservas em ordem; opção de priorizar reservas da rodada anterior.
- Rodada e times persistidos; ao iniciar partida, a rodada fica `IN_PROGRESS` e novos sorteios
  são bloqueados **no servidor**. `Encerrar rodada` libera o próximo.

### Placar e ranking
- Placar é um campo da partida + log imutável `score_events` (delta, autor, momento).
- Só `FINISHED` entra nas estatísticas; ranking é calculado por consulta agregada, sem tabelas
  desnormalizadas — correções refletem imediatamente.
- Pontos: `vitórias × pontos_vitória + derrotas × pontos_derrota`; padrão 3/1.
- Desempate: pontos → vitórias → aproveitamento → partidas → nome.
- Temporada = intervalo de datas configurado; mensal = calendário no fuso do grupo.

### Concorrência e integridade
- Capacidade de presença verificada com `SELECT ... FOR UPDATE` no evento.
- Sorteio/partida usam locks na linha do evento/rodada para impedir corrida entre sortear,
  descartar e iniciar.
- Constraints únicas impedem presença duplicada e jogador duplicado no mesmo sorteio.
- FKs com `ON DELETE CASCADE` em dados dependentes e `SET NULL` em autoria, preservando
  histórico ao desativar contas (contas não são apagadas).

### Interface
- Kit próprio (sem biblioteca de UI pesada), Tailwind 4 com tokens de cor.
- Tipografia Inter (texto) + Barlow Condensed (títulos/placar) via `next/font`.
- Barra inferior fixa + drawer no celular; sidebar no desktop.
- Componentes de ação reutilizáveis com estado pendente, confirmação e feedback inline.
- Formulários de login/cadastro controlados (React 19 reseta campos após a ação; assim os dados
  digitados não somem em caso de erro).

---

## 4. Segurança implementada

- Hash de senha scrypt com salt; nenhuma senha em texto puro.
- Cookies `httpOnly`, `SameSite=Lax`, `Secure` em produção; token de sessão não legível por JS.
- Autorização em toda Server Action (`getSessionUser`, verificação de papel) — não depende da UI.
- Validação Zod em todas as entradas; mensagens de erro sem vazar dados sensíveis.
- Rate limit (janela fixa em memória) para login, cadastro e redefinição; login bem-sucedido
  zera o contador.
- Recuperação de senha: token de uso único, hash no banco, expiração e revogação de sessões.
- Upload de avatar: limite 2 MB, tipos permitidos, reprocessamento com `sharp` (256×256 WebP) e
  `limitInputPixels`.
- Avatares servidos por rota autenticada, com ETag e cache privado.
- Consultas parametrizadas via Drizzle (sem concatenação de SQL do usuário).
- `runtime` servidor: `DATABASE_URL`, chaves de e-mail e `ADMIN_EMAIL` nunca vão ao cliente.
- RLS opcional para bloquear acesso direto via API REST do Supabase
  (`supabase/rls-optional.sql`); a autorização principal é server-side.
- Trilha de auditoria para ações administrativas e correções de resultado.

---

## 5. Limitações e recomendações

1. **E-mail em produção**: a recuperação de senha depende de `RESEND_API_KEY` ou SMTP. Sem isso,
   em dev os links ficam em `.data/outbox`; em produção use o link gerado pelo admin como
   contingência.
2. **Rate limit em memória**: funciona bem em uma instância, mas em ambientes serverless com
   muitas réplicas o limite é por instância. Para endurecer, usar Upstash/Redis.
3. **RLS**: com conexão direta PostgreSQL, RLS não protege a conexão do servidor. O bloqueio
   opcional está em `supabase/rls-optional.sql`; todas as regras estão nas Server Actions.
4. **Verificação de e-mail**: não foi implementada (o admin gerencia o grupo). Pode ser adicionada
   com confirmação por e-mail e campo `emailVerified`.
5. **Um grupo por instalação**: o modelo é de um grupo único. Multi-grupo exigiria `group_id` e
   escopo em todas as tabelas.
6. **Exclusão de evento/conta**: não há exclusão física (proposital) para preservar histórico;
   eventos são cancelados e contas desativadas.
7. **PWA**: instalável e com ícone/manifest; não há service worker para uso offline completo.
   O banner de offline avisa e as ações falham com mensagem amigável.
8. **Fuso horário**: padrão `America/Sao_Paulo`, configurável. Não há suporte a múltiplos fusos
   por evento.
9. **Empates**: não são permitidos em partidas oficiais (placar precisa ser decisivo). A regra
   está aplicada no servidor.
10. **Banco local embarcado**: usa binários PostgreSQL 18 via npm; se o `pnpm` bloquear scripts de
    instalação em outro sistema operacional, rode `pnpm approve-builds` (o allowlist já está em
    `pnpm-workspace.yaml`).
11. **Fotos**: ficam no banco (bytea) para funcionar em serverless. Para grupos grandes, migrar
    para Supabase Storage.
12. **Backups**: em produção dependem do Supabase; localmente, copie `.data/postgres` com o
    servidor parado.

---

## 6. Possíveis evoluções (fora do escopo)

- Notificações push/WhatsApp para novo jogo e lembrete de presença.
- Múltiplos grupos/temporadas com isolamento por grupo.
- Estatísticas por fundamento (saque, ataque, bloqueio).
- Votação de MVP por partida.
- Exportação de histórico em CSV/PDF.
- Login com Google.
- Verificação de e-mail e 2FA.
- Fila de espera com notificação automática.

---

## 7. Como alterar nome, slogan e logo

Em **Administração → Configurações → Identidade e regras**:

- **Nome do site**: topo, menu, metadados e app instalado.
- **Slogan**: linha abaixo do nome.
- **URL do logotipo**: imagem pública quadrada (256×256 ou maior). Vazio = ícone padrão.

Também é possível alterar o nome padrão no banco (`settings.site_name`) ou no seed.

---

## 8. Entrega

- Código completo em `src/`, `scripts/`, `drizzle/`, `tests/`, `e2e/`, `docs/`.
- `README.md` com instalação, comandos e visão geral.
- `docs/ADMIN.md` com o passo a passo de administração.
- `docs/DEPLOY.md` com publicação Supabase + Vercel (e alternativas).
- `.env.example` sem credenciais reais.
- Banco local limpo após a entrega: o **primeiro cadastro** vira administrador. Para ver o site
  populado, rode `pnpm db:demo` (credenciais no README).
