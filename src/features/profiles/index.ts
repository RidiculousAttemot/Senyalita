// Local session profile type (communication_profiles table removed in Phase 46)
export type SessionProfile = {
  id: string;
  session_token: string;
  preferred_language: "en" | "tl";
  preferred_reply_style: "concise" | "detailed" | "casual" | "formal";
  conversation_speed: "slow" | "normal" | "fast";
  frequently_used_gestures: string[];
  commonly_selected_replies: string[];
  accessibility_preferences: Record<string, unknown>;
  total_sessions: number;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = Partial<Pick<SessionProfile,
  | "preferred_language"
  | "preferred_reply_style"
  | "conversation_speed"
  | "frequently_used_gestures"
  | "commonly_selected_replies"
  | "accessibility_preferences"
>>;

export class CommunicationProfileManager {
  private profile: SessionProfile | null = null;
  private sessionToken: string;
  private storageKey = "signlang_profile_session";

  constructor(sessionToken?: string) {
    this.sessionToken = sessionToken ?? this.loadOrCreateToken();
  }

  getToken(): string {
    return this.sessionToken;
  }

  getProfile(): SessionProfile | null {
    return this.profile;
  }

  setProfile(profile: SessionProfile): void {
    this.profile = profile;
  }

  update(updates: ProfileUpdate): void {
    if (!this.profile) return;
    Object.assign(this.profile, updates);
  }

  addFrequentGesture(label: string): void {
    if (!this.profile) return;
    const gestures = this.profile.frequently_used_gestures;
    const updated = gestures.filter(g => g !== label);
    updated.push(label);
    if (updated.length > 50) updated.shift();
    this.profile.frequently_used_gestures = updated;
  }

  addSelectedReply(reply: string): void {
    if (!this.profile) return;
    const replies = this.profile.commonly_selected_replies;
    const updated = replies.filter(r => r !== reply);
    updated.push(reply);
    if (updated.length > 30) updated.shift();
    this.profile.commonly_selected_replies = updated;
  }

  getPreferredLanguage(): "en" | "tl" {
    return this.profile?.preferred_language ?? "en";
  }

  getPreferredStyle(): string {
    return this.profile?.preferred_reply_style ?? "concise";
  }

  getConversationSpeed(): string {
    return this.profile?.conversation_speed ?? "normal";
  }

  getRecentGestures(): string[] {
    return this.profile?.frequently_used_gestures?.slice(-10) ?? [];
  }

  getCommonReplies(): string[] {
    return this.profile?.commonly_selected_replies?.slice(-10) ?? [];
  }

  resetSession(): void {
    this.profile = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
    this.sessionToken = this.generateToken();
    this.saveToken();
  }

  private loadOrCreateToken(): string {
    if (typeof window === "undefined") return this.generateToken();
    const stored = localStorage.getItem(this.storageKey);
    if (stored) return stored;
    const token = this.generateToken();
    localStorage.setItem(this.storageKey, token);
    return token;
  }

  private saveToken(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(this.storageKey, this.sessionToken);
    }
  }

  private generateToken(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "anon_";
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
