"use client";
import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  TableSkeleton,
  TextInput,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { useAdminData, useDebounced, usePageSize } from "@/components/admin/hooks";
import { fmtDateTime } from "@/lib/format";

type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type Payload = { total: number; page: number; per: number; pages: number; rows: AuditRow[] };

const ENTITIES = ["test", "question", "attempt", "student", "announcement", "feedback"];

const ACTION_TONE = (action: string): "green" | "red" | "amber" | "blue" | "violet" | "neutral" => {
  if (action.includes("delete") || action.includes("disable")) return "red";
  if (action.includes("create") || action.includes("enable")) return "green";
  if (action.includes("correct") || action.includes("bulk")) return "amber";
  if (action.includes("update")) return "blue";
  return "neutral";
};

export default function AdminAudit() {
  const per = usePageSize(20);

  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const debSearch = useDebounced(search, 300);
  const debAction = useDebounced(action, 300);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (entity !== "all") p.set("entity", entity);
    if (debAction.trim()) p.set("action", debAction.trim());
    if (debSearch.trim()) p.set("q", debSearch.trim());
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("page", String(page));
    p.set("per", String(per));
    return `/api/admin/audit?${p.toString()}`;
  }, [entity, debAction, debSearch, from, to, page, per]);

  const { data, error, loading, reload } = useAdminData<Payload>(url);

  return (
    <AdminLayout>
      <Card className="mb-3 flex flex-wrap items-center gap-2 px-3.5 py-3">
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="w-auto" aria-label="Entity filter">
          <option value="all">All entities</option>
          {ENTITIES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        <TextInput
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          placeholder="Action contains… (e.g. test.update)"
          className="w-auto max-w-[220px]"
          aria-label="Action filter"
        />
        <div className="relative min-w-[160px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
            <Icon name="search" size={14} />
          </span>
          <TextInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search actor, record id or details…"
            className="pl-9!"
            aria-label="Search audit log"
          />
        </div>
        <label className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--muted)" }}>
          From
          <TextInput type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-auto" />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--muted)" }}>
          To
          <TextInput type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-auto" />
        </label>
      </Card>

      {error && (
        <div className="mb-3">
          <ErrorState message={error} onRetry={reload} />
        </div>
      )}

      {loading && !data ? (
        <Card className="px-5 py-4">
          <TableSkeleton rows={10} cols={5} />
        </Card>
      ) : (data?.rows ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon="audit"
            title="No audit entries match"
            hint="Sensitive admin actions (test/question edits, deletions, score corrections, account status, settings) are recorded here. Nothing to show yet."
          />
        </Card>
      ) : (
        <Card className="px-2 pb-3 pt-1">
          <div className="admin-scroll overflow-x-auto">
            <table className="admin-table w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className="w-8" />
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((r) => (
                  <>
                    <tr key={r.id} className="admin-row cursor-pointer" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      <td>
                        <span style={{ color: "var(--muted)" }}>
                          <Icon name={expanded === r.id ? "chevronDown" : "chevronRight"} size={13} />
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[12.5px]">{fmtDateTime(r.created_at)}</td>
                      <td className="max-w-[190px]">
                        <span className="block truncate">{r.actor_email || "—"}</span>
                      </td>
                      <td>
                        <Badge tone={ACTION_TONE(r.action)}>{r.action}</Badge>
                      </td>
                      <td className="max-w-[260px]">
                        <span className="block truncate text-[12.5px]">
                          {r.entity}
                          {r.entity_id ? ` · ${r.entity_id.slice(0, 12)}…` : ""}
                        </span>
                      </td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`${r.id}-detail`} className="admin-row">
                        <td colSpan={5} className="!py-2">
                          <pre
                            className="admin-scroll mono max-h-56 overflow-auto rounded-xl px-3 py-2.5 text-[11.5px] leading-5"
                            style={{ background: "var(--pill)" }}
                          >
                            {JSON.stringify(
                              {
                                action: r.action,
                                entity: r.entity,
                                entity_id: r.entity_id,
                                actor: r.actor_email,
                                at: r.created_at,
                                details: r.details ?? {},
                              },
                              null,
                              2
                            )}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            <div className="px-3 pt-3">
              <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} total={data?.total ?? 0} per={per} onPage={setPage} />
            </div>
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}
