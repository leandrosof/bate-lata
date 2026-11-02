import { randomFillSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

const ADMIN = { email: "admin@arena.local", password: "Arena@2026" };
const NATALIA = { email: "natalia@arena.local", password: "Arena@2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /E aí/ })).toBeVisible();
}

async function loginAdmin(page: Page) {
  await login(page, ADMIN.email, ADMIN.password);
}

async function confirmAction(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(dialog).toBeHidden();
}

test("administrador entra e navega por todas as áreas", async ({ page }) => {
  await loginAdmin(page);

  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  for (const label of [
    "Início",
    "Próximos jogos",
    "Presenças",
    "Racha",
    "Partidas e placares",
    "Histórico",
    "Ranking",
    "Jogadores",
    "Meu perfil",
    "Administração",
  ]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  await nav.getByRole("link", { name: "Ranking" }).click();
  await expect(page.getByRole("heading", { name: "Ranking", level: 1 })).toBeVisible();
  await expect(page.getByText("Classificação")).toBeVisible();

  await page.getByRole("link", { name: "Mensal" }).click();
  await expect(page.getByText("Classificação")).toBeVisible();
  await page.getByRole("link", { name: "Temporada" }).click();
  await expect(page.getByText("Classificação")).toBeVisible();
  await page.getByRole("link", { name: "Geral" }).click();
  await expect(page.getByText("Classificação")).toBeVisible();

  await nav.getByRole("link", { name: "Histórico" }).click();
  await expect(page.getByRole("heading", { name: "Histórico", level: 1 })).toBeVisible();

  await nav.getByRole("link", { name: "Administração" }).click();
  await expect(page.getByRole("heading", { name: "Administração", level: 1 })).toBeVisible();
  await expect(page.getByText("Ações rápidas")).toBeVisible();
});

test("jogador entra na lista de espera e não confirma duas vezes", async ({ page }) => {
  await login(page, NATALIA.email, NATALIA.password);

  const waitlistButton = page.getByRole("button", { name: "Entrar na lista de espera" });
  await expect(waitlistButton).toBeVisible();
  await waitlistButton.click();

  await expect(page.getByRole("button", { name: "Sair da lista de espera" })).toBeVisible();
  await expect(page.getByText(/Você está na fila na 2ª posição/)).toBeVisible();

  await page.goto("/presencas");
  await expect(page.getByTestId("waitlist-card").getByText("Natália Costa")).toBeVisible();
  await expect(page.getByTestId("confirmed-card").getByText("Natália Costa")).toHaveCount(0);
});

test("administrador gerencia a fila e promove jogador automaticamente", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/presencas");

  const waitlist = page.getByTestId("waitlist-card");
  const confirmed = page.getByTestId("confirmed-card");

  await expect(waitlist.getByText("Natália Costa")).toBeVisible();
  await waitlist
    .locator("li")
    .filter({ hasText: "Marcos Silva" })
    .getByTitle("Remover da fila")
    .click();
  await confirmAction(page);
  await expect(waitlist.getByText("Marcos Silva")).toHaveCount(0);
  await expect(waitlist.getByText("Natália Costa")).toBeVisible();

  await confirmed
    .locator("li")
    .filter({ hasText: "Larissa Melo" })
    .getByTitle("Remover presença")
    .click();
  await confirmAction(page);

  await expect(confirmed.getByText("Natália Costa")).toBeVisible({ timeout: 20_000 });
  await expect(waitlist.getByText("Natália Costa")).toHaveCount(0);
  await expect(confirmed.getByText("Larissa Melo")).toHaveCount(0);
});

test("racha: inicia, substitui, finaliza e monta o próximo jogo", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/racha");

  await page.selectOption("#teamSize", "4");
  await page.getByRole("button", { name: "Iniciar racha" }).click();
  await expect(page.getByTestId("racha-current-game")).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar partida" })).toBeVisible();

  await page.getByRole("button", { name: "Iniciar partida" }).click();
  await expect(page.getByTestId("racha-score-a")).toBeVisible();

  await page.getByText("Substituir jogador").click();
  await page.getByRole("button", { name: "Confirmar substituição" }).click();
  await expect(page.getByText(/Substituição registrada/)).toBeVisible();

  await page.getByText("Digitar placar").click();
  await page.locator('input[name="scoreA"]').fill("25");
  await page.locator('input[name="scoreB"]').fill("18");
  await page.getByRole("button", { name: "Salvar placar" }).click();
  await expect(page.getByText(/Placar atualizado/)).toBeVisible();

  await page.getByRole("button", { name: "Finalizar partida" }).click();
  await confirmAction(page);
  await expect(page.getByText("Próxima partida").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar partida" })).toBeVisible();

  await page.goto("/historico");
  await expect(page.getByText(/3 partidas encerradas/)).toBeVisible();

  await page.goto("/ranking");
  await expect(page.getByText("Classificação")).toBeVisible();
});

test("desfazer resultado restaura a partida anterior", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/racha");

  await page.getByRole("button", { name: "Desfazer último" }).click();
  await confirmAction(page);
  await expect(page.getByTestId("racha-score-a")).toHaveText("25");
  await expect(page.getByTestId("racha-score-b")).toHaveText("18");

  await page.getByRole("button", { name: "Finalizar partida" }).click();
  await confirmAction(page);
  await expect(page.getByText("Próxima partida").first()).toBeVisible();
});

test("administrador cria evento e publica aviso", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/jogos");

  const today = new Date();
  const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  await page.getByTestId(`calendar-day-${dayKey}`).click();
  await page.locator("#cal-title").fill("Jogo E2E");
  await page.locator("#cal-start").fill(`${tomorrowKey}T19:00`);
  await page.locator("#cal-end").fill(`${tomorrowKey}T21:00`);
  await page.locator("#cal-max").fill("10");
  await page.locator("#cal-venue").fill("Arena E2E");
  await page.locator("#cal-surface").selectOption("COURT");
  await page.getByRole("button", { name: "Criar evento" }).click();
  await expect(page.getByText("Evento criado.")).toBeVisible();

  await page.goto("/admin/eventos");
  await expect(page.getByText("Jogo E2E").first()).toBeVisible();

  await page.goto("/admin/avisos");
  await page.fill('input[name="title"]', "Aviso E2E");
  await page.fill('textarea[name="body"]', "Cheguem com antecedência para o aquecimento.");
  await page.getByRole("button", { name: "Publicar aviso" }).click();
  await expect(page.getByText("Aviso publicado.")).toBeVisible();
  await expect(page.getByText("Aviso E2E").first()).toBeVisible();

  await page.goto("/inicio");
  await expect(page.getByText("Aviso E2E")).toBeVisible();
});

test("novo jogador se cadastra, confirma presença e não acessa administração", async ({ page }) => {
  await page.goto("/cadastro");
  await page.fill('input[name="name"]', "Novato E2E");
  await page.fill('input[name="email"]', "novato@arena.local");
  await page.fill('input[name="password"]', "Arena@2026");
  await page.fill('input[name="confirmPassword"]', "Arena@2026");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /Novato/ })).toBeVisible();

  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 20_000 });

  await page.goto("/jogos");
  const eventCard = page
    .locator("div.card")
    .filter({ has: page.getByRole("heading", { name: "Jogo E2E", exact: true }) })
    .first();
  await eventCard.getByRole("button", { name: "Confirmar presença" }).click();
  await expect(eventCard.getByRole("button", { name: "Cancelar presença" })).toBeVisible();

  await eventCard.getByRole("button", { name: "Cancelar presença" }).click();
  await confirmAction(page);
  await expect(eventCard.getByRole("button", { name: "Confirmar presença" })).toBeVisible();
});

test("administrador ativa e desativa o ranking sem perder resultados", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/config");

  const rankingSwitch = page.locator('input[name="rankingEnabled"]');
  await expect(rankingSwitch).toBeChecked();
  await rankingSwitch.uncheck();
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();

  await page.goto("/ranking");
  await expect(page.getByText("Ranking desativado")).toBeVisible();

  await page.goto("/admin/config");
  await page.locator('input[name="rankingEnabled"]').check();
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();

  await page.goto("/ranking");
  await expect(page.getByText("Classificação")).toBeVisible();
});

test("recuperação de senha por e-mail e login com a nova senha", async ({ page }) => {
  await page.goto("/recuperar-senha");
  await page.fill('input[name="email"]', "ana@arena.local");
  await page.getByRole("button", { name: "Enviar link de redefinição" }).click();
  await expect(page.getByText(/Se este e-mail estiver cadastrado/)).toBeVisible();

  const outbox = path.join(process.cwd(), ".data", "e2e", "outbox");
  let resetLink: string | null = null;

  for (let attempt = 0; attempt < 40 && !resetLink; attempt += 1) {
    if (fs.existsSync(outbox)) {
      const files = fs
        .readdirSync(outbox)
        .filter((file) => file.endsWith(".txt"))
        .sort()
        .reverse();
      for (const file of files) {
        const content = fs.readFileSync(path.join(outbox, file), "utf8");
        const match = content.match(/https?:\/\/[^\s"<]+\/redefinir-senha\/[A-Za-z0-9_-]+/);
        if (match) {
          resetLink = match[0];
          break;
        }
      }
    }
    if (!resetLink) await page.waitForTimeout(250);
  }

  expect(resetLink, "link de redefinição não encontrado no outbox").not.toBeNull();
  await page.goto(resetLink!);
  await page.fill('input[name="password"]', "NovaSenha@2026");
  await page.fill('input[name="confirmPassword"]', "NovaSenha@2026");
  await page.getByRole("button", { name: "Criar nova senha" }).click();
  await expect(page).toHaveURL(/senha=alterada/);
  await expect(page.getByText("Senha alterada com sucesso.")).toBeVisible();

  await page.fill('input[name="email"]', "ana@arena.local");
  await page.fill('input[name="password"]', "Arena@2026");
  await page.click('button[type="submit"]');
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();

  await page.fill('input[name="password"]', "NovaSenha@2026");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 20_000 });
});

test("perfil: editar dados e enviar foto", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/perfil");

  await page.fill('input[name="nickname"]', "Rafa E2E");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Perfil atualizado.")).toBeVisible();

  const avatarPixels = Buffer.alloc(1400 * 1400 * 3);
  randomFillSync(avatarPixels);
  const avatar = await sharp(avatarPixels, {
    raw: { width: 1400, height: 1400, channels: 3 },
  })
    .png()
    .toBuffer();
  expect(avatar.length).toBeGreaterThan(2 * 1024 * 1024);

  await page.setInputFiles('input[type="file"]', {
    name: "avatar.png",
    mimeType: "image/png",
    buffer: avatar,
  });
  await expect(page.getByText("Foto atualizada.")).toBeVisible({ timeout: 30_000 });

  const image = page.locator('img[alt^="Foto de"]').first();
  const src = await image.getAttribute("src");
  expect(src).toContain("/api/avatar/");

  const response = await page.request.get(src!.split("?")[0]);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/webp");
});

test("visitante mobile abre o menu de acesso e os termos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Abrir opções de acesso" }).click();

  const dialog = page.getByRole("dialog", { name: "Acessar o grupo" });
  await expect(dialog.getByRole("link", { name: "Entrar" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Criar conta" })).toBeVisible();

  await dialog.getByRole("link", { name: "Termos de uso" }).click();
  await expect(page).toHaveURL(/\/termos$/);
  await expect(page.getByRole("heading", { name: "Termos de Uso", level: 1 })).toBeVisible();
});

test("jogador exclui a própria conta e perde o acesso", async ({ page }) => {
  const email = `excluir-${Date.now()}@arena.local`;
  const password = "Excluir@2026";

  await page.goto("/cadastro");
  await page.locator("#name").fill("Jogador Excluir");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 20_000 });

  await page.goto("/perfil");
  await page.getByRole("button", { name: "Excluir minha conta" }).click();

  const dialog = page.getByRole("dialog", { name: "Excluir minha conta" });
  await dialog.locator('input[name="password"]').fill(password);
  await dialog.getByRole("button", { name: "Excluir minha conta" }).click();

  await expect(page).toHaveURL(/\/entrar\?conta=excluida/, { timeout: 20_000 });
  await expect(page.getByText(/Sua conta foi excluída/)).toBeVisible();

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("menu inferior, drawer e navegação principal no celular", async ({ page }) => {
    await loginAdmin(page);

    const bottomNav = page.getByRole("navigation", { name: "Navegação rápida" });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Início" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Racha" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Partidas" })).toBeVisible();

    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeHidden();

    await bottomNav.getByRole("button", { name: "Mais" }).click();
    await expect(page.getByRole("link", { name: "Administração" })).toBeVisible();
    await page.getByRole("link", { name: "Administração" }).click();
    await expect(page.getByRole("heading", { name: "Administração", level: 1 })).toBeVisible();
  });
});