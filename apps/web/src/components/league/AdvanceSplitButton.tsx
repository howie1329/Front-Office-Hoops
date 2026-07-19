import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import type { SeasonPhase } from "@workspace/shared/types"
import type { AdvancePolicy, AdvanceTarget } from "@workspace/sim"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

export const ADVANCE_BULK_TARGETS: { value: AdvanceTarget; label: string }[] = [
  { value: "week", label: "Advance 1 week" },
  { value: "month_end", label: "Until month end" },
  { value: "trade_deadline", label: "Until trade deadline" },
  { value: "playoffs", label: "Until playoffs" },
  { value: "regular_season_end", label: "Rest of regular season" },
]

type AdvanceSplitButtonProps = {
  phase: SeasonPhase
  disabled?: boolean
  className?: string
  size?: "default" | "sm"
  primaryLabel?: string
  onAdvance: (target: AdvanceTarget, policy?: AdvancePolicy) => void
  onSimPlayoffs?: () => void
}

export function AdvanceSplitButton({
  phase,
  disabled = false,
  className,
  size = "default",
  primaryLabel = "Advance 1 day",
  onAdvance,
  onSimPlayoffs,
}: AdvanceSplitButtonProps) {
  const showBulkMenu = phase !== "playoffs"

  const advanceDay = () => onAdvance("day", "runThrough")

  return (
    <div className={cn("flex w-full sm:min-w-[220px]", className)}>
      <Button
        className="min-w-0 flex-1 rounded-r-none border-r border-primary-foreground/15"
        size={size}
        onClick={advanceDay}
        disabled={disabled}
      >
        {primaryLabel}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            className="rounded-l-none px-2"
            disabled={disabled}
            aria-label="More advance options"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuItem onClick={advanceDay}>
            {primaryLabel}
          </DropdownMenuItem>
          {showBulkMenu ? (
            <>
              <DropdownMenuSeparator />
              {ADVANCE_BULK_TARGETS.map((target) => (
                <DropdownMenuItem
                  key={target.value}
                  onClick={() => onAdvance(target.value, "runThrough")}
                >
                  {target.label}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          {phase === "playoffs" && onSimPlayoffs ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSimPlayoffs}>
                Sim all playoffs
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
