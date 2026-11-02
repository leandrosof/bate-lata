import { CalendarRange, Save, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { activateSeasonAction, saveSeasonAction, updateSettingsAction } from "@/actions/admin";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { Input, Label, Select, Switch, Textarea } from "@/components/ui/input";
import { LogoUpload } from "@/components/features/image-uploads";
import { getSettings, listSeasons } from "@/lib/settings";
import { toDateInput } from "@/lib/time";
import { TEAM_SIZE_OPTIONS } from "@/lib/teams";
import { formatDateShort } from "@/lib/time";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();
  const seasons = await listSeasons();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identidade e regras</CardTitle>
          <Settings className="h-4 w-4 text-muted" aria-hidden />
        </CardHeader>
        <CardBody className="pt-2">
          <ActionForm
            action={updateSettingsAction}
            submitLabel="Salvar configurações"
            variant="primary"
            submitIcon={<Save className="h-4 w-4" aria-hidden />}
          >
            <div key={`settings-fields-${settings.updatedAt.getTime()}`} className="space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="siteName" required>
                  Nome do site
                </Label>
                <Input id="siteName" name="siteName" defaultValue={settings.siteName} required maxLength={60} />
                <p className="mt-1 text-[11px] text-muted">Aparece no topo, no menu e no PWA.</p>
              </div>
              <div>
                <Label htmlFor="tagline">Slogan</Label>
                <Input id="tagline" name="tagline" defaultValue={settings.tagline} maxLength={80} />
              </div>
            </div>

            <div className="rounded-xl border border-line/70 p-3">
              <LogoUpload
                hasLogo={Boolean(settings.logoData)}
                version={settings.logoUpdatedAt?.getTime() ?? null}
              />
            </div>

            <div>
              <Label htmlFor="logoUrl">URL externa da logo (opcional)</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                defaultValue={settings.logoUrl ?? ""}
                placeholder="https://exemplo.com/logo.png"
              />
              <p className="mt-1 text-[11px] text-muted">
                Deixe vazio para usar o ícone padrão. Recomendado: PNG quadrado com pelo menos 256×256.
              </p>
            </div>

            <div>
              <Label htmlFor="aboutText">Sobre o grupo</Label>
              <Textarea
                id="aboutText"
                name="aboutText"
                defaultValue={settings.aboutText ?? ""}
                maxLength={2000}
                placeholder="Quem somos, como nos reunimos, que tipo de vôlei jogamos..."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="rulesText">Regras do grupo</Label>
                <Textarea
                  id="rulesText"
                  name="rulesText"
                  defaultValue={settings.rulesText ?? ""}
                  maxLength={2000}
                />
              </div>
              <div>
                <Label htmlFor="contactText">Contato/redes</Label>
                <Textarea
                  id="contactText"
                  name="contactText"
                  defaultValue={settings.contactText ?? ""}
                  maxLength={500}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pointsWin" required>
                  Pontos por vitória
                </Label>
                <Input
                  id="pointsWin"
                  name="pointsWin"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={settings.pointsWin}
                  required
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label htmlFor="pointsLoss" required>
                  Pontos por derrota
                </Label>
                <Input
                  id="pointsLoss"
                  name="pointsLoss"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={settings.pointsLoss}
                  required
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="defaultTeamSize" required>
                  Jogadores por time (padrão)
                </Label>
                <Select id="defaultTeamSize" name="defaultTeamSize" defaultValue={String(settings.defaultTeamSize)}>
                  {TEAM_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size} jogadores
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="timezone" required>
                  Fuso horário
                </Label>
                <Input id="timezone" name="timezone" defaultValue={settings.timezone} required maxLength={60} />
                <p className="mt-1 text-[11px] text-muted">Ex.: America/Sao_Paulo</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Switch
                name="rankingEnabled"
                label="Exibir ranking"
                description="Desativar oculta a página sem apagar resultados"
                defaultChecked={settings.rankingEnabled}
              />
              <Switch
                name="allowWaitlist"
                label="Lista de espera automática"
                description="Quando lotar, próximos entram na fila"
                defaultChecked={settings.allowWaitlist}
              />
            </div>
            </div>
          </ActionForm>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking mensal e pontuação</CardTitle>
          <SlidersHorizontal className="h-4 w-4 text-muted" aria-hidden />
        </CardHeader>
        <CardBody className="space-y-2 pt-2 text-sm text-muted">
          <p>
            Cada vitória vale <strong className="text-ink">{settings.pointsWin} ponto(s)</strong> e cada derrota vale{" "}
            <strong className="text-ink">{settings.pointsLoss} ponto(s)</strong>. O ranking mensal reinicia a cada mês
            do calendário; o ranking geral considera todo o histórico.
          </p>
          <p>
            Rankings são calculados automaticamente a partir de partidas encerradas. Partidas em andamento, canceladas
            ou sem resultado confirmado não contam.
          </p>
          <p className="flex items-center gap-1.5 text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Alterar os pontos recalcula todas as posições na hora.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Temporadas</CardTitle>
          <CalendarRange className="h-4 w-4 text-muted" aria-hidden />
        </CardHeader>
        <CardBody className="space-y-3 pt-2">
          <ActionForm
            action={saveSeasonAction}
            submitLabel="Criar temporada"
            resetOnSuccess
            submitIcon={<CalendarRange className="h-4 w-4" aria-hidden />}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label htmlFor="season-name" required>
                  Nome
                </Label>
                <Input id="season-name" name="name" required maxLength={60} placeholder={`Temporada ${new Date().getFullYear()}`} />
              </div>
              <div>
                <Label htmlFor="season-start" required>
                  Início
                </Label>
                <Input id="season-start" name="startsOn" type="date" required />
              </div>
              <div>
                <Label htmlFor="season-end">Fim</Label>
                <Input id="season-end" name="endsOn" type="date" />
              </div>
              <div className="flex items-end pb-2">
                <Switch name="isActive" label="Ativar agora" description="Só uma temporada ativa" />
              </div>
            </div>
          </ActionForm>

          <div className="space-y-2">
            {seasons.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma temporada cadastrada.</p>
            ) : (
              seasons.map((season) => (
                <div key={season.id} className="rounded-xl border border-line bg-surface-2/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-ink">{season.name}</p>
                        {season.isActive ? <Badge tone="success">Ativa</Badge> : null}
                      </div>
                      <p className="text-[11px] text-muted">
                        {formatDateShort(season.startsOn, settings.timezone)}
                        {season.endsOn ? ` até ${formatDateShort(season.endsOn, settings.timezone)}` : " em diante"}
                      </p>
                    </div>
                    {!season.isActive ? (
                      <ActionButton
                        action={activateSeasonAction}
                        fields={{ seasonId: season.id }}
                        variant="secondary"
                        size="sm"
                      >
                        Ativar
                      </ActionButton>
                    ) : null}
                  </div>

                  <Disclosure title="Editar temporada" className="mt-2">
                    <ActionForm
                      action={saveSeasonAction}
                      hiddenFields={{ seasonId: season.id }}
                      submitLabel="Salvar temporada"
                      size="sm"
                    >
                      <div
                        key={`season-fields-${season.id}-${season.name}-${season.startsOn.getTime()}-${season.endsOn?.getTime() ?? 0}-${season.isActive}`}
                        className="grid gap-3 sm:grid-cols-3"
                      >
                        <div className="sm:col-span-3">
                          <Label htmlFor={`sn-${season.id}`}>Nome</Label>
                          <Input
                            id={`sn-${season.id}`}
                            name="name"
                            defaultValue={season.name}
                            required
                            maxLength={60}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`ss-${season.id}`}>Início</Label>
                          <Input
                            id={`ss-${season.id}`}
                            name="startsOn"
                            type="date"
                            defaultValue={toDateInput(season.startsOn, settings.timezone)}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor={`se-${season.id}`}>Fim</Label>
                          <Input
                            id={`se-${season.id}`}
                            name="endsOn"
                            type="date"
                            defaultValue={season.endsOn ? toDateInput(season.endsOn, settings.timezone) : ""}
                          />
                        </div>
                        <div className="flex items-end pb-2">
                          <Switch
                            name="isActive"
                            label="Ativa"
                            defaultChecked={season.isActive}
                            description="Desativa as demais"
                          />
                        </div>
                      </div>
                    </ActionForm>
                  </Disclosure>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
