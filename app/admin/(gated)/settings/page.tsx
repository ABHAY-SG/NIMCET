"use client";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";
import { Badge, ErrorState, InfoRow, SectionCard, Skeleton, useToast } from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { setStoredPageSize, useAdminData, useAdminTheme, usePageSize } from "@/components/admin/hooks";
import { THEMES } from "@/lib/theme";
import { fmtNum } from "@/lib/format";

type Config = {
  adminEmail: string;
  adminEmailsConfigured: boolean;
  adminEmailsCount: number;
  serviceKeyConfigured: boolean;
  supabaseConfigured: boolean;
  avatarsBucket: boolean;
  tables: { announcements: boolean; feedback: boolean; auditLog: boolean };
  environment: string;
};

function Ok({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <Badge tone={ok ? "green" : "red"}>{ok ? "Available" : "Missing"}</Badge>
    </div>
  );
}

export default function AdminSettings() {
  const toast = useToast();
  const { theme, setTheme } = useAdminTheme();
  // Live value: setStoredPageSize dispatches an event the hook listens to, so
  // the selected row count and the summary below always reflect reality.
  const per = usePageSize(20);
  const config = useAdminData<Config>("/api/admin/settings/config");

  const chooseTheme = (id: (typeof THEMES)[number]["id"]) => {
    setTheme(id);
    toast(`Theme set to ${THEMES.find((t) => t.id === id)?.name ?? id}.`);
  };

  const choosePer = (n: number) => {
    setStoredPageSize(n);
    toast(`Tables will show ${n} rows per page.`);
  };

  return (
    <AdminLayout>
      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Appearance" subtitle="One theme system shared with the student app">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => chooseTheme(t.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-3 text-left text-[13px] font-bold transition-transform hover:-translate-y-0.5"
                style={{
                  background: "var(--pill)",
                  border: theme === t.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                }}
                aria-pressed={theme === t.id}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full"
                  style={{ background: t.dot, border: "1px solid var(--border)", boxShadow: `0 0 0 2px color-mix(in srgb, ${t.icon} 35%, transparent)` }}
                />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {theme === t.id && (
                  <span style={{ color: "var(--accent)" }}>
                    <Icon name="check" size={14} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--muted)" }}>
            The choice is saved in this browser and applies across the whole app. The moon/sun button in
            the header quick-toggles between Light and Midnight.
          </p>
        </SectionCard>

        <SectionCard title="Display" subtitle="Table density across the panel">
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20, 25, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => choosePer(n)}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition-transform hover:-translate-y-0.5"
                style={{
                  background: per === n ? "var(--btn-bg)" : "var(--pill)",
                  color: per === n ? "var(--btn-text)" : undefined,
                  border: "1px solid var(--border)",
                }}
                aria-pressed={per === n}
              >
                {n} rows
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--muted)" }}>
            Applies to Students, Attempts, Feedback and Audit Log tables — they paginate on the server,
            so large datasets stay fast. The change takes effect when you open those pages.
          </p>
          <div className="mt-3 rounded-2xl px-3.5 py-1" style={{ background: "var(--pill)" }}>
            <InfoRow label="Current page size" value={`${fmtNum(per)} rows`} />
          </div>
        </SectionCard>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <SectionCard title="System configuration" subtitle="Availability checks only — never secret or environment values">
          {config.error && <ErrorState message={config.error} onRetry={config.reload} />}
          {config.loading && !config.data && (
            <div className="space-y-2">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          )}
          {config.data && (
            <>
              <Ok ok={config.data.supabaseConfigured} label="Supabase connection" />
              <Ok ok={config.data.serviceKeyConfigured} label="Server admin access (service role)" />
              <Ok ok={config.data.avatarsBucket} label="Avatars storage bucket" />
              <Ok ok={config.data.tables.announcements} label="Announcements table" />
              <Ok ok={config.data.tables.feedback} label="Feedback table" />
              <Ok ok={config.data.tables.auditLog} label="Admin audit log table" />
              <Ok ok={config.data.adminEmailsConfigured} label="ADMIN_EMAILS configured" />
              <p className="mt-2 text-[12px] leading-5" style={{ color: "var(--muted)" }}>
                Missing tables mean migration <span className="mono">0005_admin.sql</span> has not been run
                in the Supabase SQL editor — run it to unlock announcements, feedback and audit logging.
              </p>
            </>
          )}
        </SectionCard>

        <SectionCard title="Administrator account" subtitle="Access is derived server-side, never from the browser">
          {config.data ? (
            <div className="rounded-2xl px-3.5 py-1" style={{ background: "var(--pill)" }}>
              <InfoRow label="Signed in as" value={config.data.adminEmail} />
              <InfoRow label="Allowlisted addresses" value={`${config.data.adminEmailsCount} (configured server-side)`} />
              <InfoRow label="Environment" value={config.data.environment === "production" ? "Production" : config.data.environment} />
            </div>
          ) : (
            <Skeleton className="h-24" />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/admin/profile" className="admin-btn">
              <Icon name="user" size={14} /> Open profile
            </Link>
            <Link href="/admin/profile#account" className="admin-btn">
              <Icon name="lock" size={14} /> Account &amp; security
            </Link>
          </div>
          <p className="mt-3 text-[12px] leading-5" style={{ color: "var(--muted)" }}>
            The admin allowlist is read from server environment variables only. It cannot be viewed or
            edited from the browser, and no secret keys are ever sent to this page.
          </p>
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
