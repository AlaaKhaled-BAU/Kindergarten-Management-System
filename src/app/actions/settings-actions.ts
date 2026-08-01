"use server";

import { logEvent } from "@/lib/logger";
import { getSetting, setSetting } from "@/lib/settings";
import { readSyncState, writeSyncState } from "@/lib/sync-state";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireAdmin, validateRequiredString } from "./validation";

export interface KindergartenInfo {
  kindergartenName: string;
  kindergartenAddress: string;
  kindergartenPhone: string;
  kindergartenEmail: string;
}

export async function getKindergartenInfo(): Promise<KindergartenInfo> {
  await requireAdmin();
  const [name, address, phone, email] = await Promise.all([
    getSetting("kindergartenName"),
    getSetting("kindergartenAddress"),
    getSetting("kindergartenPhone"),
    getSetting("kindergartenEmail"),
  ]);
  return {
    kindergartenName: name ?? "",
    kindergartenAddress: address ?? "",
    kindergartenPhone: phone ?? "",
    kindergartenEmail: email ?? "",
  };
}

export async function updateKindergartenInfo(input: KindergartenInfo): Promise<void> {
  const actor = await requireAdmin();

  validateRequiredString(input.kindergartenName, "اسم الروضة");

  await Promise.all([
    setSetting("kindergartenName", input.kindergartenName),
    setSetting("kindergartenAddress", input.kindergartenAddress),
    setSetting("kindergartenPhone", input.kindergartenPhone),
    setSetting("kindergartenEmail", input.kindergartenEmail),
  ]);

  await logEvent("kindergarten_info_updated", { actor });
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const actor = await requireAdmin();

  const storedHash = await getSetting("adminPasswordHash");
  if (!storedHash || !verifyPassword(currentPassword, storedHash)) {
    throw new Error("كلمة المرور الحالية غير صحيحة");
  }
  if (newPassword.length < 4) {
    throw new Error("كلمة المرور الجديدة يجب أن تتكون من 4 أحرف على الأقل");
  }

  await setSetting("adminPasswordHash", hashPassword(newPassword));
  await logEvent("admin_password_changed", { actor });
}

export interface SyncConfig {
  workerUrl: string;
  token: string;
}

export async function getSyncConfig(): Promise<SyncConfig> {
  await requireAdmin();
  const state = readSyncState();
  return { workerUrl: state.workerUrl ?? "", token: state.token ?? "" };
}

// Empty values are valid here (they mean "sync disabled"), so this
// deliberately skips validateRequiredString.
export async function updateSyncConfig(input: SyncConfig): Promise<void> {
  const actor = await requireAdmin();
  writeSyncState({ workerUrl: input.workerUrl.trim(), token: input.token.trim() });
  await logEvent("sync_config_updated", { actor });
}
