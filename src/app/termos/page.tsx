import Link from "next/link";
import { ArrowLeft, FileText, MessageCircle } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";
import { formatDateLong } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Termos de Uso" };

export default async function TermsPage() {
  const settings = await getSettings();
  const logoUrl = settings.logoData
    ? `/api/logo?v=${settings.logoUpdatedAt?.getTime() ?? 0}`
    : settings.logoUrl;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 px-4">
          <Brand
            compact
            siteName={settings.siteName}
            tagline={settings.tagline}
            logoUrl={logoUrl}
            href="/"
          />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "hidden sm:inline-flex")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        <article className="card p-5 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand">Documento</p>
              <h1 className="font-display text-3xl font-semibold uppercase tracking-wide text-ink">
                Termos de Uso
              </h1>
              <p className="mt-1 text-sm text-muted">
                Última atualização: {formatDateLong(new Date(), settings.timezone)}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-muted">
            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                1. Sobre estes termos
              </h2>
              <p>
                Estes termos explicam o funcionamento do {settings.siteName} e as regras para uso da
                conta, da lista de presença, dos times, dos placares e do ranking do grupo. Ao criar uma
                conta ou usar o site, você concorda com estas condições.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                2. Sua conta
              </h2>
              <p>
                Cada pessoa deve usar a própria conta. O e-mail é usado para login e recuperação de senha,
                e a senha é armazenada com hash seguro. Não compartilhe sua senha e avise um administrador
                se desconfiar de acesso indevido.
              </p>
              <p>
                Os administradores do grupo são definidos pelo próprio grupo e podem gerenciar acessos,
                permissões e redefinições de senha.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                3. Uso do grupo
              </h2>
              <p>
                O espaço é para organizar o vôlei e a resenha do grupo. Cada pessoa deve tratar as outras
                com respeito, confirmar apenas o que pretende cumprir e avisar quando não puder comparecer.
                Não é permitido usar o site para constranger, ameaçar ou prejudicar outras pessoas.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                4. Presenças, times e resultados
              </h2>
              <p>
                As presenças, a fila de espera, os times e os placares são organizados pelo grupo e pelos
                administradores. O sistema pode alterar a ordem da fila, montar times automaticamente e
                corrigir resultados conforme as regras definidas no site.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                5. Imagens e conteúdo
              </h2>
              <p>
                Ao enviar fotos, logos ou capas, você confirma que tem permissão para usar a imagem. As
                imagens são redimensionadas e comprimidas automaticamente para economizar espaço e melhorar
                o carregamento. Evite enviar documentos, dados sensíveis ou imagens de terceiros sem
                autorização.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                6. Privacidade e exclusão de conta
              </h2>
              <p>
                Você pode excluir sua conta pela página de perfil. A exclusão remove seus dados de acesso,
                nome, e-mail, apelido e fotos, encerra suas sessões e desativa o login. Para preservar o
                histórico do grupo, as partidas e estatísticas antigas continuam registradas de forma
                anônima.
              </p>
              <p>
                Se você for o único administrador ativo, promova outra pessoa antes de excluir a conta.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                7. Disponibilidade e alterações
              </h2>
              <p>
                O site pode passar por manutenção, atualizações ou indisponibilidades temporárias. Estes
                termos podem ser atualizados para refletir melhorias no sistema ou mudanças nas regras do
                grupo. A versão publicada nesta página é a que vale.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                8. Contato
              </h2>
              {settings.contactText ? (
                <div className="flex items-start gap-2 rounded-xl border border-line bg-surface-2/50 p-3">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span className="whitespace-pre-line">{settings.contactText}</span>
                </div>
              ) : (
                <p>
                  Para dúvidas sobre estes termos ou sobre sua conta, fale com um administrador do grupo.
                </p>
              )}
            </section>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <Link href="/" className={cn(buttonVariants({ variant: "secondary", size: "md" }))}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Voltar ao início
            </Link>
            <Link href="/entrar" className={cn(buttonVariants({ variant: "ghost", size: "md" }))}>
              Entrar na minha conta
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
