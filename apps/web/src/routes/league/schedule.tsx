import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/league/schedule")({
  beforeLoad: () => {
    throw redirect({ to: "/league/calendar" })
  },
})
