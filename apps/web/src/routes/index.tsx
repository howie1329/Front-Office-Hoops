import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Front Office Hoops</h1>
          <p>Simulation-first basketball GM prototype.</p>
          <Button className="mt-2" asChild>
            <Link to="/sim-lab">Open Sim Lab</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
