import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

type DeploymentState = 'idle' | 'running' | 'succeeded' | 'failed';

export interface DeploymentStatus {
  enabled: boolean;
  state: DeploymentState;
  phase: string;
  startedAt: string | null;
  finishedAt: string | null;
  commit: string | null;
  logs: string[];
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const sshCommand = process.platform === 'win32' ? 'ssh.exe' : 'ssh';
const MAX_LOG_LINES = 400;

let deployment: DeploymentStatus = {
  enabled: env.localDeployEnabled,
  state: 'idle',
  phase: 'Listo para desplegar',
  startedAt: null,
  finishedAt: null,
  commit: null,
  logs: [],
};

function snapshot(): DeploymentStatus {
  return { ...deployment, logs: [...deployment.logs] };
}

function sanitizeLog(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/giu, 'postgresql://***@')
    .replace(/(ADMIN_PASSWORD|ADMIN_SESSION_SECRET|REWARD_SECRET)=\S+/giu, '$1=***');
}

function appendLog(value: string): void {
  for (const rawLine of value.replace(/\r/gu, '').split('\n')) {
    const line = sanitizeLog(rawLine).trimEnd();
    if (line) deployment.logs.push(line.slice(0, 4000));
  }
  if (deployment.logs.length > MAX_LOG_LINES) {
    deployment.logs.splice(0, deployment.logs.length - MAX_LOG_LINES);
  }
}

function setPhase(phase: string): void {
  deployment.phase = phase;
  appendLog(`==> ${phase}`);
}

async function runCommand(
  label: string,
  command: string,
  args: string[],
  allowedExitCodes: number[] = [0],
): Promise<{ code: number; output: string }> {
  appendLog(`$ ${label}`);
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      shell: false,
      windowsHide: true,
    });
    let output = '';
    const capture = (chunk: Buffer): void => {
      const text = chunk.toString('utf8');
      output += text;
      appendLog(text);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', reject);
    child.on('close', (code) => {
      const exitCode = code ?? -1;
      if (allowedExitCodes.includes(exitCode)) {
        resolvePromise({ code: exitCode, output: output.trim() });
        return;
      }
      reject(new Error(`${label} termino con codigo ${exitCode}.`));
    });
  });
}

async function executeDeployment(message: string): Promise<void> {
  try {
    setPhase('Verificando la rama local');
    const branch = await runCommand('git branch --show-current', 'git', ['branch', '--show-current']);
    if (branch.output.trim() !== env.deployBranch) {
      throw new Error(`La rama activa debe ser ${env.deployBranch}.`);
    }
    await runCommand('git diff --check', 'git', ['diff', '--check']);

    setPhase('Ejecutando TypeScript, lint, pruebas y build');
    await runCommand('npm run typecheck', npmCommand, ['run', 'typecheck']);
    await runCommand('npm run lint', npmCommand, ['run', 'lint']);
    await runCommand('npm test', npmCommand, ['test']);
    await runCommand('npm run build', npmCommand, ['run', 'build']);

    setPhase('Preparando el commit');
    await runCommand('git add -A', 'git', ['add', '-A']);
    const staged = await runCommand(
      'git diff --cached --quiet',
      'git',
      ['diff', '--cached', '--quiet'],
      [0, 1],
    );
    if (staged.code === 1) {
      await runCommand('git commit', 'git', ['commit', '-m', message]);
    } else {
      appendLog('No hay cambios nuevos; se desplegara el commit actual.');
    }

    setPhase('Enviando main a GitHub');
    await runCommand('git push origin main', 'git', [
      'push',
      'origin',
      `HEAD:${env.deployBranch}`,
    ]);
    const commit = await runCommand('git rev-parse HEAD', 'git', ['rev-parse', 'HEAD']);
    deployment.commit = commit.output.trim();

    setPhase('Desplegando en Liquid Web');
    const remoteCommand =
      `cd ${env.deployRemoteDir} && ` +
      `PROJECT_DIR=${env.deployRemoteDir} DEPLOY_BRANCH=${env.deployBranch} bash scripts/deploy.sh`;
    await runCommand('ssh Liquid Web deploy', sshCommand, [
      '-o',
      'BatchMode=yes',
      '-p',
      String(env.deploySshPort),
      `${env.deploySshUser}@${env.deploySshHost}`,
      remoteCommand,
    ]);

    deployment.state = 'succeeded';
    deployment.phase = 'Despliegue completado';
    deployment.finishedAt = new Date().toISOString();
    appendLog('==> Despliegue completado correctamente.');
  } catch (error) {
    deployment.state = 'failed';
    deployment.phase = 'El despliegue fallo';
    deployment.finishedAt = new Date().toISOString();
    appendLog(`ERROR: ${error instanceof Error ? error.message : 'Error desconocido.'}`);
  }
}

export function getDeploymentStatus(): DeploymentStatus {
  deployment.enabled = env.localDeployEnabled;
  return snapshot();
}

export function startDeployment(message: string): DeploymentStatus {
  if (!env.localDeployEnabled) {
    throw AppError.notFound('El despliegue local no esta habilitado.');
  }
  if (deployment.state === 'running') {
    throw AppError.conflict('Ya existe un despliegue en proceso.');
  }
  deployment = {
    enabled: true,
    state: 'running',
    phase: 'Iniciando despliegue',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    commit: null,
    logs: [],
  };
  appendLog('==> Iniciando push y despliegue a produccion.');
  void executeDeployment(message);
  return snapshot();
}
