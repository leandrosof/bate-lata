-- ============================================================================
-- Arena do Vôlei — hardening opcional para Supabase
--
-- O site acessa o banco exclusivamente pelo servidor Next.js, com a conexão
-- PostgreSQL (usuário postgres), e aplica autorização nas Server Actions.
-- Este script bloqueia o acesso direto via API REST do Supabase (anon e
-- authenticated), funcionando como defesa em profundidade.
--
-- NÃO afeta o site. Não execute se você pretende consultar as tabelas
-- diretamente pelo cliente Supabase com a chave pública — nesse caso, crie
-- políticas específicas em vez de revogar tudo.
--
-- Como usar: Supabase → SQL Editor → cole e execute. Idempotente.
-- ============================================================================

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.seasons enable row level security;
alter table public.events enable row level security;
alter table public.attendances enable row level security;
alter table public.announcements enable row level security;
alter table public.draws enable row level security;
alter table public.draw_teams enable row level security;
alter table public.draw_team_players enable row level security;
alter table public.draw_reserves enable row level security;
alter table public.games enable row level security;
alter table public.score_events enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

-- Remove qualquer acesso padrão das roles públicas.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Garante que nada fique acessível por padrão (RLS sem políticas = nega tudo).
-- O usuário "postgres" (usado pelo servidor) tem BYPASSRLS e continua funcionando.
