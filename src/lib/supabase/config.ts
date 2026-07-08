// Environment configuration: validate required variables at startup.
// Import once at the app root (layout.tsx) for early failure.

const REQUIRED_VARS = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anonymous key (browser-safe)"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase service-role key (server-only)"],
] as const;

const OPTIONAL_VARS: Array<[string, string]> = [
  ["NEXT_PUBLIC_SITE_URL", "Public site URL for redirects"],
];

export type EnvCheckResult = {
  valid: boolean;
  missing: Array<{ key: string; purpose: string }>;
  warnings: Array<{ key: string; purpose: string }>;
};

export const validateEnv = (): EnvCheckResult => {
  const missing: Array<{ key: string; purpose: string }> = [];
  const warnings: Array<{ key: string; purpose: string }> = [];

  for (const [key, purpose] of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push({ key, purpose });
    }
  }

  for (const [key, purpose] of OPTIONAL_VARS) {
    if (!process.env[key]) {
      warnings.push({ key, purpose });
    }
  }

  const valid = missing.length === 0;
  if (!valid) {
    console.error(
      "[supabase/config] Missing required environment variables:",
      missing.map((m) => m.key).join(", "),
    );
  }

  return { valid, missing, warnings };
};
