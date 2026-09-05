import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Bell,
  Boxes,
  Building2,
  ChevronsLeft,
  FileText,
  FolderOpen,
  Gauge,
  Inbox,
  Siren,

  LogOut,
  PanelLeft,
  Radar,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Vault,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/complaints", label: "Complaints", icon: Inbox },
  { to: "/alerts", label: "Alerts", icon: Siren },
  { to: "/attribution", label: "Attribution", icon: Building2 },
  { to: "/ai", label: "AI copilot", icon: Sparkles },
  { to: "/cases", label: "Cases", icon: FolderOpen },
  { to: "/investigations", label: "Investigations", icon: Radar },
  { to: "/findings", label: "Findings", icon: ShieldAlert },
  { to: "/evidence", label: "Evidence vault", icon: Vault },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;


const NOTIFICATIONS = [
  {
    title: "Sanctioned wallet touched",
    body: "0x9e7f…6a1b interacted with 3 sanctioned addresses.",
    time: "2m",
    dot: "bg-critical",
  },
  {
    title: "Trace completed",
    body: "INV-2026-0114 finished a 9-hop bounded graph.",
    time: "18m",
    dot: "bg-positive",
  },
  {
    title: "Mixer exposure detected",
    body: "Peel chain routed 41 ETH through TornadoCash.",
    time: "1h",
    dot: "bg-warning",
  },
  {
    title: "New attribution candidate",
    body: "Deposit cluster matched to a mid-tier VASP.",
    time: "3h",
    dot: "bg-intel",
  },
];



export function TracifyMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "clay-icon relative flex size-10 shrink-0 shadow-[0_10px_26px_-10px_var(--primary-glow)]",
        className,
      )}
      style={{ backgroundImage: "var(--gradient-intel)" }}
      aria-hidden
    >
      <Boxes className="size-5 text-primary-foreground" />
    </span>
  );
}


function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 84 : 268 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col p-3 lg:flex"
    >
      <div className="clay flex h-full flex-col overflow-hidden">
      <div className="flex h-[76px] items-center gap-2.5 border-b border-border px-4">
        <TracifyMark />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.14 }}
              className="min-w-0"
            >
              <p className="truncate text-sm font-semibold tracking-tight">
                TRACIFY
              </p>
              <p className="mono truncate text-[10px] text-muted-foreground">
                blockchain intelligence
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          const link = (
            <Link
              key={to}
              to={to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-300",
                active
                  ? "clay text-sidebar-accent-foreground shadow-[0_12px_28px_-16px_var(--primary-glow)]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-1 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <Icon
                className={cn(
                  "size-[18px] shrink-0 transition-colors",
                  active && "text-primary",
                )}
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );

          return collapsed ? (
            <Tooltip key={to}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>


      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn(
            "w-full justify-start gap-2 rounded-xl text-muted-foreground",
            collapsed && "justify-center",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>
      </div>
    </motion.aside>

  );
}

function Topbar() {
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const { user, profile, isAdmin, signOut } = useAuth();
  const name =
    (profile as { full_name?: string } | null)?.full_name ??
    user?.email?.split("@")[0] ??
    "Investigator";

  return (
    <header className="sticky top-0 z-30 px-3 pt-3">
      <div className="clay flex h-[68px] items-center gap-3 px-3 sm:px-4">
      <div className="flex items-center gap-2.5 lg:hidden">
        <TracifyMark />
        <span className="text-sm font-semibold">TRACIFY</span>
      </div>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="clay-inset hidden h-10 max-w-lg flex-1 items-center gap-2.5 px-3.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:flex"
      >
        <Search className="size-4" />
        <span>Search cases, wallets, entities, tx hashes…</span>
        <kbd className="mono clay-pill ml-auto px-2 py-0.5 text-[10px]">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setCommandOpen(true)}
          aria-label="Open command palette"
        >
          <Search className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="clay-icon relative hidden size-10 sm:flex"
              aria-label="Notifications"
            >
              <Bell className="size-4 text-muted-foreground" />
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-critical text-[9px] font-bold text-critical-foreground">
                4
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="label-caps">
              Notifications
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {NOTIFICATIONS.map((n) => (
              <DropdownMenuItem
                key={n.title}
                className="flex-col items-start gap-0.5 py-2.5"
              >
                <span className="flex w-full items-center gap-2 text-[13px] font-medium">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", n.dot)}
                  />
                  {n.title}
                  <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                    {n.time}
                  </span>
                </span>
                <span className="pl-3.5 text-[11px] text-muted-foreground">
                  {n.body}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="clay clay-lift flex items-center gap-2.5 px-2.5 py-1.5 text-left"
              >
                <span
                  className="flex size-8 items-center justify-center rounded-lg text-xs font-semibold uppercase text-primary-foreground"
                  style={{ backgroundImage: "var(--gradient-intel)" }}
                >
                  {name.slice(0, 2)}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-xs font-medium">{name}</span>
                  <span className="mono block truncate text-[10px] text-muted-foreground">
                    {isAdmin ? "admin" : "investigator"}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="mono text-[11px] font-normal text-muted-foreground">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="default" size="sm" className="clay clay-lift gap-2 rounded-xl">
            <Link to="/auth">
              <LogOut className="size-4 rotate-180" />
              Sign in
            </Link>
          </Button>
        )}
      </div>
      </div>
    </header>

  );
}

function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 z-30 px-3 pb-3 lg:hidden">
      <div className="clay flex items-center justify-between gap-1 px-2 py-2">
      {NAV.slice(0, 5).map(({ to, label, icon: Icon }) => {
        const active = pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] transition-colors",
              active ? "clay-inset text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-[18px]" />
            <span className="truncate">{label.split(" ")[0]}</span>
          </Link>
        );
      })}
      </div>
    </nav>

  );
}

export function AppShell({
  children,
  bare = false,
}: {
  children: React.ReactNode;
  bare?: boolean;
}) {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="flex min-h-screen flex-col transition-[padding] duration-300"
        style={{ paddingLeft: undefined }}
      >
        <div
          className={cn(
            "flex min-h-screen flex-col transition-[padding] duration-300",
            collapsed ? "lg:pl-[84px]" : "lg:pl-[268px]",
          )}
        >
          <Topbar />
          <main
            className={cn(
              "flex-1",
              bare ? "" : "mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6",
            )}
          >

            {children}
          </main>
          <MobileNav />
        </div>
      </div>
    </div>
  );
}
