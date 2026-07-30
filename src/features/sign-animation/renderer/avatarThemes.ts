import type { AvatarTheme, AvatarThemeConfig } from "../types";
import { AVATAR_THEMES } from "../types";

export class AvatarThemeManager {
  private currentTheme: AvatarTheme = "minimal";
  private listeners: Array<(theme: AvatarTheme) => void> = [];

  getCurrent(): AvatarTheme {
    return this.currentTheme;
  }

  getConfig(): AvatarThemeConfig | undefined {
    return AVATAR_THEMES.find((t) => t.id === this.currentTheme);
  }

  getAllThemes(): AvatarThemeConfig[] {
    return [...AVATAR_THEMES];
  }

  setTheme(theme: AvatarTheme): void {
    if (this.currentTheme !== theme) {
      this.currentTheme = theme;
      this.notify();
    }
  }

  next(): void {
    const idx = AVATAR_THEMES.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (idx + 1) % AVATAR_THEMES.length;
    this.setTheme(AVATAR_THEMES[nextIdx].id);
  }

  prev(): void {
    const idx = AVATAR_THEMES.findIndex((t) => t.id === this.currentTheme);
    const prevIdx = (idx - 1 + AVATAR_THEMES.length) % AVATAR_THEMES.length;
    this.setTheme(AVATAR_THEMES[prevIdx].id);
  }

  onChange(listener: (theme: AvatarTheme) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentTheme);
    }
  }
}

export const globalThemeManager = new AvatarThemeManager();
