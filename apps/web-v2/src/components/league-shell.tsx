import * as React from "react"

import { useLocation, Link } from "@tanstack/react-router"
import {
  ArrowRight01Icon,
  Calendar01Icon,
  ChartLineIcon,
  DashboardSquare01Icon,
  Resize01Icon,
  SaveIcon,
  UserGroupIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { LeagueDocument } from "@workspace/domain-v2"
import type { LifecycleActionState } from "@workspace/sim-v2"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export type LeagueShellContextValue = {
  league: LeagueDocument
  teamId: string
  advanceAction: LifecycleActionState
  isSimulating: boolean
  simulationError: string | null
  handleAdvanceDay: () => Promise<void>
}

const LeagueShellContext = React.createContext<LeagueShellContextValue | null>(
  null
)

export function LeagueShellProvider({
  value,
  children,
}: React.PropsWithChildren<{ value: LeagueShellContextValue }>) {
  return (
    <LeagueShellContext.Provider value={value}>
      {children}
    </LeagueShellContext.Provider>
  )
}

export function useLeagueShell(): LeagueShellContextValue {
  const context = React.useContext(LeagueShellContext)
  if (!context) {
    throw new Error("useLeagueShell must be used inside LeagueShellProvider")
  }
  return context
}

export const DEFAULT_SIDEBAR_WIDTH = 224
const MIN_SIDEBAR_WIDTH = 208
const MAX_SIDEBAR_WIDTH = 296

export function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width))
}

function SidebarResizeHandle({
  width,
  onChange,
}: {
  width: number
  onChange: (width: number) => void
}) {
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartX = React.useRef(0)
  const dragStartWidth = React.useRef(width)

  React.useEffect(() => {
    if (!isDragging) return

    const handlePointerMove = (event: PointerEvent) => {
      onChange(
        clampSidebarWidth(
          dragStartWidth.current + event.clientX - dragStartX.current
        )
      )
    }
    const handlePointerUp = () => setIsDragging(false)
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [isDragging, onChange])

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 32 : 8
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      onChange(clampSidebarWidth(width - step))
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      onChange(clampSidebarWidth(width + step))
    } else if (event.key === "Home") {
      event.preventDefault()
      onChange(MIN_SIDEBAR_WIDTH)
    } else if (event.key === "End") {
      event.preventDefault()
      onChange(MAX_SIDEBAR_WIDTH)
    }
  }

  return (
    <button
      type="button"
      role="separator"
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-valuemin={MIN_SIDEBAR_WIDTH}
      aria-valuemax={MAX_SIDEBAR_WIDTH}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels wide`}
      title="Resize sidebar"
      className="group/resize absolute inset-y-0 -right-1 z-30 hidden w-2 cursor-col-resize lg:block"
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        event.preventDefault()
        dragStartX.current = event.clientX
        dragStartWidth.current = width
        setIsDragging(true)
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-border group-focus-visible/resize:bg-ring"
      />
      <HugeiconsIcon
        icon={Resize01Icon}
        size={12}
        strokeWidth={2}
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-sidebar p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100"
      />
      <span className="sr-only">
        Use the left and right arrow keys to resize. Hold Shift for larger
        steps.
      </span>
    </button>
  )
}

export function LeagueSidebar({
  league,
  teamId,
  width,
  onWidthChange,
}: {
  league: LeagueDocument
  teamId: string
  width: number
  onWidthChange: (width: number) => void
}) {
  const { pathname } = useLocation()
  const team = league.entities.teams[teamId]
  const isDashboard = pathname === "/league" || pathname === "/league/"
  const isRoster = pathname === "/league/roster"

  return (
    <Sidebar
      className="relative border-r border-border bg-muted/20"
      collapsible="offcanvas"
    >
      <SidebarHeader className="h-14 shrink-0 justify-center gap-0 border-b border-border px-4 py-0">
        <p className="truncate text-sm font-semibold tracking-[-0.02em]">
          {team.name}
        </p>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isDashboard}
                  size="sm"
                  className="h-8"
                >
                  <Link to="/league" search={{ saveId: league.metadata.id }}>
                    <HugeiconsIcon
                      icon={DashboardSquare01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            Team
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isRoster}
                  size="sm"
                  className="h-8"
                >
                  <Link
                    to="/league/roster"
                    search={{ saveId: league.metadata.id }}
                  >
                    <HugeiconsIcon
                      icon={UserGroupIcon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    Roster
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  size="sm"
                  className="h-8 justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={Calendar01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Schedule</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            League
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  size="sm"
                  className="h-8 justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={ChartLineIcon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Standings</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  size="sm"
                  className="h-8 justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={Wallet01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Transactions</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-muted-foreground/50"
          />
          <span className="truncate">League saved locally</span>
        </div>
        {!isDashboard ? (
          <Link
            to="/league"
            search={{ saveId: league.metadata.id }}
            className="inline-flex min-h-7 items-center gap-2 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={14}
              strokeWidth={2}
              aria-hidden="true"
            />
            Return to dashboard
          </Link>
        ) : null}
        <Link
          to="/league/start"
          className="inline-flex min-h-7 items-center gap-2 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <HugeiconsIcon
            icon={SaveIcon}
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
          Manage saves
        </Link>
      </SidebarFooter>
      <SidebarResizeHandle width={width} onChange={onWidthChange} />
    </Sidebar>
  )
}
