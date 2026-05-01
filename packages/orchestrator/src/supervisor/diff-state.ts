import type { DesiredState } from "./compute-desired-state";
import type { SystemName } from "@hr-agent/shared";

/**
 * Returns systems whose desired state has drifted between old and new.
 * Pure function — no LLM. Heuristic based on field changes.
 */
export function diffState(oldState: DesiredState, newState: DesiredState): SystemName[] {
  const affected: SystemName[] = [];
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  if (!eq(oldState.hrms, newState.hrms)) affected.push("hrms");
  if (!eq(oldState.documents, newState.documents)) affected.push("documents");
  if (!eq(oldState.buddy, newState.buddy)) affected.push("buddy");
  if (!eq(oldState.it, newState.it)) affected.push("it");
  if (!eq(oldState.software, newState.software)) affected.push("software");
  if (!eq(oldState.training, newState.training)) affected.push("training");
  if (!eq(oldState.welcome, newState.welcome)) affected.push("welcome");
  if (!eq(oldState.idcard, newState.idcard)) affected.push("idcard");
  if (!eq(oldState.payroll, newState.payroll)) affected.push("payroll");
  if (!eq(oldState.manager_notify, newState.manager_notify)) affected.push("manager_notify");
  if (!eq(oldState.seating, newState.seating)) affected.push("seating");
  if (!eq(oldState.parking, newState.parking)) affected.push("parking");

  return affected;
}
