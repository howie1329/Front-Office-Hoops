import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/league")({
  validateSearch: (search: Record<string, unknown>): { saveId?: string } => {
    const saveId = typeof search.saveId === "string" ? search.saveId : undefined
    return saveId ? { saveId } : {}
  },
  component: LeagueLayout,
})

function LeagueLayout() {
  return <Outlet />
}
