import type { Branch } from '../types.js';

export interface RegistrationData {
  name: string;
  avatar: string;
  phone: string;
  branch: string;
}

export interface RegistrationDefaults {
  name?: string;
  avatar?: string;
  phone?: string;
  branch?: string;
}

export interface RegistrationPresentation {
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  hint?: string;
}

/** Remove any stale registration layer left behind by a reload or scene change. */
export function removeRegistrationOverlays(): void {
  document.querySelectorAll<HTMLElement>('.dgc-overlay').forEach((overlay) => overlay.remove());
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) {
    activeElement.blur();
  }
}

function resolveInitialBranch(branches: Branch[], requested?: string): string {
  return branches.some((branch) => branch.id === requested)
    ? requested ?? ''
    : branches[0]?.id ?? '';
}

function normalizePhone(value: string): string {
  return value.replace(/\D/gu, '').slice(0, 10);
}

function isValidPhone(value: string): boolean {
  return /^\d{10}$/u.test(value);
}

function showPhoneCorrectionModal(input: HTMLInputElement): void {
  if (document.querySelector('.dgc-phone-correction')) return;

  const modal = document.createElement('div');
  modal.className = 'dgc-phone-correction';
  modal.innerHTML = `
    <section class="dgc-phone-dialog" role="alertdialog" aria-modal="true"
      aria-labelledby="dgc-phone-dialog-title" aria-describedby="dgc-phone-dialog-copy">
      <div class="dgc-phone-dialog__icon" aria-hidden="true">!</div>
      <h2 id="dgc-phone-dialog-title">Registra tu número correcto</h2>
      <p id="dgc-phone-dialog-copy">Escribe exactamente los 10 dígitos de tu teléfono, sin espacios, guiones ni lada internacional.</p>
      <button type="button" class="dgc-btn dgc-btn--primary">CORREGIR NÚMERO</button>
    </section>`;
  document.body.appendChild(modal);

  const closeButton = modal.querySelector('button') as HTMLButtonElement;
  const close = () => {
    modal.remove();
    input.focus();
  };
  closeButton.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  closeButton.focus();
}

function preparePhoneInput(input: HTMLInputElement): void {
  input.value = normalizePhone(input.value);
  input.addEventListener('input', () => {
    const normalized = normalizePhone(input.value);
    if (input.value !== normalized) input.value = normalized;
  });
}

/**
 * Show a modern HTML registration form as an overlay above the game canvas.
 * Resolves with the collected data, or null if the user cancels.
 *
 * Implemented as real HTML/CSS (not Phaser objects) so it looks crisp and
 * professional on every device and is easy to style.
 */
export function showRegistrationForm(
  branches: Branch[],
  defaults: RegistrationDefaults = {},
  presentation: RegistrationPresentation = {},
): Promise<RegistrationData | null> {
  return new Promise((resolve) => {
    removeRegistrationOverlays();
    const overlay = document.createElement('div');
    overlay.className = 'dgc-overlay';

    const branchButtons = branches
      .map(
        (branch) =>
          `<button type="button" class="dgc-branch" data-branch="${escapeAttr(branch.id)}">${escapeHtml(
            branch.name,
          )}</button>`,
      )
      .join('');

    overlay.innerHTML = `
      <div class="dgc-card" role="dialog" aria-modal="true">
        <div class="dgc-card__header">
          <div class="dgc-card__title">${escapeHtml(presentation.title ?? '¡ANTES DE JUGAR!')}</div>
          <div class="dgc-card__subtitle">${escapeHtml(
            presentation.subtitle ?? 'Regístrate para competir',
          )}</div>
        </div>
        <form class="dgc-card__body" novalidate autocomplete="off">
          <div class="dgc-field">
            <label class="dgc-label" for="dgc-name">Nombre</label>
            <input class="dgc-input" id="dgc-name" name="name" type="text" maxlength="40"
              autocomplete="off" placeholder="Tu nombre" value="${escapeAttr(defaults.name ?? '')}" />
          </div>

          <div class="dgc-field">
            <label class="dgc-label" for="dgc-avatar">Nombre de avatar</label>
            <input class="dgc-input" id="dgc-avatar" name="avatar" type="text" maxlength="20"
              autocomplete="off" placeholder="Ej. DaddyMaster" value="${escapeAttr(defaults.avatar ?? '')}" />
          </div>

          <div class="dgc-field">
            <label class="dgc-label" for="dgc-phone">Teléfono</label>
            <input class="dgc-input" id="dgc-phone" name="phone" type="tel" maxlength="10"
              inputmode="numeric" autocomplete="tel-national" pattern="[0-9]{10}" placeholder="Ej. 6241548148" value="${escapeAttr(
                defaults.phone ?? '',
              )}" />
          </div>

          <div class="dgc-field">
            <label class="dgc-label">Elige tu sucursal</label>
            <div class="dgc-branches">${branchButtons}</div>
          </div>

          <div class="dgc-error" id="dgc-error"></div>

          <div class="dgc-actions">
            <button type="button" class="dgc-btn dgc-btn--ghost" id="dgc-cancel">✕</button>
            <button type="submit" class="dgc-btn dgc-btn--primary" id="dgc-submit">${escapeHtml(
              presentation.submitLabel ?? 'JUGAR',
            )}</button>
          </div>
          <div class="dgc-hint">${escapeHtml(
            presentation.hint ?? 'Solo usamos estos datos para tu puntaje y promociones.',
          )}</div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector('form') as HTMLFormElement;
    const nameInput = overlay.querySelector('#dgc-name') as HTMLInputElement;
    const avatarInput = overlay.querySelector('#dgc-avatar') as HTMLInputElement;
    const phoneInput = overlay.querySelector('#dgc-phone') as HTMLInputElement;
    preparePhoneInput(phoneInput);
    const errorEl = overlay.querySelector('#dgc-error') as HTMLElement;
    const cancelBtn = overlay.querySelector('#dgc-cancel') as HTMLButtonElement;
    const branchEls = Array.from(
      overlay.querySelectorAll<HTMLButtonElement>('.dgc-branch'),
    );

    let selectedBranch = resolveInitialBranch(branches, defaults.branch);
    const applyBranchSelection = () => {
      for (const el of branchEls) {
        el.classList.toggle('is-active', el.dataset.branch === selectedBranch);
      }
    };
    for (const el of branchEls) {
      el.addEventListener('click', () => {
        selectedBranch = el.dataset.branch ?? '';
        applyBranchSelection();
      });
    }
    applyBranchSelection();

    const cleanup = () => {
      overlay.remove();
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      const avatar = avatarInput.value.trim();
      const phone = normalizePhone(phoneInput.value);

      if (!name) {
        showError('Escribe tu nombre.');
        nameInput.focus();
        return;
      }
      if (!avatar) {
        showError('Elige un nombre de avatar.');
        avatarInput.focus();
        return;
      }
      if (!phone) {
        showPhoneCorrectionModal(phoneInput);
        return;
      }
      if (!isValidPhone(phone)) {
        showPhoneCorrectionModal(phoneInput);
        return;
      }
      if (!selectedBranch) {
        showError('Selecciona una sucursal.');
        return;
      }

      cleanup();
      resolve({ name, avatar, phone, branch: selectedBranch });
    });

    function showError(message: string): void {
      errorEl.textContent = message;
    }

    // Autofocus the first empty field for convenience.
    window.setTimeout(() => {
      (nameInput.value ? avatarInput : nameInput).focus();
    }, 60);
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c];
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

export interface ReturningLookupResult {
  name: string | null;
  avatar: string;
  phone: string | null;
}

/** Result of the returning-player form: data to play, or a request to register. */
export type ReturningPlayerResult = RegistrationData | 'register' | null;

/**
 * Show a quick "¿Ya jugaste antes?" form that asks only for the phone number,
 * looks the player up, and (if found) resolves with their name + avatar so
 * they can play without registering again.
 */
export function showReturningPlayerForm(
  branches: Branch[],
  lookup: (phone: string) => Promise<ReturningLookupResult | null>,
  defaults: RegistrationDefaults = {},
  detectedPlayer: ReturningLookupResult | null = null,
): Promise<ReturningPlayerResult> {
  return new Promise((resolve) => {
    removeRegistrationOverlays();
    const overlay = document.createElement('div');
    overlay.className = 'dgc-overlay';

    const branchButtons = branches
      .map(
        (branch) =>
          `<button type="button" class="dgc-branch" data-branch="${escapeAttr(branch.id)}">${escapeHtml(
            branch.name,
          )}</button>`,
      )
      .join('');

    overlay.innerHTML = `
      <div class="dgc-card" role="dialog" aria-modal="true">
        <div class="dgc-card__header">
          <div class="dgc-card__title">¡QUÉ BUENO VERTE!</div>
          <div class="dgc-card__subtitle">${
            detectedPlayer
              ? `Te reconocimos como ${escapeHtml(detectedPlayer.avatar)}`
              : 'Ingresa tu teléfono para volver a jugar'
          }</div>
        </div>
        <form class="dgc-card__body" novalidate autocomplete="off">
          <div class="dgc-field">
            <label class="dgc-label" for="dgc-r-phone">Teléfono registrado</label>
            <input class="dgc-input" id="dgc-r-phone" name="phone" type="tel" maxlength="10"
              inputmode="numeric" autocomplete="tel-national" pattern="[0-9]{10}" placeholder="Ej. 6241548148" value="${escapeAttr(
                defaults.phone ?? '',
              )}" />
          </div>

          <div class="dgc-found" id="dgc-found" ${detectedPlayer ? '' : 'hidden'}>${
            detectedPlayer
              ? `¡Hola de nuevo, <strong>${escapeHtml(detectedPlayer.avatar)}</strong>! Ya detectamos tu registro en este dispositivo.`
              : ''
          }</div>

          <div class="dgc-field">
            <label class="dgc-label">Elige tu sucursal</label>
            <div class="dgc-branches">${branchButtons}</div>
          </div>

          <div class="dgc-error" id="dgc-error"></div>

          <div class="dgc-actions">
            <button type="button" class="dgc-btn dgc-btn--ghost" id="dgc-cancel">✕</button>
            <button type="submit" class="dgc-btn dgc-btn--primary" id="dgc-submit">JUGAR</button>
          </div>
          <button type="button" class="dgc-link" id="dgc-register">Soy nuevo, quiero registrarme</button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector('form') as HTMLFormElement;
    const phoneInput = overlay.querySelector('#dgc-r-phone') as HTMLInputElement;
    preparePhoneInput(phoneInput);
    const foundEl = overlay.querySelector('#dgc-found') as HTMLElement;
    const errorEl = overlay.querySelector('#dgc-error') as HTMLElement;
    const submitBtn = overlay.querySelector('#dgc-submit') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('#dgc-cancel') as HTMLButtonElement;
    const registerBtn = overlay.querySelector('#dgc-register') as HTMLButtonElement;
    const branchEls = Array.from(overlay.querySelectorAll<HTMLButtonElement>('.dgc-branch'));

    let selectedBranch = resolveInitialBranch(branches, defaults.branch);
    const applyBranchSelection = () => {
      for (const el of branchEls) {
        el.classList.toggle('is-active', el.dataset.branch === selectedBranch);
      }
    };
    for (const el of branchEls) {
      el.addEventListener('click', () => {
        selectedBranch = el.dataset.branch ?? '';
        applyBranchSelection();
      });
    }
    applyBranchSelection();

    let found: ReturningLookupResult | null = detectedPlayer;
    let lookedUpPhone = detectedPlayer ? (defaults.phone ?? '').trim() : '';

    const cleanup = () => overlay.remove();
    const showError = (message: string) => {
      errorEl.textContent = message;
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    registerBtn.addEventListener('click', () => {
      cleanup();
      resolve('register');
    });

    phoneInput.addEventListener('input', () => {
      if (phoneInput.value.trim() !== lookedUpPhone) {
        found = null;
        lookedUpPhone = '';
        foundEl.hidden = true;
        foundEl.textContent = '';
        showError('');
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const phone = normalizePhone(phoneInput.value);

      if (!isValidPhone(phone)) {
        showPhoneCorrectionModal(phoneInput);
        return;
      }

      // Look the player up on the first submit if we haven't already.
      if (!found) {
        showError('');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Buscando…';
        try {
          found = await lookup(phone);
          lookedUpPhone = phone;
        } catch {
          found = null;
          showError('No se pudo consultar ahora. Intenta de nuevo.');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'JUGAR';
        }

        if (!found) {
          if (!errorEl.textContent) {
            showError('No encontramos ese número. Regístrate para jugar.');
          }
          return;
        }

        foundEl.hidden = false;
        foundEl.innerHTML = `¡Hola de nuevo, <strong>${escapeHtml(found.avatar)}</strong>! Elige sucursal y juega.`;
      }

      if (!selectedBranch) {
        showError('Selecciona una sucursal.');
        return;
      }

      cleanup();
      resolve({
        name: found.name ?? '',
        avatar: found.avatar,
        phone: found.phone ?? phone,
        branch: selectedBranch,
      });
    });

    if (!detectedPlayer) {
      window.setTimeout(() => phoneInput.focus(), 60);
    }
  });
}
