import type { InputCommand } from './messages.js';

export function validInput(value: unknown): value is InputCommand {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (![v.seq, v.forward, v.side, v.yaw, v.pitch].every((n) => typeof n === 'number')) return false;
  return validateTyped(value as InputCommand);
}
function validateTyped(v: InputCommand): boolean {
  return (
    v &&
    (v.knockoutPower === undefined || (Number.isInteger(v.knockoutPower) && v.knockoutPower >= 1 && v.knockoutPower <= 10)) &&
    (v.knockoutTurn === undefined || (Number.isSafeInteger(v.knockoutTurn) && v.knockoutTurn >= 1 && v.knockoutTurn <= 65535)) &&
    Number.isSafeInteger(v.round) &&
    v.round >= 0 &&
    Number.isSafeInteger(v.seq) &&
    v.seq >= 0 &&
    v.seq < 2147483647 &&
    Number.isFinite(v.forward) &&
    Math.abs(v.forward) <= 1 &&
    Number.isFinite(v.side) &&
    Math.abs(v.side) <= 1 &&
    Number.isFinite(v.yaw) &&
    Math.abs(v.yaw) < 100 &&
    Number.isFinite(v.pitch) &&
    Math.abs(v.pitch) <= Math.PI / 2 &&
    typeof v.jump === 'boolean' &&
    typeof v.sprint === 'boolean'
  );
}
