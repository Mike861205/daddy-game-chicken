import './styles.css';

type RewardType = 'NONE' | 'DISCOUNT' | 'SPECIAL';

interface PromotionTier {
  minScore: number;
  maxScore: number | null;
  label: string;
  rewardType: RewardType;
  discountPercentage: number | null;
}

interface AdminConfig {
  businessPhone: string;
  rewardExpiryHours: number;
  tiers: PromotionTier[];
}

type DeploymentState = 'idle' | 'running' | 'succeeded' | 'failed';

interface DeploymentStatus {
  enabled: boolean;
  state: DeploymentState;
  phase: string;
  startedAt: string | null;
  finishedAt: string | null;
  commit: string | null;
  logs: string[];
}

const loginView = required<HTMLElement>('login-view');
const adminView = required<HTMLElement>('admin-view');
const loginForm = required<HTMLFormElement>('login-form');
const configForm = required<HTMLFormElement>('config-form');
const tiersList = required<HTMLElement>('tiers-list');
const loginError = required<HTMLElement>('login-error');
const saveMessage = required<HTMLElement>('save-message');
const saveButton = required<HTMLButtonElement>('save-button');
const deploymentPanel = required<HTMLElement>('deployment-panel');
const deploymentButton = required<HTMLButtonElement>('deployment-button');
const deploymentMessage = required<HTMLInputElement>('deployment-message');
const deploymentState = required<HTMLElement>('deployment-state');
const deploymentPhase = required<HTMLElement>('deployment-phase');
const deploymentCommit = required<HTMLElement>('deployment-commit');
const deploymentLogs = required<HTMLElement>('deployment-logs');

let currentConfig: AdminConfig | null = null;
let deploymentTimer: number | null = null;

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Falta el elemento ${id}`);
  }
  return element as T;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = (await response.json()) as { data?: T; error?: { message?: string } };
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? 'No se pudo completar la operación.');
  }
  return body.data;
}

function showLogin(): void {
  loginView.hidden = false;
  adminView.hidden = true;
  required<HTMLInputElement>('username').focus();
}

async function showAdmin(): Promise<void> {
  loginView.hidden = true;
  adminView.hidden = false;
  currentConfig = await api<AdminConfig>('/configuration');
  required<HTMLInputElement>('business-phone').value = currentConfig.businessPhone;
  required<HTMLInputElement>('reward-expiry').value = String(currentConfig.rewardExpiryHours);
  renderTiers();
  await loadDeploymentModule();
}

function stopDeploymentPolling(): void {
  if (deploymentTimer !== null) {
    window.clearInterval(deploymentTimer);
    deploymentTimer = null;
  }
}

function renderDeployment(status: DeploymentStatus): void {
  deploymentPanel.hidden = !status.enabled;
  if (!status.enabled) {
    stopDeploymentPolling();
    return;
  }
  deploymentState.className = `deployment-state deployment-state--${status.state}`;
  deploymentState.textContent = {
    idle: 'Listo',
    running: 'En proceso',
    succeeded: 'Completado',
    failed: 'FallÃ³',
  }[status.state];
  deploymentPhase.textContent = status.phase;
  deploymentCommit.textContent = status.commit ? `Commit ${status.commit.slice(0, 12)}` : '';
  deploymentLogs.textContent = status.logs.length > 0 ? status.logs.join('\n') : 'Sin ejecuciones todavÃ­a.';
  deploymentLogs.scrollTop = deploymentLogs.scrollHeight;
  deploymentButton.disabled = status.state === 'running';
  deploymentButton.textContent = status.state === 'running' ? 'Desplegandoâ€¦' : 'Push + Deploy';

  if (status.state === 'running' && deploymentTimer === null) {
    deploymentTimer = window.setInterval(() => void refreshDeploymentStatus(), 1500);
  } else if (status.state !== 'running') {
    stopDeploymentPolling();
  }
}

async function refreshDeploymentStatus(): Promise<void> {
  try {
    renderDeployment(await api<DeploymentStatus>('/deployment'));
  } catch {
    stopDeploymentPolling();
  }
}

async function loadDeploymentModule(): Promise<void> {
  try {
    renderDeployment(await api<DeploymentStatus>('/deployment'));
  } catch {
    deploymentPanel.hidden = true;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    };
    return entities[character] ?? character;
  });
}

function renderTiers(): void {
  if (!currentConfig) return;
  tiersList.innerHTML = '';

  currentConfig.tiers.forEach((tier, index) => {
    const card = document.createElement('article');
    card.className = 'tier-card';
    card.dataset.index = String(index);
    card.innerHTML = `
      <div class="tier-card__number"><span>${index + 1}</span></div>
      <div class="tier-card__content">
        <div class="tier-card__topline">
          <strong>Nivel ${index + 1}</strong>
          <button class="icon-button remove-tier" type="button" aria-label="Eliminar nivel ${index + 1}" ${currentConfig!.tiers.length === 1 ? 'disabled' : ''}>×</button>
        </div>
        <div class="tier-grid">
          <label class="field"><span>Puntos desde</span><input data-field="minScore" type="number" min="0" value="${tier.minScore}" required /></label>
          <label class="field"><span>Puntos hasta</span><input data-field="maxScore" type="number" min="0" value="${tier.maxScore ?? ''}" placeholder="Sin límite" /></label>
          <label class="field field--prize"><span>Premio o mensaje</span><input data-field="label" maxlength="120" value="${escapeHtml(tier.label)}" required /></label>
          <label class="field"><span>Tipo</span>
            <select data-field="rewardType">
              <option value="NONE" ${tier.rewardType === 'NONE' ? 'selected' : ''}>Sin premio</option>
              <option value="DISCOUNT" ${tier.rewardType === 'DISCOUNT' ? 'selected' : ''}>Descuento</option>
              <option value="SPECIAL" ${tier.rewardType === 'SPECIAL' ? 'selected' : ''}>Premio especial</option>
            </select>
          </label>
          <label class="field discount-field" ${tier.rewardType !== 'DISCOUNT' ? 'hidden' : ''}><span>Descuento</span><div class="suffix-input"><input data-field="discountPercentage" type="number" min="1" max="100" value="${tier.discountPercentage ?? ''}" /><b>%</b></div></label>
        </div>
      </div>`;

    card.querySelector<HTMLButtonElement>('.remove-tier')?.addEventListener('click', () => removeTier(index));
    card.querySelector<HTMLSelectElement>('[data-field="rewardType"]')?.addEventListener('change', (event) => {
      const select = event.currentTarget as HTMLSelectElement;
      const discount = card.querySelector<HTMLElement>('.discount-field');
      if (discount) discount.hidden = select.value !== 'DISCOUNT';
    });
    tiersList.append(card);
  });
}

function readTierCards(): PromotionTier[] {
  return [...tiersList.querySelectorAll<HTMLElement>('.tier-card')].map((card) => {
    const value = (field: string) => card.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${field}"]`)?.value.trim() ?? '';
    const maxScore = value('maxScore');
    const discount = value('discountPercentage');
    return {
      minScore: Number(value('minScore')),
      maxScore: maxScore === '' ? null : Number(maxScore),
      label: value('label'),
      rewardType: value('rewardType') as RewardType,
      discountPercentage: discount === '' ? null : Number(discount),
    };
  });
}

function addTier(): void {
  if (!currentConfig) return;
  currentConfig.tiers = readTierCards();
  const last = currentConfig.tiers.at(-1);
  const minScore = last ? (last.maxScore ?? last.minScore + 999) + 1 : 0;
  if (last?.maxScore === null) last.maxScore = minScore - 1;
  currentConfig.tiers.push({
    minScore,
    maxScore: null,
    label: 'NUEVO PREMIO DADDY POLLO',
    rewardType: 'SPECIAL',
    discountPercentage: null,
  });
  renderTiers();
  tiersList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeTier(index: number): void {
  if (!currentConfig) return;
  currentConfig.tiers = readTierCards();
  currentConfig.tiers.splice(index, 1);
  renderTiers();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const username = required<HTMLInputElement>('username').value.trim();
  const password = required<HTMLInputElement>('password').value;
  const button = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    await api<{ authenticated: boolean }>('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    required<HTMLInputElement>('password').value = '';
    await showAdmin();
  } catch (error) {
    loginError.textContent = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
  } finally {
    if (button) button.disabled = false;
  }
});

configForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveMessage.className = 'form-message';
  saveMessage.textContent = 'Guardando cambios…';
  saveButton.disabled = true;

  const config: AdminConfig = {
    businessPhone: required<HTMLInputElement>('business-phone').value.replace(/\D/gu, ''),
    rewardExpiryHours: Number(required<HTMLInputElement>('reward-expiry').value),
    tiers: readTierCards(),
  };

  try {
    currentConfig = await api<AdminConfig>('/configuration', { method: 'PUT', body: JSON.stringify(config) });
    renderTiers();
    saveMessage.className = 'form-message form-message--success';
    saveMessage.textContent = '✓ Configuración guardada y activa';
  } catch (error) {
    saveMessage.className = 'form-message form-message--error';
    saveMessage.textContent = error instanceof Error ? error.message : 'No se pudo guardar.';
  } finally {
    saveButton.disabled = false;
  }
});

required<HTMLButtonElement>('add-tier').addEventListener('click', addTier);
deploymentButton.addEventListener('click', async () => {
  const message = deploymentMessage.value.trim();
  if (message.length < 3) {
    deploymentMessage.focus();
    return;
  }
  const confirmed = window.confirm(
    'Se validarÃ¡ todo el proyecto, se enviarÃ¡ main a GitHub y se actualizarÃ¡ producciÃ³n. Â¿Continuar?',
  );
  if (!confirmed) return;

  deploymentButton.disabled = true;
  try {
    renderDeployment(
      await api<DeploymentStatus>('/deployment', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    );
  } catch (error) {
    deploymentState.className = 'deployment-state deployment-state--failed';
    deploymentState.textContent = 'FallÃ³';
    deploymentPhase.textContent = error instanceof Error ? error.message : 'No se pudo iniciar.';
    deploymentButton.disabled = false;
  }
});
required<HTMLButtonElement>('logout-button').addEventListener('click', async () => {
  stopDeploymentPolling();
  await api<{ authenticated: boolean }>('/logout', { method: 'POST', body: '{}' });
  showLogin();
});

void (async () => {
  try {
    const session = await api<{ authenticated: boolean }>('/session');
    if (session.authenticated) await showAdmin();
    else showLogin();
  } catch {
    showLogin();
  }
})();
