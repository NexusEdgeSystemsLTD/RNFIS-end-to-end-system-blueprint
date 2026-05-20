import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Gavel,
  BarChart3,
  FileText,
  ScrollText,
  ShieldCheck,
  Video,
  Flag as Whistle,
  ArrowRightLeft,
  Building2,
  Landmark,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: AppRole[]; // visible only if user has any of these
}

const NAV: NavItem[] = [
  { to: "/app", label: "Command", icon: LayoutDashboard },
  { to: "/app/matches", label: "Matches", icon: Trophy },
  { to: "/app/clubs", label: "Clubs", icon: Trophy },
  { to: "/app/players", label: "Players", icon: Users },
  { to: "/app/transfers", label: "Transfers", icon: ArrowRightLeft },
  { to: "/app/referees", label: "Referees", icon: Whistle },
  { to: "/app/assignments", label: "Assignments", icon: Whistle, roles: ["ministry_admin", "ferwafa_admin"] },
  { to: "/app/licensing", label: "Licensing & Training", icon: ShieldCheck, roles: ["ministry_admin", "ferwafa_admin"] },
  { to: "/app/discipline", label: "Discipline", icon: Gavel },
  { to: "/app/var", label: "VAR Reviews", icon: Video },
  { to: "/app/rankings", label: "Rankings", icon: BarChart3 },
  { to: "/app/reports", label: "Reports", icon: FileText },
  { to: "/app/compliance", label: "Compliance", icon: FileText },
  { to: "/app/club-portal", label: "Club Portal", icon: Building2, roles: ["club_official", "ministry_admin", "ferwafa_admin"] },
  { to: "/app/ministry", label: "Ministry BI", icon: Landmark, roles: ["ministry_admin"] },
  { to: "/app/audit", label: "Audit Trail", icon: ScrollText, roles: ["ministry_admin"] },
  { to: "/app/security", label: "Users & Roles", icon: ShieldCheck, roles: ["ministry_admin"] },
  { to: "/app/e2e", label: "E2E Test Runner", icon: ShieldCheck, roles: ["ministry_admin", "ferwafa_admin"] },
];

export function AppShell() {
  const { profile, roles, signOut, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV.filter((n) => !n.roles || hasAnyRole(n.roles));

  const primaryRole = roles[0] ?? "public_viewer";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-bold text-sm">
            RW
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wider text-sidebar-foreground">RNFIS</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Intel · v1.0</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = pathname === item.to || (item.to !== "/app" && pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs text-muted-foreground truncate">{profile?.email}</div>
            <Badge variant="outline" className="mt-1.5 text-[10px] font-mono uppercase tracking-wide">
              {ROLE_LABELS[primaryRole]}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/80" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/60 backdrop-blur flex items-center px-4 lg:px-6 gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground tracking-widest uppercase">Restricted · Ministry of Sports & FERWAFA</div>
            <div className="text-sm font-mono text-foreground/90 truncate">
              SYSTEM STATUS · <span className="text-success">OPERATIONAL</span> · 99.9% SLA
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            SOVEREIGN · KIGALI-DC1
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
