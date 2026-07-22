/**
 * Server-side score validation. The game client is not fully trusted, so we
 * reject scores that are impossible given the game duration and rules.
 */

export interface ScoreValidationConfig {
  maxScorePerSecond: number;
  maxDurationSeconds: number;
}

export const DEFAULT_SCORE_CONFIG: ScoreValidationConfig = {
  maxScorePerSecond: 500,
  // Five configurable worlds (up to ten minutes each) plus boss transitions.
  maxDurationSeconds: 7200,
};

export interface ScoreValidationInput {
  score: number;
  durationSeconds: number;
}

export interface ScoreValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate that a submitted score is plausible.
 */
export function validateScore(
  input: ScoreValidationInput,
  config: ScoreValidationConfig = DEFAULT_SCORE_CONFIG,
): ScoreValidationResult {
  const { score, durationSeconds } = input;

  if (!Number.isInteger(score) || score < 0) {
    return { valid: false, reason: 'El puntaje debe ser un entero no negativo.' };
  }

  if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
    return { valid: false, reason: 'La duración es inválida.' };
  }

  if (durationSeconds > config.maxDurationSeconds) {
    return { valid: false, reason: 'La duración excede el máximo permitido.' };
  }

  const maxPossibleScore = durationSeconds * config.maxScorePerSecond;
  if (score > maxPossibleScore) {
    return { valid: false, reason: 'El puntaje es imposible para la duración indicada.' };
  }

  return { valid: true };
}
