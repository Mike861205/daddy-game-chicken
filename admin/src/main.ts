import './styles.css';

type RewardType = 'NONE' | 'DISCOUNT' | 'SPECIAL';

interface PromotionTier {
  levelName: string;
  minScore: number;
  maxScore: number | null;
  label: string;
  rewardType: RewardType;
  discountPercentage: number | null;
}

interface AdminConfig {
  businessPhone: string;
  rewardExpiryHours: number;
  difficultyLevel: number;
  bossArrivalSeconds: number;
  tiers: PromotionTier[];
}

type DeploymentState = 'idle' | 'running' | 'succeeded' | 'failed';
type AdminModule =
  | 'overview'
  | 'reports'
  | 'memberships'
  | 'notifications'
  | 'game'
  | 'rewards'
  | 'deployment';

interface DeploymentStatus {
  enabled: boolean;
  state: DeploymentState;
  phase: string;
  startedAt: string | null;
  finishedAt: string | null;
  commit: string | null;
  logs: string[];
}

type ReportSortBy =
  | 'createdAt'
  | 'nickname'
  | 'name'
  | 'phone'
  | 'gameCount'
  | 'totalDurationSeconds'
  | 'bestScore'
  | 'rewardCount'
  | 'lastPlayedAt';

interface PlayerReportRow {
  id: string;
  createdAt: string;
  name: string | null;
  nickname: string;
  phone: string | null;
  gameCount: number;
  totalDurationSeconds: number;
  bestScore: number;
  rewardCount: number;
  rewardLabels: string | null;
  lastPlayedAt: string | null;
}

interface PlayerReport {
  summary: {
    totalPlayers: number;
    totalSessions: number;
    totalDurationSeconds: number;
    totalRewards: number;
    returningPlayers: number;
    rewardedPlayers: number;
    rewardRate: number;
  };
  players: PlayerReportRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalPlayers: number;
    totalPages: number;
  };
  appliedRange: {
    from: string | null;
    to: string | null;
  };
}

type MembershipSortBy =
  | 'joinedAt'
  | 'plan'
  | 'status'
  | 'nickname'
  | 'name'
  | 'phone'
  | 'gameCount'
  | 'totalDurationSeconds'
  | 'totalPoints'
  | 'bestScore'
  | 'lastPlayedAt';

interface MembershipReportRow {
  id: string;
  joinedAt: string;
  updatedAt: string;
  name: string | null;
  nickname: string;
  phone: string | null;
  plan: 'DADDY_PLUS' | 'DADDY_ELITE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  gameCount: number;
  totalDurationSeconds: number;
  totalPoints: number;
  bestScore: number;
  lastPlayedAt: string | null;
  benefitsGenerated: number;
  benefitsRedeemed: number;
}

interface MembershipReport {
  summary: {
    totalMembers: number;
    activeMembers: number;
    plusMembers: number;
    eliteMembers: number;
    attentionMembers: number;
    monthlyRevenue: number;
    totalSessions: number;
    totalDurationSeconds: number;
    totalPoints: number;
  };
  members: MembershipReportRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalMembers: number;
    totalPages: number;
  };
}

type NotificationAudience = 'ALL' | 'INSTALLED' | 'BROWSER';
type NotificationKind = 'REMINDER' | 'PROMOTION';

interface NotificationCampaign {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  audience: NotificationAudience;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  createdAt: string;
}

interface NotificationSummary {
  enabled: boolean;
  registeredPlayers: number;
  activeSubscriptions: number;
  installedSubscriptions: number;
  browserSubscriptions: number;
  registeredWithoutPush: number;
  campaigns: NotificationCampaign[];
}

const loginView = required<HTMLElement>('login-view');
const adminView = required<HTMLElement>('admin-view');
const loginForm = required<HTMLFormElement>('login-form');
const configForm = required<HTMLFormElement>('config-form');
const tiersList = required<HTMLElement>('tiers-list');
const loginError = required<HTMLElement>('login-error');
const saveMessage = required<HTMLElement>('save-message');
const saveButton = required<HTMLButtonElement>('save-button');
const difficultyLevel = required<HTMLInputElement>('difficulty-level');
const difficultyNumber = required<HTMLInputElement>('difficulty-number');
const difficultyName = required<HTMLElement>('difficulty-name');
const difficultyEffects = required<HTMLElement>('difficulty-effects');
const deploymentPanel = required<HTMLElement>('deployment-panel');
const deploymentButton = required<HTMLButtonElement>('deployment-button');
const deploymentMessage = required<HTMLInputElement>('deployment-message');
const deploymentState = required<HTMLElement>('deployment-state');
const deploymentPhase = required<HTMLElement>('deployment-phase');
const deploymentCommit = required<HTMLElement>('deployment-commit');
const deploymentLogs = required<HTMLElement>('deployment-logs');
const deploymentModal = required<HTMLElement>('deployment-confirm-modal');
const deploymentConfirmButton = required<HTMLButtonElement>('deployment-confirm');
const deploymentConfirmMessage = required<HTMLElement>('deployment-confirm-message');
const reportPeriod = required<HTMLSelectElement>('report-period');
const reportDay = required<HTMLInputElement>('report-day');
const reportMonth = required<HTMLInputElement>('report-month');
const reportYear = required<HTMLInputElement>('report-year');
const reportFrom = required<HTMLInputElement>('report-from');
const reportTo = required<HTMLInputElement>('report-to');
const reportSearch = required<HTMLInputElement>('report-search');
const reportPlayersBody = required<HTMLTableSectionElement>('report-players-body');
const reportStatus = required<HTMLElement>('report-status');
const reportPage = required<HTMLElement>('report-page');
const reportPrevious = required<HTMLButtonElement>('report-previous');
const reportNext = required<HTMLButtonElement>('report-next');
const membershipSearch = required<HTMLInputElement>('membership-search');
const membershipPlanFilter = required<HTMLSelectElement>('membership-plan-filter');
const membershipStatusFilter = required<HTMLSelectElement>('membership-status-filter');
const membershipPlayersBody = required<HTMLTableSectionElement>('membership-players-body');
const membershipReportStatus = required<HTMLElement>('membership-report-status');
const membershipPage = required<HTMLElement>('membership-page');
const membershipPrevious = required<HTMLButtonElement>('membership-previous');
const membershipNext = required<HTMLButtonElement>('membership-next');
const adminSidebar = required<HTMLElement>('admin-sidebar');
const sidebarToggle = required<HTMLButtonElement>('sidebar-toggle');
const sidebarBackdrop = required<HTMLButtonElement>('sidebar-backdrop');
const currentModuleLabel = required<HTMLElement>('current-module-label');
const saveBar = required<HTMLElement>('save-bar');
const notificationForm = required<HTMLFormElement>('notification-form');
const notificationTitle = required<HTMLInputElement>('notification-title');
const notificationMessage = required<HTMLTextAreaElement>('notification-message');
const notificationSend = required<HTMLButtonElement>('notification-send');
const notificationStatus = required<HTMLElement>('notification-status');
const notificationHistory = required<HTMLElement>('notification-history');

let currentConfig: AdminConfig | null = null;
let deploymentTimer: number | null = null;
let pendingDeploymentMessage = '';
let reportCurrentPage = 1;
let reportTotalPages = 1;
let reportSortBy: ReportSortBy = 'lastPlayedAt';
let reportSortOrder: 'asc' | 'desc' = 'desc';
let reportRequestSequence = 0;
let membershipCurrentPage = 1;
let membershipTotalPages = 1;
let membershipSortBy: MembershipSortBy = 'joinedAt';
let membershipSortOrder: 'asc' | 'desc' = 'desc';
let membershipRequestSequence = 0;

const moduleLabels: Record<AdminModule, string> = {
  overview: 'Inicio',
  reports: 'Informes',
  memberships: 'Membresías',
  notifications: 'Notificaciones',
  game: 'Configuración',
  rewards: 'Premios',
  deployment: 'Despliegue',
};

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

function moduleFromHash(): AdminModule {
  const value = window.location.hash.replace(/^#/u, '');
  if (value === 'player-reports') return 'reports';
  if (value === 'membership-reports') return 'memberships';
  return value in moduleLabels ? (value as AdminModule) : 'overview';
}

function closeSidebar(): void {
  adminSidebar.classList.remove('is-open');
  sidebarBackdrop.hidden = true;
  sidebarToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sidebar-open');
}

function openSidebar(): void {
  adminSidebar.classList.add('is-open');
  sidebarBackdrop.hidden = false;
  sidebarToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('sidebar-open');
}

function activateModule(module: AdminModule, updateHash = true): void {
  document.querySelectorAll<HTMLElement>('[data-module-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.modulePanel !== module;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-module]').forEach((button) => {
    const selected = button.dataset.module === module;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-current', selected ? 'page' : 'false');
  });
  currentModuleLabel.textContent = moduleLabels[module];
  saveBar.hidden = module !== 'game' && module !== 'rewards';
  closeSidebar();
  if (updateHash) {
    window.history.replaceState(null, '', `#${module}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (module === 'reports' && reportPlayersBody.children.length === 0) {
    void loadPlayerReports();
  }
  if (module === 'memberships' && membershipPlayersBody.children.length === 0) {
    void loadMembershipReports();
  }
  if (module === 'notifications' && notificationHistory.dataset.loaded !== 'true') {
    void loadNotificationSummary();
  }
}

function showLogin(): void {
  loginView.hidden = false;
  adminView.hidden = true;
  closeSidebar();
  required<HTMLInputElement>('username').focus();
}

async function showAdmin(): Promise<void> {
  loginView.hidden = true;
  adminView.hidden = false;
  currentConfig = await api<AdminConfig>('/configuration');
  required<HTMLInputElement>('business-phone').value = currentConfig.businessPhone;
  required<HTMLInputElement>('reward-expiry').value = String(currentConfig.rewardExpiryHours);
  required<HTMLInputElement>('boss-arrival-seconds').value = String(currentConfig.bossArrivalSeconds);
  updateBossArrivalPreview(currentConfig.bossArrivalSeconds);
  setDifficulty(currentConfig.difficultyLevel);
  renderTiers();
  await Promise.all([
    loadDeploymentModule(),
    loadPlayerReports(),
    loadMembershipReports(),
  ]);
  activateModule(moduleFromHash(), false);
}

function difficultyLabel(level: number): string {
  if (level <= 1) return 'Muy fácil';
  if (level <= 3) return 'Fácil';
  if (level <= 6) return 'Normal';
  if (level <= 8) return 'Difícil';
  return 'Extrema';
}

function setDifficulty(rawLevel: number): void {
  const level = Math.max(0, Math.min(10, Math.round(rawLevel)));
  difficultyLevel.value = String(level);
  difficultyNumber.value = String(level);
  difficultyName.textContent = `${level} · ${difficultyLabel(level)}`;

  const offset = (level - 5) / 5;
  const scorePercent = Math.round((1 - 0.2 * offset) * 100);
  const speedPercent = Math.round((1 + 0.28 * offset) * 100);
  const enemyFrequencyPercent = Math.round((1 / (1 - 0.35 * offset)) * 100);
  difficultyEffects.innerHTML = `
    <span><b>${scorePercent}%</b> de puntos</span>
    <span><b>${speedPercent}%</b> de velocidad</span>
    <span><b>${enemyFrequencyPercent}%</b> de frecuencia rival</span>`;
}

function updateBossArrivalPreview(rawSeconds: number): void {
  const seconds = Math.max(30, Math.min(600, Math.round(rawSeconds || 120)));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const formatted = minutes > 0
    ? `${minutes} min${remainingSeconds > 0 ? ` ${remainingSeconds} s` : ''}`
    : `${remainingSeconds} s`;
  required<HTMLElement>('boss-arrival-preview').textContent =
    `El jefe final aparecerá después de ${formatted} de juego normal en cada mundo.`;
}

function stopDeploymentPolling(): void {
  if (deploymentTimer !== null) {
    window.clearInterval(deploymentTimer);
    deploymentTimer = null;
  }
}

function renderDeployment(status: DeploymentStatus): void {
  deploymentPanel.hidden = !status.enabled;
  required<HTMLElement>('deployment-unavailable').hidden = status.enabled;
  if (!status.enabled) {
    stopDeploymentPolling();
    return;
  }
  deploymentState.className = `deployment-state deployment-state--${status.state}`;
  deploymentState.textContent = {
    idle: 'Listo',
    running: 'En proceso',
    succeeded: 'Completado',
    failed: 'Falló',
  }[status.state];
  deploymentPhase.textContent = status.phase;
  deploymentCommit.textContent = status.commit ? `Commit ${status.commit.slice(0, 12)}` : '';
  deploymentLogs.textContent = status.logs.length > 0 ? status.logs.join('\n') : 'Sin ejecuciones todavía.';
  deploymentLogs.scrollTop = deploymentLogs.scrollHeight;
  deploymentButton.disabled = status.state === 'running';
  deploymentButton.textContent = status.state === 'running' ? 'Desplegando…' : 'Push + Deploy';

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
    required<HTMLElement>('deployment-unavailable').hidden = false;
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

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function initializeReportDates(): void {
  const now = new Date();
  const today = toDateInputValue(now);
  reportDay.value = today;
  reportMonth.value = today.slice(0, 7);
  reportYear.value = String(now.getFullYear());
  reportFrom.value = today;
  reportTo.value = today;
}

function updateReportPeriodControls(): void {
  document.querySelectorAll<HTMLElement>('.report-period-control').forEach((control) => {
    control.hidden = control.dataset.period !== reportPeriod.value;
  });
}

function resolveReportRange(): { from?: string; to?: string } {
  let start: Date | null = null;
  let end: Date | null = null;
  if (reportPeriod.value === 'day') {
    if (!reportDay.value) throw new Error('Selecciona el día del informe.');
    start = parseLocalDate(reportDay.value);
    end = addLocalDays(start, 1);
  } else if (reportPeriod.value === 'month') {
    if (!reportMonth.value) throw new Error('Selecciona el mes del informe.');
    const [year, month] = reportMonth.value.split('-').map(Number);
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
  } else if (reportPeriod.value === 'year') {
    const year = Number(reportYear.value);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      throw new Error('Escribe un año válido entre 2020 y 2100.');
    }
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  } else if (reportPeriod.value === 'custom') {
    if (!reportFrom.value || !reportTo.value) {
      throw new Error('Completa las dos fechas del rango personalizado.');
    }
    start = parseLocalDate(reportFrom.value);
    end = addLocalDays(parseLocalDate(reportTo.value), 1);
    if (start >= end) throw new Error('La fecha inicial debe ser anterior a la final.');
  }
  return start && end ? { from: start.toISOString(), to: end.toISOString() } : {};
}

function formatReportDate(value: string | null): string {
  if (!value) return 'Sin partidas';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function formatMetricHours(seconds: number): string {
  const hours = Math.max(0, seconds) / 3600;
  return hours.toLocaleString('es-MX', {
    minimumFractionDigits: hours > 0 && hours < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

function avatarColor(value: string): string {
  let hash = 0;
  for (const character of value) {
    hash = character.charCodeAt(0) + ((hash << 5) - hash);
    hash |= 0;
  }
  return `hsl(${Math.abs(hash) % 360} 72% 46%)`;
}

function renderReportSortState(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((button) => {
    const active = button.dataset.sort === reportSortBy;
    button.classList.toggle('is-active', active);
    const indicator = button.querySelector('i');
    if (indicator) indicator.textContent = active ? (reportSortOrder === 'asc' ? '↑' : '↓') : '↕';
    button.closest('th')?.setAttribute(
      'aria-sort',
      active ? (reportSortOrder === 'asc' ? 'ascending' : 'descending') : 'none',
    );
  });
}

function renderPlayerReport(report: PlayerReport): void {
  const { summary, pagination } = report;
  required<HTMLElement>('metric-players').textContent = summary.totalPlayers.toLocaleString('es-MX');
  required<HTMLElement>('metric-games').textContent = summary.totalSessions.toLocaleString('es-MX');
  required<HTMLElement>('metric-hours').textContent = formatMetricHours(summary.totalDurationSeconds);
  required<HTMLElement>('metric-rewards').textContent = summary.totalRewards.toLocaleString('es-MX');
  required<HTMLElement>('metric-returning').textContent = summary.returningPlayers.toLocaleString('es-MX');
  required<HTMLElement>('metric-reward-rate').textContent = `${summary.rewardRate.toLocaleString('es-MX')}%`;

  reportPlayersBody.innerHTML = report.players
    .map((player) => {
      const initial = (player.nickname.trim()[0] ?? '?').toUpperCase();
      const rewards =
        player.rewardCount > 0
          ? `<span class="reward-badge" title="${escapeHtml(player.rewardLabels ?? 'Premio generado')}">Sí · ${player.rewardCount}</span>`
          : '<span class="no-reward">No</span>';
      return `
        <tr>
          <td data-label="Fecha registro">${formatReportDate(player.createdAt)}</td>
          <td data-label="Avatar"><span class="player-avatar" style="--avatar-color:${avatarColor(player.nickname)}">${escapeHtml(initial)}</span><strong class="avatar-name">${escapeHtml(player.nickname)}</strong></td>
          <td data-label="Nombre">${escapeHtml(player.name || '—')}</td>
          <td data-label="Teléfono">${player.phone ? `<a href="tel:${escapeHtml(player.phone)}">${escapeHtml(player.phone)}</a>` : '—'}</td>
          <td data-label="Partidas"><b>${player.gameCount.toLocaleString('es-MX')}</b></td>
          <td data-label="Horas">${formatDuration(player.totalDurationSeconds)}</td>
          <td data-label="Récord"><b class="best-score">${player.bestScore.toLocaleString('es-MX')}</b></td>
          <td data-label="Premios">${rewards}</td>
          <td data-label="Última partida">${formatReportDate(player.lastPlayedAt)}</td>
        </tr>`;
    })
    .join('');

  if (report.players.length === 0) {
    reportPlayersBody.innerHTML =
      '<tr><td class="report-empty" colspan="9">No hay jugadores para los filtros seleccionados.</td></tr>';
  }

  reportCurrentPage = pagination.page;
  reportTotalPages = pagination.totalPages;
  reportPage.textContent = `Página ${pagination.page} de ${pagination.totalPages} · ${pagination.totalPlayers.toLocaleString('es-MX')} jugadores`;
  reportPrevious.disabled = pagination.page <= 1;
  reportNext.disabled = pagination.page >= pagination.totalPages;
  reportStatus.textContent =
    report.players.length > 0
      ? `Mostrando ${report.players.length} jugadores en esta página.`
      : 'Sin resultados para este periodo.';
  renderReportSortState();
}

async function loadPlayerReports(): Promise<void> {
  const requestId = ++reportRequestSequence;
  reportStatus.className = 'report-status is-loading';
  reportStatus.textContent = 'Consultando actividad de jugadores…';
  reportPrevious.disabled = true;
  reportNext.disabled = true;

  try {
    const range = resolveReportRange();
    const params = new URLSearchParams({
      page: String(reportCurrentPage),
      sortBy: reportSortBy,
      sortOrder: reportSortOrder,
    });
    if (reportSearch.value.trim()) params.set('search', reportSearch.value.trim());
    if (range.from && range.to) {
      params.set('from', range.from);
      params.set('to', range.to);
    }
    const report = await api<PlayerReport>(`/reports/players?${params.toString()}`);
    if (requestId !== reportRequestSequence) return;
    reportStatus.className = 'report-status';
    renderPlayerReport(report);
  } catch (error) {
    if (requestId !== reportRequestSequence) return;
    reportStatus.className = 'report-status report-status--error';
    reportStatus.textContent =
      error instanceof Error ? error.message : 'No se pudo cargar el informe.';
    reportPlayersBody.innerHTML =
      '<tr><td class="report-empty" colspan="9">No fue posible cargar los jugadores.</td></tr>';
  }
}

function membershipPlanLabel(plan: MembershipReportRow['plan']): string {
  return plan === 'DADDY_ELITE' ? 'DADDY ELITE' : 'DADDY PLUS';
}

function membershipStatusLabel(status: MembershipReportRow['status']): string {
  return {
    ACTIVE: 'Activa',
    PAST_DUE: 'Pago pendiente',
    CANCELED: 'Cancelada',
    INCOMPLETE: 'Incompleta',
  }[status];
}

function renderMembershipSortState(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-membership-sort]').forEach((button) => {
    const active = button.dataset.membershipSort === membershipSortBy;
    button.classList.toggle('is-active', active);
    const indicator = button.querySelector('i');
    if (indicator) {
      indicator.textContent = active
        ? membershipSortOrder === 'asc' ? '↑' : '↓'
        : '↕';
    }
    button.closest('th')?.setAttribute(
      'aria-sort',
      active ? membershipSortOrder === 'asc' ? 'ascending' : 'descending' : 'none',
    );
  });
}

function renderMembershipReport(report: MembershipReport): void {
  const { summary, pagination } = report;
  required<HTMLElement>('membership-metric-total').textContent =
    summary.totalMembers.toLocaleString('es-MX');
  required<HTMLElement>('membership-metric-active').textContent =
    summary.activeMembers.toLocaleString('es-MX');
  required<HTMLElement>('membership-metric-plus').textContent =
    summary.plusMembers.toLocaleString('es-MX');
  required<HTMLElement>('membership-metric-elite').textContent =
    summary.eliteMembers.toLocaleString('es-MX');
  required<HTMLElement>('membership-metric-revenue').textContent =
    `$${summary.monthlyRevenue.toLocaleString('es-MX')}`;
  required<HTMLElement>('membership-metric-games').textContent =
    summary.totalSessions.toLocaleString('es-MX');
  required<HTMLElement>('membership-metric-hours').textContent =
    formatMetricHours(summary.totalDurationSeconds);
  required<HTMLElement>('membership-metric-points').textContent =
    summary.totalPoints.toLocaleString('es-MX');

  membershipPlayersBody.innerHTML = report.members
    .map((member) => {
      const elite = member.plan === 'DADDY_ELITE';
      const initial = (member.nickname.trim()[0] ?? '?').toUpperCase();
      const planBadge = `
        <span class="membership-plan-badge ${elite ? 'is-elite' : 'is-plus'}">
          <i>${elite ? '◆' : '★'}</i>${membershipPlanLabel(member.plan)}
        </span>`;
      const statusBadge = `
        <span class="membership-status-badge is-${member.status.toLowerCase()}">
          ${membershipStatusLabel(member.status)}
        </span>`;
      const renewal = member.currentPeriodEnd
        ? `${member.cancelAtPeriodEnd ? 'Termina' : 'Renueva'} ${formatReportDate(member.currentPeriodEnd)}`
        : member.status === 'ACTIVE' ? 'Activa sin fecha' : 'Pendiente';
      const benefit = elite
        ? member.benefitsGenerated > 0
          ? `${member.benefitsRedeemed}/${member.benefitsGenerated} canjeados`
          : 'Disponible cada mes'
        : '10% de descuento';
      return `
        <tr class="${elite ? 'membership-row--elite' : 'membership-row--plus'}">
          <td data-label="Inscripción">${formatReportDate(member.joinedAt)}</td>
          <td data-label="Plan">${planBadge}</td>
          <td data-label="Estado">${statusBadge}</td>
          <td data-label="Avatar"><span class="player-avatar membership-avatar ${elite ? 'is-elite' : 'is-plus'}" style="--avatar-color:${avatarColor(member.nickname)}">${escapeHtml(initial)}</span><strong class="avatar-name">${escapeHtml(member.nickname)}</strong></td>
          <td data-label="Nombre">${escapeHtml(member.name || '—')}</td>
          <td data-label="Teléfono">${member.phone ? `<a href="tel:${escapeHtml(member.phone)}">${escapeHtml(member.phone)}</a>` : '—'}</td>
          <td data-label="Partidas"><b>${member.gameCount.toLocaleString('es-MX')}</b></td>
          <td data-label="Horas">${formatDuration(member.totalDurationSeconds)}</td>
          <td data-label="Puntos"><b class="member-total-points">${member.totalPoints.toLocaleString('es-MX')}</b></td>
          <td data-label="Récord"><b class="best-score">${member.bestScore.toLocaleString('es-MX')}</b></td>
          <td data-label="Última partida">${formatReportDate(member.lastPlayedAt)}</td>
          <td data-label="Renovación"><span class="renewal-copy">${renewal}</span></td>
          <td data-label="Beneficio"><span class="benefit-copy">${benefit}</span></td>
        </tr>`;
    })
    .join('');

  if (report.members.length === 0) {
    membershipPlayersBody.innerHTML =
      '<tr><td class="report-empty" colspan="13">No hay membresías para los filtros seleccionados.</td></tr>';
  }

  membershipCurrentPage = pagination.page;
  membershipTotalPages = pagination.totalPages;
  membershipPage.textContent =
    `Página ${pagination.page} de ${pagination.totalPages} · ${pagination.totalMembers.toLocaleString('es-MX')} inscripciones`;
  membershipPrevious.disabled = pagination.page <= 1;
  membershipNext.disabled = pagination.page >= pagination.totalPages;
  membershipReportStatus.textContent =
    report.members.length > 0
      ? `Mostrando ${report.members.length} membresías en esta página.`
      : 'Sin resultados para estos filtros.';
  renderMembershipSortState();
}

async function loadMembershipReports(): Promise<void> {
  const requestId = ++membershipRequestSequence;
  membershipReportStatus.className = 'report-status is-loading';
  membershipReportStatus.textContent = 'Consultando miembros y actividad…';
  membershipPrevious.disabled = true;
  membershipNext.disabled = true;

  try {
    const params = new URLSearchParams({
      page: String(membershipCurrentPage),
      sortBy: membershipSortBy,
      sortOrder: membershipSortOrder,
      plan: membershipPlanFilter.value,
      status: membershipStatusFilter.value,
    });
    if (membershipSearch.value.trim()) {
      params.set('search', membershipSearch.value.trim());
    }
    const report = await api<MembershipReport>(
      `/reports/memberships?${params.toString()}`,
    );
    if (requestId !== membershipRequestSequence) return;
    membershipReportStatus.className = 'report-status';
    renderMembershipReport(report);
  } catch (error) {
    if (requestId !== membershipRequestSequence) return;
    membershipReportStatus.className = 'report-status report-status--error';
    membershipReportStatus.textContent =
      error instanceof Error ? error.message : 'No se pudo cargar el módulo de membresías.';
    membershipPlayersBody.innerHTML =
      '<tr><td class="report-empty" colspan="13">No fue posible cargar las membresías.</td></tr>';
  }
}

function notificationAudienceLabel(audience: NotificationAudience): string {
  return {
    ALL: 'Todos',
    INSTALLED: 'App instalada',
    BROWSER: 'Sin instalar',
  }[audience];
}

function renderNotificationSummary(summary: NotificationSummary): void {
  required<HTMLElement>('notification-registered').textContent =
    summary.registeredPlayers.toLocaleString('es-MX');
  required<HTMLElement>('notification-active').textContent =
    summary.activeSubscriptions.toLocaleString('es-MX');
  required<HTMLElement>('notification-installed').textContent =
    summary.installedSubscriptions.toLocaleString('es-MX');
  required<HTMLElement>('notification-browser').textContent =
    summary.browserSubscriptions.toLocaleString('es-MX');
  required<HTMLElement>('notification-unreachable').textContent =
    summary.registeredWithoutPush.toLocaleString('es-MX');

  notificationHistory.dataset.loaded = 'true';
  if (summary.campaigns.length === 0) {
    notificationHistory.innerHTML =
      '<p class="notification-empty">Todavía no se han enviado notificaciones manuales.</p>';
    return;
  }

  notificationHistory.innerHTML = summary.campaigns
    .map(
      (campaign) => `
        <article class="notification-history-card">
          <div class="notification-history-card__top">
            <span class="notification-kind is-${campaign.kind.toLowerCase()}">${campaign.kind === 'PROMOTION' ? 'Promoción' : 'Recordatorio'}</span>
            <time>${formatReportDate(campaign.createdAt)}</time>
          </div>
          <h3>${escapeHtml(campaign.title)}</h3>
          <p>${escapeHtml(campaign.message)}</p>
          <div class="notification-delivery">
            <span>${notificationAudienceLabel(campaign.audience)}</span>
            <b>${campaign.deliveredCount.toLocaleString('es-MX')} enviados</b>
            <small>${campaign.recipientCount.toLocaleString('es-MX')} destinatarios · ${campaign.failedCount.toLocaleString('es-MX')} fallidos</small>
          </div>
        </article>`,
    )
    .join('');
}

async function loadNotificationSummary(): Promise<void> {
  notificationHistory.innerHTML =
    '<p class="report-status is-loading">Consultando suscripciones y campañas…</p>';
  try {
    renderNotificationSummary(await api<NotificationSummary>('/notifications'));
  } catch (error) {
    notificationHistory.dataset.loaded = 'false';
    notificationHistory.innerHTML = `<p class="report-status report-status--error">${escapeHtml(
      error instanceof Error ? error.message : 'No se pudo cargar el módulo de notificaciones.',
    )}</p>`;
  }
}

function updateNotificationCounters(): void {
  required<HTMLElement>('notification-title-count').textContent =
    String(notificationTitle.value.length);
  required<HTMLElement>('notification-message-count').textContent =
    String(notificationMessage.value.length);
}

async function sendManualNotification(): Promise<void> {
  const title = notificationTitle.value.trim();
  const message = notificationMessage.value.trim();
  const kind = required<HTMLSelectElement>('notification-kind').value as NotificationKind;
  const audience =
    required<HTMLSelectElement>('notification-audience').value as NotificationAudience;
  const targetUrl = required<HTMLSelectElement>('notification-target').value;

  if (title.length < 3 || message.length < 3) {
    notificationStatus.className = 'form-message form-message--error';
    notificationStatus.textContent = 'Escribe un título y un mensaje completos.';
    return;
  }

  const confirmed = window.confirm(
    `¿Enviar "${title}" a ${notificationAudienceLabel(audience).toLowerCase()}? Esta acción notificará inmediatamente a los dispositivos disponibles.`,
  );
  if (!confirmed) return;

  notificationSend.disabled = true;
  notificationStatus.className = 'form-message';
  notificationStatus.textContent = 'Enviando notificación…';
  try {
    const result = await api<{
      recipientCount: number;
      deliveredCount: number;
      failedCount: number;
    }>('/notifications', {
      method: 'POST',
      body: JSON.stringify({ title, message, kind, audience, targetUrl }),
    });
    notificationStatus.className = 'form-message form-message--success';
    notificationStatus.textContent =
      `✓ Envío terminado: ${result.deliveredCount} de ${result.recipientCount} dispositivos.`;
    notificationMessage.value = '';
    updateNotificationCounters();
    await loadNotificationSummary();
  } catch (error) {
    notificationStatus.className = 'form-message form-message--error';
    notificationStatus.textContent =
      error instanceof Error ? error.message : 'No se pudo enviar la notificación.';
  } finally {
    notificationSend.disabled = false;
  }
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
          <label class="tier-name-field">
            <span>Nombre del nivel</span>
            <input data-field="levelName" maxlength="40" value="${escapeHtml(tier.levelName ?? `Nivel ${index + 1}`)}" required />
          </label>
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
      levelName: value('levelName'),
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
    levelName: `Nivel ${currentConfig.tiers.length + 1}`,
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

notificationForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void sendManualNotification();
});
notificationTitle.addEventListener('input', updateNotificationCounters);
notificationMessage.addEventListener('input', updateNotificationCounters);
required<HTMLButtonElement>('notification-refresh').addEventListener(
  'click',
  () => void loadNotificationSummary(),
);

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
    difficultyLevel: Number(difficultyNumber.value),
    bossArrivalSeconds: Number(required<HTMLInputElement>('boss-arrival-seconds').value),
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
difficultyLevel.addEventListener('input', () => setDifficulty(Number(difficultyLevel.value)));
difficultyNumber.addEventListener('input', () => setDifficulty(Number(difficultyNumber.value)));
required<HTMLInputElement>('boss-arrival-seconds').addEventListener('input', (event) => {
  updateBossArrivalPreview(Number((event.currentTarget as HTMLInputElement).value));
});

function openDeploymentModal(message: string): void {
  pendingDeploymentMessage = message;
  deploymentConfirmMessage.textContent = message;
  deploymentModal.hidden = false;
  deploymentModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('deployment-modal-open');
  window.requestAnimationFrame(() => deploymentModal.classList.add('is-open'));
  deploymentConfirmButton.focus();
}

function closeDeploymentModal(): void {
  deploymentModal.classList.remove('is-open');
  deploymentModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('deployment-modal-open');
  window.setTimeout(() => {
    deploymentModal.hidden = true;
  }, 180);
}

async function startDeployment(message: string): Promise<void> {
  closeDeploymentModal();
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
    deploymentState.textContent = 'Falló';
    deploymentPhase.textContent = error instanceof Error ? error.message : 'No se pudo iniciar.';
    deploymentButton.disabled = false;
  }
}

deploymentButton.addEventListener('click', () => {
  const message = deploymentMessage.value.trim();
  if (message.length < 3) {
    deploymentMessage.focus();
    return;
  }
  openDeploymentModal(message);
});

deploymentModal.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  if (target.closest('[data-deployment-close]')) {
    closeDeploymentModal();
  }
});
deploymentConfirmButton.addEventListener('click', () => {
  const message = pendingDeploymentMessage;
  if (message) void startDeployment(message);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !deploymentModal.hidden) {
    closeDeploymentModal();
  } else if (event.key === 'Escape' && adminSidebar.classList.contains('is-open')) {
    closeSidebar();
  }
});

document.querySelectorAll<HTMLButtonElement>('[data-module]').forEach((button) => {
  button.addEventListener('click', () => {
    activateModule(button.dataset.module as AdminModule);
  });
});
document.querySelectorAll<HTMLButtonElement>('[data-open-module]').forEach((button) => {
  button.addEventListener('click', () => {
    activateModule(button.dataset.openModule as AdminModule);
  });
});
sidebarToggle.addEventListener('click', () => {
  if (adminSidebar.classList.contains('is-open')) closeSidebar();
  else openSidebar();
});
sidebarBackdrop.addEventListener('click', closeSidebar);
window.addEventListener('hashchange', () => activateModule(moduleFromHash(), false));

reportPeriod.addEventListener('change', updateReportPeriodControls);
required<HTMLButtonElement>('report-apply').addEventListener('click', () => {
  reportCurrentPage = 1;
  void loadPlayerReports();
});
required<HTMLButtonElement>('report-refresh').addEventListener('click', () => {
  void loadPlayerReports();
});
reportSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    reportCurrentPage = 1;
    void loadPlayerReports();
  }
});
document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const sort = button.dataset.sort as ReportSortBy;
    if (sort === reportSortBy) {
      reportSortOrder = reportSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      reportSortBy = sort;
      reportSortOrder =
        sort === 'nickname' || sort === 'name' || sort === 'phone' ? 'asc' : 'desc';
    }
    reportCurrentPage = 1;
    void loadPlayerReports();
  });
});
reportPrevious.addEventListener('click', () => {
  if (reportCurrentPage > 1) {
    reportCurrentPage -= 1;
    void loadPlayerReports();
  }
});
reportNext.addEventListener('click', () => {
  if (reportCurrentPage < reportTotalPages) {
    reportCurrentPage += 1;
    void loadPlayerReports();
  }
});

required<HTMLButtonElement>('membership-apply').addEventListener('click', () => {
  membershipCurrentPage = 1;
  void loadMembershipReports();
});
required<HTMLButtonElement>('membership-refresh').addEventListener('click', () => {
  void loadMembershipReports();
});
membershipSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    membershipCurrentPage = 1;
    void loadMembershipReports();
  }
});
document.querySelectorAll<HTMLButtonElement>('[data-membership-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const sort = button.dataset.membershipSort as MembershipSortBy;
    if (sort === membershipSortBy) {
      membershipSortOrder = membershipSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      membershipSortBy = sort;
      membershipSortOrder =
        sort === 'nickname' || sort === 'name' || sort === 'phone' || sort === 'plan'
          ? 'asc'
          : 'desc';
    }
    membershipCurrentPage = 1;
    void loadMembershipReports();
  });
});
membershipPrevious.addEventListener('click', () => {
  if (membershipCurrentPage > 1) {
    membershipCurrentPage -= 1;
    void loadMembershipReports();
  }
});
membershipNext.addEventListener('click', () => {
  if (membershipCurrentPage < membershipTotalPages) {
    membershipCurrentPage += 1;
    void loadMembershipReports();
  }
});

required<HTMLButtonElement>('logout-button').addEventListener('click', async () => {
  stopDeploymentPolling();
  await api<{ authenticated: boolean }>('/logout', { method: 'POST', body: '{}' });
  showLogin();
});

initializeReportDates();
updateReportPeriodControls();
renderReportSortState();
renderMembershipSortState();
updateNotificationCounters();

void (async () => {
  try {
    const session = await api<{ authenticated: boolean }>('/session');
    if (session.authenticated) await showAdmin();
    else showLogin();
  } catch {
    showLogin();
  }
})();
