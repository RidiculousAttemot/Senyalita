import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Bug,
  Database,
  Film,
  FlaskConical,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Ratio,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Video,
  Wand2,
  Bell,
} from "lucide-react";

export type AdminNavigationItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  exact?: boolean;
  unavailable?: boolean;
};

export type AdminNavigationSection = {
  label: string;
  items: AdminNavigationItem[];
};

export const ADMIN_NAVIGATION: AdminNavigationSection[] = [
  {
    label: "Dashboard",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Recognition",
    items: [
      { label: "Camera Recognition", href: "/admin/capture", icon: Video },
      { label: "Recognition Training", href: "/admin/training", icon: BrainCircuit },
      { label: "Dataset Manager", href: "/admin/collection", icon: Database },
      { label: "Hard Cases", href: "/admin/review", icon: Sparkles },
      { label: "Review Queue", href: "/admin/ai-review-queue", icon: Sparkles },
      { label: "Recognition Analytics", href: "/admin/recognition-analysis", icon: Activity },
    ],
  },
  {
    label: "Type-to-Sign",
    items: [
      { label: "Animation Training", href: "/admin/animation-studio", icon: Wand2, exact: true },
      { label: "Animation Dataset", href: "/admin/animation-dataset", icon: Database },
      { label: "Animation Library", href: "/admin/animation-library", icon: Film },
      { label: "Animation Inspector", href: "/admin/animation-inspector", icon: Activity },
      { label: "Playback Analytics", href: "/admin/playback-analytics", icon: TrendingUp },
      { label: "Translation Debug", href: "/admin/translation-debug", icon: Bug },
      { label: "Translation Evaluation", href: "/admin/translation-evaluation", icon: TrendingUp },
    ],
  },
  {
    label: "AI Operations",
    items: [
      { label: "AI Insights", href: "/admin/ai-insights", icon: Lightbulb },
      { label: "Experiments", href: "/admin/experiment-tracking", icon: FlaskConical },
      { label: "Models", href: "/admin/models", icon: FolderKanban },
      { label: "Model Comparison", href: "/admin/model-comparison", icon: Ratio },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Overview", href: "/admin/analytics", icon: BarChart3 },
      { label: "Monitoring", href: "/admin/monitoring", icon: Activity },
    ],
  },
  {
    label: "System",
    items: [
      { label: "System Health", href: "/admin/system", icon: Gauge },
      { label: "Audit Logs", href: "/admin/audits", icon: Activity },
      { label: "Admin Users", href: "/admin/users", icon: Users },
      { label: "Settings", icon: Settings, unavailable: true },
    ],
  },
];

export const isAdminNavigationItemActive = (
  pathname: string,
  item: AdminNavigationItem
): boolean => {
  if (!item.href) return false;
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
};
