# Publicar o site na internet

A combinação recomendada é **Vercel** (site) + **Supabase** (PostgreSQL). As duas têm plano
gratuito e funcionam bem para um grupo de vôlei. O mesmo código/SQL roda em qualquer
PostgreSQL gerenciado (Railway, Render, Neon, Fly.io, VPS).

> O banco local embarcado (`embedded-postgres`) serve **apenas para desenvolvimento**. Em
> produção o site usa `DATABASE_URL`.

---

## 1. Criar o banco no Supabase

1. Acesse <https://supabase.com>, crie uma conta e um **New project**.
2. Guarde a senha do banco definida na criação.
3. Em **Project Settings → Database → Connection string**, copie duas URLs:
   - **Connection pooling / Transaction pooler** (porta `6543`) → usada pelo site em produção.
   - **Direct connection** ou **Session pooler** (porta `5432`) → usada para rodar migrações.

As URLs têm este formato (a região e o usuário variam):

```
# Runtime (transaction pooler)
postgresql://postgres.abcdefgh:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Migrações (direta ou session pooler)
postgresql://postgres.abcdefgh:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
```

O projeto já configura `prepare: false` na conexão, necessário para o pooler em modo transação.

### Aplicar o schema

No seu computador, com o projeto instalado, rode as migrações apontando para o banco de
produção.

**PowerShell (Windows):**

```powershell
$env:DATABASE_URL="postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require"
yarn db:migrate
yarn db:seed
Remove-Item Env:DATABASE_URL
```

**Bash (Linux/macOS):**

```bash
export DATABASE_URL="postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres?sslmode=require"
yarn db:migrate
yarn db:seed
unset DATABASE_URL
```

Isso cria todas as tabelas, índices e constraints e garante as configurações/temporada padrão.
Não cria usuários — o **primeiro cadastro no site** vira administrador.

> Se sua rede não alcançar a conexão direta (IPv6), use o **Session pooler** (porta 5432) para as
> migrações. Evite rodar DDL pelo transaction pooler (6543) por causa do modo de transação.

### RLS (opcional, defesa em profundidade)

O site conversa com o banco pelo servidor Next.js usando uma conexão PostgreSQL comum. Nesse
modelo, o RLS **não** é a camada de autorização — as permissões são verificadas nas Server
Actions e consultas do servidor.

Somente usuários/serviços que usam a API REST do Supabase (`anon`/`authenticated`) estariam
sujeitos ao RLS. Se você não usa a API REST direto do navegador, pode bloquear totalmente esse
acesso executando **`supabase/rls-optional.sql`** no SQL Editor do Supabase. O arquivo ativa
RLS e revoga privilégios de `anon`/`authenticated`. Não afeta o site, porque a conexão do
servidor usa o usuário `postgres`.

> Não execute esse script se, no futuro, você for consumir as tabelas diretamente com a chave
> pública do Supabase — nesse caso será necessário criar políticas específicas.

---

## 2. Publicar na Vercel

1. Envie o código para um repositório no GitHub (ou use `vercel` CLI).
2. Em <https://vercel.com/new>, importe o repositório.
3. Configurações:
   - **Framework**: Next.js (detectado automaticamente)
   - **Install Command**: `yarn install --frozen-lockfile`
   - **Build Command**: `yarn build`
   - **Node.js Version**: 22.x ou 24.x
4. Em **Environment Variables**, adicione (Production e Preview):

| Variável | Obrigatória | Valor |
|---|---|---|
| `DATABASE_URL` | Sim | URL do **transaction pooler** (porta 6543) com `sslmode=require` |
| `APP_URL` | Sim | URL pública do site, ex. `https://arena-do-volei.vercel.app` |
| `RESEND_API_KEY` | Recomendada | chave da Resend para recuperação de senha |
| `EMAIL_FROM` | Recomendada | ex. `Arena do Vôlei <nao-responda@seudominio.com>` |
| `ADMIN_EMAIL` | Opcional | fixa um e-mail que sempre será admin ao se cadastrar |
| `SMTP_URL` / `SMTP_HOST`… | Opcional | alternativa à Resend |

5. Clique em **Deploy**.
6. Abra a URL publicada e **crie a primeira conta** (ela vira administradora).
7. Copie essa URL para `APP_URL` caso tenha publicado antes de configurar (links de e-mail usam
   esse valor) e faça um novo deploy.

### Domínio próprio

Em **Vercel → Settings → Domains**, adicione seu domínio e siga o DNS indicado. Depois atualize
`APP_URL` (ex.: `https://volei.seugrupo.com.br`) e faça redeploy.

### Instalar no celular (PWA)

Abra o site no celular → menu do navegador → **Adicionar à tela inicial**. O ícone e o nome vêm
do site; o nome e o logotipo podem ser alterados em **Administração → Configurações**.

---

## 3. E-mail em produção

Para a recuperação de senha funcionar de verdade, configure **um** provedor:

### Resend (mais simples)

1. Crie uma conta em <https://resend.com>.
2. Verifique seu domínio (ou use o domínio de teste para experimentar).
3. Gere uma API key e defina `RESEND_API_KEY` e `EMAIL_FROM` na Vercel.

### SMTP

Defina `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM` (ou `SMTP_URL`).
Funciona com Gmail (senha de app), Zoho, Mailgun, Amazon SES etc.

Sem provedor configurado, o site continua funcionando; os e-mails são gravados em
`.data/outbox` no servidor de desenvolvimento. Em produção (Vercel) o sistema de arquivos é
temporário — por isso é importante configurar um provedor. Como alternativa imediata, o
administrador pode gerar o link de redefinição no painel e enviar pelo WhatsApp.

---

## 4. Atualizações futuras

Sempre que o schema mudar:

```bash
yarn db:generate                     # gera uma migração nova em drizzle/
# revise o SQL gerado e faça commit
DATABASE_URL="<url de migração do Supabase>" yarn db:migrate
```

Depois faça o deploy. Rode as migrações **antes** de publicar código que dependa das novas
colunas. As migrações são idempotentes (controle interno da Drizzle).

---

## 5. Outras opções de hospedagem

Se preferir não usar Vercel, o site roda como servidor Node comum:

```bash
yarn install --frozen-lockfile
yarn build
DATABASE_URL="postgresql://..." APP_URL="https://seu-site" yarn start
```

- Precisa de um PostgreSQL gerenciado (Railway, Render, Neon, Fly Postgres, Supabase, RDS…).
- Coloque atrás de HTTPS (Caddy, Nginx, Cloudflare) para o cookie `Secure` funcionar.
- Não use armazenamento efêmero para o banco.
- O `embedded-postgres` é dependência de desenvolvimento e não será usado em produção.

---

## 6. Checklist de segurança em produção

- [ ] `DATABASE_URL` com SSL (`sslmode=require`) e usuário exclusivo do projeto.
- [ ] `APP_URL` com HTTPS.
- [ ] `RESEND_API_KEY`/SMTP configurados (recuperação de senha real).
- [ ] Executou `supabase/rls-optional.sql` (se não usa a API REST pública).
- [ ] Backups do Supabase ativos (Settings → Database → Backups).
- [ ] Primeira conta criada e senha forte; outros admins promovidos pelo painel.
- [ ] Nenhuma credencial em arquivos versionados (`.env.local` fica fora do git).
- [ ] Ao trocar o domínio, atualizar `APP_URL` e refazer o deploy.

---

## 7. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `DATABASE_URL não configurada` | variável ausente no runtime | configure na Vercel e faça redeploy |
| `CONNECT_TIMEOUT` / `ECONNREFUSED` | URL errada, pooler/IPv6 ou SSL | copie novamente a URL do Supabase, inclua `?sslmode=require` |
| Login não “gruda” em produção | sem HTTPS ou `APP_URL` errado | use HTTPS e atualize `APP_URL` |
| Link de senha aponta para localhost | `APP_URL` não configurado antes do deploy | corrija a variável e gere novo link |
| E-mail não chega | provedor não configurado/domínio não verificado | configure Resend/SMTP; confira spam |
| Ranking “desativado” | toggle em Configurações | religue **Exibir ranking** |
| Sorteio bloqueado | partida/rodada em andamento | encerre a partida e depois a rodada |
| Build falha ao baixar fontes | rede bloqueando Google Fonts | permita acesso ou troque as fontes em `src/app/layout.tsx` |

---

## 8. Backup e restauração

- **Supabase**: use **Database → Backups** (plano gratuito tem backups diários limitados) ou
  `pg_dump` com a connection string direta:
  ```bash
  pg_dump "postgresql://postgres.<ref>:<SENHA>@db.<ref>.supabase.co:5432/postgres?sslmode=require" \
    --no-owner --no-acl -Fc -f arena-volei.dump
  ```
- **Restauração**: `pg_restore --clean --if-exists -d "<DATABASE_URL>" arena-volei.dump`.
- **Local**: os dados estão em `.data/postgres` (basta copiar a pasta com o servidor parado).
