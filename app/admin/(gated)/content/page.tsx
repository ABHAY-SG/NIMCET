"use client";
import { useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  SectionCard,
  Skeleton,
  TextArea,
  TextInput,
  useToast,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/icons";
import { adminMutate, useAdminData } from "@/components/admin/hooks";
import { fmtDateTime, fmtNum, relTime } from "@/lib/format";

type Announcement = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_by_email: string;
  created_at: string;
  updated_at: string;
};

type Facets = {
  exams: Array<{ value: string; count: number }>;
  sections: Array<{ value: string; count: number }>;
  topics: Array<{ value: string; count: number }>;
  difficulties: Array<{ value: string; count: number }>;
  total: number;
};

type Editor = { id: string | null; title: string; body: string; published: boolean };

export default function AdminContent() {
  const toast = useToast();
  const annData = useAdminData<{ rows: Announcement[] }>("/api/admin/announcements");
  const facetsData = useAdminData<Facets>("/api/admin/questions?facets=1");

  const [tab, setTab] = useState<"announcements" | "catalog">("announcements");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Announcement | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const [preview, setPreview] = useState<Announcement | null>(null);

  const rows = useMemo(() => annData.data?.rows ?? [], [annData.data]);
  const published = useMemo(() => rows.filter((r) => r.published).length, [rows]);
  const facets = facetsData.data;

  const openEditor = (a?: Announcement) => {
    if (a) setEditor({ id: a.id, title: a.title, body: a.body, published: a.published });
    else setEditor({ id: null, title: "", body: "", published: false });
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (editor.title.trim().length < 3) return toast("Title needs at least 3 characters.", "error");
    if (editor.body.trim().length < 3) return toast("Body needs at least 3 characters.", "error");
    setEditorBusy(true);
    try {
      const payload = { title: editor.title.trim(), body: editor.body.trim(), published: editor.published };
      if (editor.id) await adminMutate(`/api/admin/announcements/${editor.id}`, "PUT", payload);
      else await adminMutate("/api/admin/announcements", "POST", payload);
      toast(editor.id ? "Announcement updated." : "Announcement created.");
      setEditor(null);
      annData.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setEditorBusy(false);
    }
  };

  const togglePublish = async (a: Announcement) => {
    try {
      await adminMutate(`/api/admin/announcements/${a.id}`, "PUT", { published: !a.published });
      toast(a.published ? "Announcement unpublished — students no longer see it." : "Announcement published to students.");
      annData.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed.", "error");
    }
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDelBusy(true);
    try {
      await adminMutate(`/api/admin/announcements/${confirmDel.id}`, "DELETE");
      toast("Announcement deleted.");
      setConfirmDel(null);
      annData.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed.", "error");
    } finally {
      setDelBusy(false);
    }
  };

  const tabs = (
    <div className="mb-3 flex items-center gap-1 rounded-full p-0.5" style={{ background: "var(--pill)", width: "fit-content" }}>
      {(
        [
          { id: "announcements", label: `Announcements (${rows.length})` },
          { id: "catalog", label: "Catalog" },
        ] as const
      ).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className="cursor-pointer rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
          style={tab === t.id ? { background: "var(--btn-bg)", color: "var(--btn-text)" } : { color: "var(--muted)" }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  return (
    <AdminLayout>
      {tab === "announcements" && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {tabs}
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor()}>
              <Icon name="plus" size={14} /> New announcement
            </button>
          </div>

          {annData.error && (
            <div className="mb-3">
              <ErrorState message={annData.error} onRetry={annData.reload} />
            </div>
          )}

          {annData.loading && !annData.data ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon="content"
                title="No announcements yet"
                hint="Published announcements appear on students' dashboards. Drafts stay hidden."
                action={
                  <button type="button" className="admin-btn admin-btn-primary" onClick={() => openEditor()}>
                    <Icon name="plus" size={14} /> New announcement
                  </button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="px-1 text-[12px]" style={{ color: "var(--muted)" }}>
                {published} published · {rows.length - published} draft{rows.length - published === 1 ? "" : "s"}
              </p>
              {rows.map((a) => (
                <Card key={a.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-extrabold">{a.title}</h3>
                        <Badge tone={a.published ? "green" : "amber"}>{a.published ? "Published" : "Draft"}</Badge>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-6" style={{ color: "var(--muted)" }}>
                        {a.body}
                      </p>
                      <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
                        Created {relTime(a.created_at)} by {a.created_by_email || "admin"} · updated {relTime(a.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" className="admin-btn px-2 py-1.5" title="Preview" onClick={() => setPreview(a)}>
                        <Icon name="eye" size={14} />
                      </button>
                      <button type="button" className="admin-btn px-2 py-1.5" title="Edit" onClick={() => openEditor(a)}>
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        className={a.published ? "admin-btn px-2 py-1.5" : "admin-btn admin-btn-primary px-2 py-1.5"}
                        title={a.published ? "Unpublish" : "Publish"}
                        onClick={() => togglePublish(a)}
                      >
                        <Icon name={a.published ? "eyeOff" : "check"} size={14} />
                      </button>
                      <button type="button" className="admin-btn admin-btn-danger px-2 py-1.5" title="Delete" onClick={() => setConfirmDel(a)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "catalog" && (
        <>
          <div className="mb-3">{tabs}</div>
          {facetsData.error && (
            <div className="mb-3">
              <ErrorState message={facetsData.error} onRetry={facetsData.reload} />
            </div>
          )}
          {facetsData.loading && !facets ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          ) : (
            <div className="space-y-3">
              <Card className="px-4 py-3 text-[12.5px] leading-6" style={{ color: "var(--muted)" }}>
                Subjects, sections and topics are free-text fields stored on each question — this catalog
                is derived from the real question bank, not a separate editable list. Rename or merge a
                value by editing the questions that use it.
              </Card>
              <div className="grid gap-3 lg:grid-cols-3">
                <SectionCard title="Exams" subtitle="Distinct values across the bank">
                  {facets?.exams.length ? (
                    <ul className="space-y-2">
                      {facets.exams.map((f) => (
                        <li key={f.value} className="flex items-center justify-between text-[13px]">
                          <span className="font-bold">{f.value}</span>
                          <span style={{ color: "var(--muted)" }}>{fmtNum(f.count)} questions</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState icon="book" title="No questions yet" />
                  )}
                </SectionCard>
                <SectionCard title="Sections" subtitle={`${fmtNum(facets?.total ?? 0)} questions total`}>
                  {facets?.sections.length ? (
                    <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {facets.sections.map((f) => (
                        <li key={f.value} className="flex items-center justify-between text-[13px]">
                          <span className="truncate font-bold">{f.value === "—" ? "Ungrouped" : f.value}</span>
                          <span className="shrink-0 pl-2" style={{ color: "var(--muted)" }}>{fmtNum(f.count)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState icon="book" title="No sections yet" />
                  )}
                </SectionCard>
                <SectionCard title="Topics" subtitle="Top topics by question count">
                  {facets?.topics.length ? (
                    <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                      {facets.topics.slice(0, 60).map((f) => (
                        <li key={f.value} className="flex items-center justify-between text-[13px]">
                          <span className="truncate font-bold">{f.value === "—" ? "Untagged" : f.value}</span>
                          <span className="shrink-0 pl-2" style={{ color: "var(--muted)" }}>{fmtNum(f.count)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState icon="book" title="No topics yet" />
                  )}
                </SectionCard>
              </div>
            </div>
          )}
        </>
      )}

      {/* editor */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor?.id ? "Edit announcement" : "New announcement"}
        subtitle="Published notices appear on students' dashboards immediately."
        width="max-w-2xl"
        footer={
          <>
            <button type="button" className="admin-btn" onClick={() => setEditor(null)} disabled={editorBusy}>
              Cancel
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={saveEditor} disabled={editorBusy}>
              {editorBusy ? "Saving…" : editor?.id ? "Save changes" : "Create announcement"}
            </button>
          </>
        }
      >
        {editor && (
          <div className="space-y-3">
            <Field label="Title">
              <TextInput value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} placeholder="e.g. New full mock available" />
            </Field>
            <Field label="Body">
              <TextArea value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.target.value })} rows={5} placeholder="Write the notice students should see…" />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold">
              <input type="checkbox" className="admin-check" checked={editor.published} onChange={(e) => setEditor({ ...editor, published: e.target.checked })} />
              Publish immediately (visible to students)
            </label>
          </div>
        )}
      </Modal>

      {/* student preview */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Student preview"
        subtitle="How this notice renders on the dashboard."
        width="max-w-lg"
        footer={
          <button type="button" className="admin-btn admin-btn-primary" onClick={() => setPreview(null)}>
            Done
          </button>
        }
      >
        {preview && (
          <div className="rounded-2xl p-4" style={{ background: "var(--pill)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--accent)" }}>
                <Icon name="content" size={15} />
              </span>
              <span className="text-[10.5px] font-extrabold uppercase" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
                Notice · {fmtDateTime(preview.created_at)}
              </span>
              {!preview.published && <Badge tone="amber">Draft — students don&apos;t see this</Badge>}
            </div>
            <h3 className="mt-2 text-[15px] font-extrabold">{preview.title}</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6" style={{ color: "var(--muted)" }}>
              {preview.body}
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="Delete announcement?"
        tone="danger"
        confirmLabel="Delete announcement"
        busy={delBusy}
        message={<>“{confirmDel?.title}” will be permanently deleted. Unpublish instead if you may reuse it.</>}
        onCancel={() => setConfirmDel(null)}
        onConfirm={doDelete}
      />
    </AdminLayout>
  );
}
