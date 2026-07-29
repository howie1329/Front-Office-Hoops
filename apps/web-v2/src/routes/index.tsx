import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: V2HomePage })

function V2HomePage() {
  return (
    <main>
      <p>Front Office Hoops v2</p>
      <h1>TanStack Start is ready.</h1>
    </main>
  )
}
