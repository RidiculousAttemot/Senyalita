type ShortcutEvent = Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "metaKey">;

export function isTranscriptCommitShortcut(event: ShortcutEvent, shortcut: string): boolean {
  return event.code === shortcut && !event.altKey && !event.ctrlKey && !event.metaKey;
}

export function formatTranscriptCommitShortcut(shortcut: string): string {
  if (shortcut === "Space") return "Space";
  if (shortcut === "Enter") return "Enter";
  return shortcut.replace(/^Key/, "").replace(/^Digit/, "");
}