import Link from "next/link";
import { EyepieceDemo } from "@/components/landing/eyepiece-demo";
import { LandingCtas } from "@/components/landing/landing-ctas";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatAngleArcsec } from "@/lib/format";
import type { Provenance } from "@/modules/simulations/engine";
import { FEATURED_TARGET_IDS, getTarget, TARGETS } from "@/modules/targets/catalogue";

const FLOW = [
  { icon: Icons.Telescope, title: "Choose a telescope", body: "Pick a real model from the catalogue or build your own from its optics." },
  { icon: Icons.Wrench, title: "Configure equipment", body: "Add eyepieces, a camera, a Barlow, filters and a mount. Inspect each in 3D." },
  { icon: Icons.Play, title: "Simulate", body: "See the eyepiece or camera view of the Moon, planets, a nebula or a galaxy." },
  { icon: Icons.Compare, title: "Compare", body: "Put two setups side by side on the same target and conditions." },
  { icon: Icons.Bookmark, title: "Preserve", body: "Save configurations and sessions. Each session reopens exactly as it was." },
];

const SPACES = [
  {
    href: "/lab",
    icon: Icons.Telescope,
    title: "Telescope Lab",
    body: "Configure telescopes with realistic equipment, calculate magnification, exit pupil, true field, resolution and image scale, and simulate the view.",
  },
  {
    href: "/observatory",
    icon: Icons.Home,
    title: "My Observatory",
    body: "Your personal space for equipment you own or plan to buy, the configurations you build, saved simulations and observation projects.",
  },
];

const PROVENANCE: { kind: Provenance; example: string }[] = [
  { kind: "calculated", example: "Magnification = focal length ÷ eyepiece" },
  { kind: "retrieved", example: "Target sizes and equipment specifications" },
  { kind: "estimated", example: "Blur from atmospheric seeing" },
  { kind: "illustrative", example: "The rendered eyepiece view itself" },
];

const CATEGORY: Record<string, string> = { moon: "Moon", planet: "Planet", nebula: "Nebula", galaxy: "Galaxy", cluster: "Star cluster" };
const FEATURED = FEATURED_TARGET_IDS.map((id) => getTarget(id)!);

export default function Home() {
  return (
    <main className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="relative mx-auto grid grid-cols-[minmax(0,1fr)] max-w-6xl items-center gap-12 px-4 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div>
            <p className="eyebrow !text-accent">Configure. Simulate. Preserve.</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              See what your telescope will show before you point it.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted text-pretty">
              Configure a telescope with real equipment, simulate the view through an eyepiece or a camera, and keep
              every setup in your own observatory. Each number shows how it was worked out.
            </p>
            <div className="mt-8">
              <LandingCtas />
            </div>
            <p className="mt-4 text-sm text-subtle">No equipment needed to try it. Saving requires a free account.</p>
          </div>
          <EyepieceDemo />
        </div>
      </section>

      {/* Workflow */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="eyebrow">End-to-end workflow</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">From an idea to an observation plan</h2>
          <ol className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FLOW.map((f, i) => (
              <li key={f.title} className="glass relative rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <f.icon />
                  </span>
                  <span className="font-mono text-xs text-subtle">0{i + 1}</span>
                </div>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Spaces */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="eyebrow">Two connected environments</p>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {SPACES.map((p) => (
            <Link key={p.href} href={p.href} className="glass group rounded-2xl p-6 transition-colors hover:border-border-strong">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <p.icon className="size-6" />
                </span>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <span aria-hidden className="ml-auto text-muted transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">{p.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Scientific integrity */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Scientific transparency</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Honest about every number</h2>
            <p className="mt-3 text-muted">
              A long-exposure photo of the Orion Nebula is not what your eye sees at the eyepiece. Universal Observatory
              keeps that distinction clear: faint objects are shown in grey by default, approximations are labelled, and
              every value carries its formula and assumptions.
            </p>
            <p className="mt-3 text-muted">
              Saved sessions record the exact inputs and engine version, so you can check later whether a result still
              reproduces.
            </p>
          </div>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {PROVENANCE.map((p) => (
              <li key={p.kind} className="glass rounded-xl p-4">
                <ProvenanceBadge kind={p.kind} />
                <p className="mt-2 text-sm">{p.example}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Targets */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="eyebrow">Targets</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Start with a classic target</h2>
        <p className="mt-2 text-sm text-muted">
          {TARGETS.length} targets in the Lab: planets, galaxies, nebulae and star clusters. The Lab hides the ones your setup can&apos;t show.
        </p>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FEATURED.map((t) => (
            <li key={t.id}>
              <Link
                href={`/lab/simulate?target=${t.id}`}
                className="glass block rounded-xl p-4 transition-colors hover:border-border-strong"
              >
                <p className="text-xs text-muted">{CATEGORY[t.category]}</p>
                <p className="mt-1 font-semibold">{t.name}</p>
                <p className="mt-2 font-mono text-xs text-muted">≈ {formatAngleArcsec(t.angularSize.majorAxisArcsec)} across</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="glass rounded-2xl bg-[radial-gradient(ellipse_at_top,rgba(81,98,255,0.18),transparent_65%)] px-6 py-12 text-center sm:px-10">
          <h2 className="text-2xl font-semibold tracking-tight">Plan your next night out</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted">
            Find out whether that eyepiece frames the whole Andromeda Galaxy, or whether Saturn&apos;s rings will be more
            than a dot, before you carry everything outside.
          </p>
          <div className="mt-6 flex justify-center">
            <LandingCtas />
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-xs text-muted">
          <p>Universal Observatory</p>
          <p>Simulations are approximations. Each value is labelled with how it was obtained.</p>
        </div>
      </footer>
    </main>
  );
}
