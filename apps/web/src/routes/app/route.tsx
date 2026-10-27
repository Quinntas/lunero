import { useAuthActions } from "@convex-dev/auth/react"
import { Link, Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Spinner } from "@workspace/ui/components/spinner"
import { useConvexAuth, useQuery } from "convex/react"
import {
  ChevronsUpDownIcon,
  FileTextIcon,
  HandshakeIcon,
  HomeIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react"
import { useEffect } from "react"
import { Logo } from "@/components/logo"
import { LocaleSwitcher, ThemeToggle } from "@/components/preferences"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"

export const Route = createFileRoute("/app")({
  // Auth lives in the browser (Convex Auth tokens), so the app renders client-side.
  ssr: false,
  component: AppLayout,
})

function AppLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: "/sign-in", search: { redirect: location.href }, replace: true })
    }
  }, [isLoading, isAuthenticated, navigate, location.href])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppSidebar() {
  const { t } = useI18n()
  const me = useQuery(api.users.me)
  const proposals = useQuery(api.drafts.list)
  const contracts = useQuery(api.contracts.list)
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const proposalsForMe =
    proposals?.filter((p) => p.isMyTurn && (p.status === "sent" || p.status === "editing"))
      .length ?? 0
  const contractsForMe =
    contracts?.filter((c) =>
      c.myRole === "contractor"
        ? c.status === "awaiting_payment" || c.awaitingReview > 0
        : c.status === "active" && c.toDeliver > 0,
    ).length ?? 0

  const nav = [
    { to: "/app", label: t("nav.home"), icon: HomeIcon, exact: true, badge: 0 },
    { to: "/app/proposals", label: t("nav.proposals"), icon: FileTextIcon, badge: proposalsForMe },
    { to: "/app/contracts", label: t("nav.contracts"), icon: HandshakeIcon, badge: contractsForMe },
    { to: "/app/settings", label: t("nav.settings"), icon: SettingsIcon, badge: 0 },
  ] as const

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/app" className="px-2 py-1.5 group-data-[collapsible=icon]:px-0">
          <Logo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
        <Button asChild className="w-full group-data-[collapsible=icon]:hidden">
          <Link to="/app/proposals/new">
            <PlusIcon />
            {t("nav.newProposal")}
          </Link>
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = "exact" in item ? pathname === item.to : pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge > 0 ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <UserAvatar user={me} className="size-8" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{me?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{me?.email}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-60">
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                  <span className="truncate">{me?.name}</span>
                  {me?.isFreelancer ? (
                    <Badge variant="secondary">{t("nav.freelancerMode")}</Badge>
                  ) : null}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void navigate({ to: "/app/settings" })}>
                  <SettingsIcon />
                  {t("nav.settings")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void signOut().then(() => navigate({ to: "/" }))}>
                  <LogOutIcon />
                  {t("common.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
