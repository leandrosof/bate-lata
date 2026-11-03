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

async function waitForOutboxLink(page: Page, email: string, pathSegment: string) {
  const outbox = path.join(process.cwd(), ".data", "e2e", "outbox");
  const pattern = new RegExp(`https?://[^\\s"<]+/${pathSegment}/[A-Za-z0-9_-]+`);
  let link: string | null = null;

  for (let attempt = 0; attempt < 60 && !link; attempt += 1) {
    if (fs.existsSync(outbox)) {
      const files = fs
        .readdirSync(outbox)
        .filter((file) => file.endsWith(".txt"))
        .sort()
        .reverse();
      for (const file of files) {
        const content = fs.readFileSync(path.join(outbox, file), "utf8");
        if (!content.includes(email)) continue;
        const match = content.match(pattern);
        if (match) {
          link = match[0];
          break;
        }
      }
    }
    if (!link) await page.waitForTimeout(250);
  }

  expect(link, `link ${pathSegment} não encontrado no outbox para ${email}`).not.toBeNull();
  return link!;
}

async function registerAndVerify(page: Page, email: string, password: string, name: string) {
  await page.goto("/cadastro");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/verificar-email/, { timeout: 20_000 });

  const link = await waitForOutboxLink(page, email, "verificar-email");
  await page.goto(link);
  await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
  await expect(page).toHaveURL(/\/entrar\?verificado=1/, { timeout: 20_000 });
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
  await registerAndVerify(page, "novato@arena.local", "Arena@2026", "Novato E2E");
  await login(page, "novato@arena.local", "Arena@2026");
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

test("evento pago reserva vaga até o admin aprovar o Pix", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/config");
  await page.locator("#pixKey").fill("pix@arena.local");
  await page.locator("#pixRecipientName").fill("Leandro Silva");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByText("Configurações salvas.")).toBeVisible();

  await page.goto("/jogos");
  const today = new Date();
  const paidDay = new Date(today);
  paidDay.setDate(today.getDate() + 2);
  const paidKey = `${paidDay.getFullYear()}-${String(paidDay.getMonth() + 1).padStart(2, "0")}-${String(paidDay.getDate()).padStart(2, "0")}`;
  await page.getByTestId(`calendar-day-${paidKey}`).click();
  await page.locator("#cal-title").fill("Jogo Pago E2E");
  await page.locator("#cal-start").fill(`${paidKey}T19:00`);
  await page.locator("#cal-end").fill(`${paidKey}T21:00`);
  await page.locator("#cal-max").fill("10");
  await page.locator("#cal-venue").fill("Arena Pix");
  await page.locator("#cal-payment-mode").selectOption("PAID");
  await page.locator("#cal-price").fill("20");
  await page.locator("#cal-surface").selectOption("COURT");
  await page.getByRole("button", { name: "Criar evento" }).click();
  await expect(page.getByText("Evento criado.")).toBeVisible();

  const eventCard = page
    .locator("div.card")
    .filter({ has: page.getByRole("heading", { name: "Jogo Pago E2E", exact: true }) })
    .first();
  const presencasHref = await eventCard.getByRole("link", { name: "Lista", exact: true }).getAttribute("href");
  expect(presencasHref).toBeTruthy();
  await page.goto(presencasHref!);

  await page.getByTestId("pending-card").getByRole("button", { name: "Confirmar" }).first().click();
  await expect(page.getByTestId("pending-payment-card")).toBeVisible();
  await page.getByTestId("pending-payment-card").getByRole("button", { name: "Aprovar" }).first().click();
  await confirmAction(page);
  await expect(page.getByTestId("pending-payment-card")).toBeHidden();
  await expect(page.getByTestId("confirmed-card").getByText("Ana Souza")).toBeVisible();
});

test("comprovante Pix é enviado e aprovado manualmente", async ({ page, browser }) => {
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);

  await admin.goto("/jogos");
  const today = new Date();
  const proofDay = new Date(today);
  proofDay.setDate(today.getDate() + 3);
  const proofKey = `${proofDay.getFullYear()}-${String(proofDay.getMonth() + 1).padStart(2, "0")}-${String(proofDay.getDate()).padStart(2, "0")}`;
  await admin.getByTestId(`calendar-day-${proofKey}`).click();
  await admin.locator("#cal-title").fill("Jogo Comprovante E2E");
  await admin.locator("#cal-start").fill(`${proofKey}T19:00`);
  await admin.locator("#cal-end").fill(`${proofKey}T21:00`);
  await admin.locator("#cal-max").fill("10");
  await admin.locator("#cal-venue").fill("Arena Comprovante");
  await admin.locator("#cal-payment-mode").selectOption("PAID");
  await admin.locator("#cal-price").fill("20");
  await admin.locator('input[name="paymentProofUpload"]').check();
  await admin.locator("#cal-surface").selectOption("COURT");
  await admin.getByRole("button", { name: "Criar evento" }).click();
  await expect(admin.getByText("Evento criado.")).toBeVisible();

  const adminEventCard = admin
    .locator("div.card")
    .filter({ has: admin.getByRole("heading", { name: "Jogo Comprovante E2E", exact: true }) })
    .first();
  const presencasHref = await adminEventCard.getByRole("link", { name: "Lista", exact: true }).getAttribute("href");
  expect(presencasHref).toBeTruthy();

  await login(page, "novato@arena.local", "Arena@2026");
  await page.goto("/jogos");
  const eventCard = page
    .locator("div.card")
    .filter({ has: page.getByRole("heading", { name: "Jogo Comprovante E2E", exact: true }) })
    .first();
  await eventCard.getByRole("button", { name: "Solicitar vaga (Pix)" }).click();
  const proofDialog = page.getByRole("dialog", { name: "Enviar comprovante Pix" });
  await expect(page.getByRole("button", { name: "Enviar comprovante Pix" })).toBeVisible();

  const svg = `<svg width="900" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <text x="40" y="120" font-size="40" font-family="Arial">Comprovante Pix</text>
    <text x="40" y="220" font-size="34" font-family="Arial">R$ 20,00</text>
  </svg>`;
  const proof = await sharp(Buffer.from(svg)).png().toBuffer();
  await page.getByRole("button", { name: "Enviar comprovante Pix" }).click();
  await expect(proofDialog).toContainText(
    "não será possível adicionar ou editar o comentário",
  );
  await proofDialog.locator('textarea[name="note"]').fill("Pix feito pela Maria para mim e para o Jo?o");
  await proofDialog.locator('input[type="file"]').setInputFiles({
    name: "comprovante.png",
    mimeType: "image/png",
    buffer: proof,
  });
  await expect(proofDialog.getByText("Selecionado: comprovante.png")).toBeVisible();
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/payment-proof/") &&
      response.request().method() === "POST",
  );
  await proofDialog.getByRole("button", { name: "Enviar comprovante" }).click();
  expect((await uploadResponse).ok()).toBeTruthy();
  await page.getByRole("button", { name: "Visualizar comprovante" }).click();
  const proofPreviewDialog = page.getByRole("dialog", { name: "Seu comprovante Pix" });
  await expect(proofPreviewDialog.getByAltText("Seu comprovante Pix")).toBeVisible();
  await proofPreviewDialog.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("button", { name: "Remover comprovante" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar comprovante Pix" })).toHaveCount(0);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Remover comprovante" }).click();
  await expect(page.getByRole("button", { name: "Enviar comprovante Pix" })).toBeVisible();

  await page.getByRole("button", { name: "Enviar comprovante Pix" }).click();
  await proofDialog.locator('textarea[name="note"]').fill("Pix feito pela Maria para mim e para o Jo?o");
  await proofDialog.locator('input[type="file"]').setInputFiles({
    name: "comprovante.png",
    mimeType: "image/png",
    buffer: proof,
  });
  const reuploadResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/payment-proof/") &&
      response.request().method() === "POST",
  );
  await proofDialog.getByRole("button", { name: "Enviar comprovante" }).click();
  expect((await reuploadResponse).ok()).toBeTruthy();

  await admin.goto(presencasHref!);
  await expect(admin.getByAltText("Comprovante de Novato E2E")).toBeVisible();
  await expect(admin.getByText("Pix feito pela Maria para mim e para o Jo?o")).toBeVisible();
  await admin.getByTestId("pending-payment-card").getByRole("button", { name: "Aprovar" }).click();
  await confirmAction(admin);
  await expect(admin.getByTestId("confirmed-card").getByText("Novato E2E")).toBeVisible();
  await adminContext.close();
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

test("administrador gera link de redefinição copiável", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/jogadores");

  const card = page.locator("div.card").filter({ hasText: "Bruno Lima" }).first();
  await card.getByText("Gerenciar acesso").click();
  await card.getByRole("button", { name: "Gerar link de senha" }).click();

  const link = card.getByLabel("Link de redefinição de senha");
  await expect(link).toBeVisible();
  await expect(link).toHaveValue(/\/redefinir-senha\//);

  await card.getByRole("button", { name: "Copiar" }).click();
  await expect(card.getByRole("button", { name: "Copiado!" })).toBeVisible();
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

  await registerAndVerify(page, email, password, "Jogador Excluir");
  await login(page, email, password);

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