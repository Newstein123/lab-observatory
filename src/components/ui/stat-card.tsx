import Link from "next/link";

export function StatCard({ label, value, href, hint }: { label: string; value: React.ReactNode; href?: string; hint?: string }) {
  const body = (
    <>
      <p className="font-mono text-3xl font-medium tabular-nums">{value}</p>
      <p className="mt-1 flex items-center justify-between text-sm text-muted">
        <span>{label}</span>
        {href && <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </>
  );
  const cls = "glass group block rounded-xl p-4 transition-colors";
  return href ? (
    <Link href={href} className={`${cls} hover:border-border-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
