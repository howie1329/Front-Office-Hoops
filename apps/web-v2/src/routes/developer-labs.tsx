import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ChartHistogramIcon,
  ChartLineIcon,
  InformationCircleIcon,
  PieChartIcon,
  Target01Icon,
  TestTubeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";

import { Button } from "@workspace/ui/components/button";

export const Route = createFileRoute("/developer-labs")({
  component: DeveloperLabsPage,
});

const canonicalLabs = [
  {
    order: "01",
    title: "Population & roster",
    summary:
      "Create the player universe that every downstream fixture and league will consume.",
    scope:
      "Generation, population distributions, identity, roster assembly, position coverage, and fixture export.",
    status: "Existing",
    statusDetail: "Calibration pending",
    statusTone: "active",
    icon: UserGroupIcon,
    links: [
      {
        label: "Player generation",
        to: "/developer-labs/player-generation" as const,
      },
      {
        label: "Team assembly",
        to: "/developer-labs/team-assembly" as const,
      },
    ],
  },
  {
    order: "02",
    title: "Game & matchup",
    summary:
      "Turn a deterministic two-team fixture into a complete, explainable game result.",
    scope:
      "Rotations, availability, matchup context, possession simulation, box scores, injuries, and reconciliation.",
    status: "Current focus",
    statusDetail: "Acceptance pending",
    statusTone: "current",
    icon: TestTubeIcon,
    links: [
      {
        label: "Open workbench",
        to: "/developer-labs/game-matchup" as const,
      },
    ],
  },
  {
    order: "03",
    title: "Production & value",
    summary:
      "Aggregate games into season evidence, then calculate the visible universal player value.",
    scope:
      "10/25/82-game samples, player and team production, confidence states, value breakdowns, and league comparisons.",
    status: "Next",
    statusDetail: "Major lab",
    statusTone: "next",
    icon: ChartLineIcon,
    links: [
      {
        label: "Open workbench",
        to: "/developer-labs/production-value" as const,
      },
    ],
  },
  {
    order: "04",
    title: "Career cohort harness",
    summary:
      "Test how player skills, health, and careers change across controlled longitudinal cohorts.",
    scope:
      "Development, aging, injuries, recovery, availability, retirement, and multi-year distribution stability.",
    status: "Later",
    statusDetail: "Preview available",
    statusTone: "preview",
    icon: ChartHistogramIcon,
    links: [
      {
        label: "Open preview",
        to: "/developer-labs/development-cohorts" as const,
      },
    ],
  },
  {
    order: "05",
    title: "Market & rules",
    summary:
      "Model the contract market while keeping financial outcomes legal and explainable.",
    scope:
      "Contract terms, player demand, offer acceptance, free agency, cap/tax, legality, affordability, and market clearing.",
    status: "Later",
    statusDetail: "Planned",
    statusTone: "planned",
    icon: PieChartIcon,
    links: undefined,
  },
  {
    order: "06",
    title: "Draft & decision",
    summary:
      "Connect uncertain scouting information to draft classes, user picks, and baseline decisions.",
    scope:
      "Draft classes, scouting ranges, draft order, rookie deals, pick legality, and baseline best-available selection.",
    status: "Later",
    statusDetail: "Planned",
    statusTone: "planned",
    icon: Target01Icon,
    links: undefined,
  },
  {
    order: "07",
    title: "League loop",
    summary:
      "Exercise the complete saved league across seasons and prove the systems compose safely.",
    scope:
      "Lifecycle orchestration, save/reload, offseason, history, performance, invariants, and failure reproduction.",
    status: "Final integration",
    statusDetail: "Planned",
    statusTone: "final",
    icon: InformationCircleIcon,
    links: undefined,
  },
] as const;

type Lab = (typeof canonicalLabs)[number];

function statusClasses(tone: Lab["statusTone"]) {
  switch (tone) {
    case "current":
      return "bg-foreground text-background";
    case "next":
      return "border border-foreground/30 bg-background text-foreground";
    case "active":
      return "border border-border bg-background text-foreground";
    case "preview":
      return "border border-border bg-muted text-muted-foreground";
    case "final":
      return "border border-border bg-muted text-muted-foreground";
    case "planned":
      return "border border-border bg-muted text-muted-foreground";
  }
}

function DeveloperLabsPage() {
  const { pathname } = useLocation();

  if (pathname !== "/developer-labs" && pathname !== "/developer-labs/") {
    return <Outlet />;
  }

  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-border pb-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-sm leading-5 text-muted-foreground [&>span:first-child]:font-semibold [&>span:first-child]:text-foreground">
              <span>V2</span>
              <span aria-hidden="true">/</span>
              <span>Developer labs</span>
            </p>

            <Button
              variant="outline"
              asChild
              className="min-h-10 gap-2 px-3.5 text-sm"
            >
              <Link to="/">
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Back to foundation
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1 text-xs leading-4 font-semibold text-foreground">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-foreground"
                />
                Phase 2 · calibration
              </div>
              <h1 className="mt-4 max-w-3xl text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-[3.25rem]">
                Simulation evidence, organized by lab.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
                Seven bounded surfaces take V2 from generated players to a
                durable multi-season league. Each lab produces evidence for a
                production system; none is a second game engine.
              </p>
            </div>

            <aside className="rounded-lg border border-border bg-muted p-5">
              <p className="text-xs leading-5 font-semibold tracking-[0.02em] text-muted-foreground uppercase">
                Current sequence
              </p>
              <h2 className="mt-2 text-lg leading-6 font-semibold tracking-[-0.02em]">
                Game & matchup
              </h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                Acceptance work is in progress. Production & value follows once
                the game contract and reconciliation bands are accepted.
              </p>
              <Link
                to="/developer-labs/game-matchup"
                className="mt-4 inline-flex items-center gap-2 text-sm leading-5 font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Open current workbench
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden="true"
                />
              </Link>
            </aside>
          </div>
        </header>

        <div className="flex flex-col gap-12 pt-12">
          <section aria-labelledby="lab-sequence-heading">
            <div className="mb-5 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2
                  id="lab-sequence-heading"
                  className="text-lg leading-6 font-semibold tracking-[-0.02em]"
                >
                  The V2 lab sequence
                </h2>
                <span className="text-xs leading-5 text-muted-foreground">
                  Canonical surfaces · July 2026
                </span>
              </div>
              <p className="max-w-2xl text-sm leading-[1.375rem] text-muted-foreground">
                The order is dependency-driven: population feeds games, games
                feed production, and the league loop comes last as the
                integration harness.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              {canonicalLabs.map((lab, index) => (
                <LabRow
                  key={lab.title}
                  lab={lab}
                  isLast={index === canonicalLabs.length - 1}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-4 border-t border-border pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="text-xs leading-5 font-semibold tracking-[0.02em] text-muted-foreground uppercase">
                Surface vs. system
              </p>
              <h2 className="mt-2 text-lg leading-6 font-semibold tracking-[-0.02em]">
                One lab can expose several production modules.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Population & roster combines the player-generation and team-
              assembly workbenches without merging their domain APIs. Market &
              rules does the same for demand, acceptance, legality, and
              affordability. Long-running distribution sweeps stay headless; the
              route is for setup, comparison, and explanation.
            </p>
          </section>

          <footer className="flex items-start gap-2.5 border-t border-border pt-4 text-muted-foreground">
            <HugeiconsIcon
              icon={InformationCircleIcon}
              strokeWidth={1.8}
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs leading-5 text-muted-foreground">
              All workspaces use deterministic seeds and visible assumptions.
              <span aria-hidden="true">|</span>
              Results are evidence until a validated production command promotes
              them into the league document.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}

function LabRow({ lab, isLast }: { lab: Lab; isLast: boolean }) {
  return (
    <article
      className={`grid gap-5 bg-card p-5 text-card-foreground transition-colors sm:p-6 lg:grid-cols-[3.5rem_minmax(0,1fr)_13rem] lg:items-start ${isLast ? "" : "border-b border-border"} ${lab.statusTone === "current" ? "bg-muted/60" : ""}`}
    >
      <div className="flex items-start gap-3 lg:block">
        <span className="text-sm leading-6 font-semibold tabular-nums text-muted-foreground">
          {lab.order}
        </span>
        <HugeiconsIcon
          icon={lab.icon}
          strokeWidth={1.8}
          className="size-5 text-foreground lg:mt-5"
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-xl leading-6 font-semibold tracking-[-0.025em]">
            {lab.title}
          </h3>
          <span
            className={`inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold tracking-[0.02em] ${statusClasses(lab.statusTone)}`}
          >
            {lab.status}
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-[1.375rem] text-pretty text-muted-foreground">
          {lab.summary}
        </p>
        <p className="mt-3 max-w-3xl text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Scope:</span>{" "}
          {lab.scope}
        </p>
        {lab.links ? (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {lab.links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex items-center gap-1.5 text-sm leading-5 font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {link.label}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3 lg:block lg:border-t-0 lg:pt-1">
        <span className="text-xs leading-5 text-muted-foreground">
          {lab.statusDetail}
        </span>
        {lab.statusTone === "current" ? (
          <span className="inline-flex items-center gap-2 text-xs leading-5 font-semibold text-foreground">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-foreground"
            />
            Working now
          </span>
        ) : null}
      </div>
    </article>
  );
}
