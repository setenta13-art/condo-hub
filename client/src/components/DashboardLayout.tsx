import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeft,
  Settings2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/" },
  { icon: Megaphone, label: "Comunicados", path: "/announcements", requiresScope: true },
  { icon: ClipboardList, label: "Chamados", path: "/tickets", requiresScope: true },
  { icon: FileText, label: "Documentos", path: "/documents", requiresScope: true },
  { icon: UsersRound, label: "Convites", path: "/invites", requiresScope: true, managementOnly: true },
  { icon: UsersRound, label: "Responsáveis", path: "/responsibles", requiresScope: true, managementOnly: true },
  { icon: Settings2, label: "Configuração", path: "/setup", managementOnly: true, platformOnly: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { data: overview } = trpc.condo.dashboard.overview.useQuery(undefined, { enabled: Boolean(user) });
  const { data: contexts } = trpc.auth.contexts.useQuery(undefined, { enabled: Boolean(user) });
  const { data: unreadNotifications = 0 } = trpc.condo.notifications.unreadCount.useQuery(undefined, { enabled: Boolean(user) && Boolean(overview?.scope), refetchInterval: 30000 });
  const utils = trpc.useUtils();
  const markAllNotificationsRead = trpc.condo.notifications.markAllRead.useMutation({
    onSuccess: () => utils.condo.notifications.unreadCount.invalidate(),
  });
  const switchContext = trpc.auth.switchContext.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hasScope = Boolean(overview?.scope);
  const canManage = user?.role === "admin" || ["staff", "manager", "admin"].includes(overview?.scope?.membership?.role ?? "");
  const visibleMenuItems = menuItems.filter(
    item =>
      (!item.requiresScope || hasScope) &&
      (!item.managementOnly || canManage) &&
      (!item.platformOnly || user?.role === "admin"),
  );
  const activeMenuItem = visibleMenuItems.find(item => item.path === location) ?? visibleMenuItems[0];
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const displayName = user?.name || "Visitante";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-[76px] justify-center border-b border-sidebar-border/70">
            <div className="flex w-full items-center gap-3 px-2">
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Alternar navegação"
              >
                <Building2 className="h-[18px] w-[18px]" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold tracking-tight text-sidebar-foreground">CondoHub</p>
                  <p className="truncate text-[11px] font-medium text-muted-foreground">Gestão que aproxima</p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-4">
            {!isCollapsed && overview?.scope && (
              <div className="mx-3 mb-4 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-3">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Contexto atual</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="mt-1 flex w-full items-center justify-between gap-2 text-left">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold">{overview.scope.condominium.name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {overview.scope.membership?.block ? `${overview.scope.membership.block} · ` : ""}
                          {overview.scope.membership?.unit ? `Unidade ${overview.scope.membership.unit}` : overview.scope.membership?.role ?? "Administração"}
                        </p>
                      </div>
                      {(contexts?.length ?? 0) > 1 && <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </DropdownMenuTrigger>
                  {(contexts?.length ?? 0) > 1 && (
                    <DropdownMenuContent align="start" className="w-72">
                      {contexts?.map(context => (
                        <DropdownMenuItem
                          key={context.membership.id}
                          onClick={() => switchContext.mutate({ membershipId: context.membership.id })}
                          className="cursor-pointer"
                        >
                          <div>
                            <p className="text-sm font-semibold">{context.condominium.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {context.membership.block ? `${context.membership.block} · ` : ""}
                              {context.membership.unit ? `Unidade ${context.membership.unit}` : context.membership.role}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              </div>
            )}
            {!isCollapsed && (
              <p className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Menu principal</p>
            )}
            <SidebarMenu className="px-2">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.path);
                        if (item.path === "/tickets" && unreadNotifications > 0) markAllNotificationsRead.mutate();
                        if (isMobile && !isCollapsed) toggleSidebar();
                      }}
                      tooltip={item.label}
                      className="h-11 rounded-xl font-medium transition-all"
                    >
                      <item.icon className={`h-[17px] w-[17px] ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span>{item.label}</span>
                      {item.path === "/tickets" && unreadNotifications > 0 && (
                        <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-extrabold text-destructive-foreground">
                          {unreadNotifications > 99 ? "99+" : unreadNotifications}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/70 p-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center">
                    <Avatar className="h-9 w-9 shrink-0 border border-primary/20 bg-primary/10">
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                      <p className="truncate text-sm font-semibold leading-none">{displayName}</p>
                      <p className="mt-1.5 truncate text-xs text-muted-foreground">
                        {user.role === "admin" ? "Administrador da plataforma" : user.email || "Morador"}
                      </p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => { setLocation("/profile"); if (isMobile && !isCollapsed) toggleSidebar(); }} className="cursor-pointer">
                    <UserRound className="mr-2 h-4 w-4" />
                    <span>Meu perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair da conta</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" onClick={() => startLogin()} className="w-full justify-start gap-2 rounded-xl bg-background group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <LogOut className="h-4 w-4 rotate-180" />
                <span className="group-data-[collapsible=icon]:hidden">Entrar</span>
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => !isCollapsed && setIsResizing(true)}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-2 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="text-sm font-semibold text-foreground">{activeMenuItem.label}</span>
            </div>
          </div>
        )}
        <main className="min-h-screen flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
