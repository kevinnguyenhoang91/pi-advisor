import type {
  ExtensionContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";

type SessionManagerWithContextEntries = ExtensionContext["sessionManager"] & {
  buildContextEntries?: () => SessionEntry[];
};

export const sessionContextEntries = (
  ctx: ExtensionContext
): SessionEntry[] => {
  // SAFETY: older hosts lack this optional API; the fallback uses their typed getBranch method.
  const sessionManager = ctx.sessionManager as SessionManagerWithContextEntries;
  return sessionManager.buildContextEntries?.() ?? sessionManager.getBranch();
};
