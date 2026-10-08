import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, ClipboardList, ShieldCheck } from "lucide-react";
import { decideFacultyGrievance, getFacultyGrievances, getFacultyGrievanceStats } from "@/app/services/evaluationService";
import type { FacultyGrievanceFilter, FacultyGrievanceItem, FacultyGrievanceStats } from "@/app/services/evaluationService";

const FILTERS: Array<{ key: FacultyGrievanceFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "my_section", label: "My Section" },
  { key: "other_section", label: "Other Sections" },
];

const ASSIGNMENT_LABELS: Record<string, { text: string; className: string }> = {
  ASSIGNED_TO_YOU: {
    text: "Assigned to you",
    className: "bg-success/10 text-success",
  },
  ASSIGNED_TO_ANOTHER_FACULTY: {
    text: "Assigned to another faculty",
    className: "bg-warning/15 text-warning",
  },
  UNASSIGNED_AT_PRESENT: {
    text: "Unassigned",
    className: "bg-muted text-muted-foreground",
  },
};

const TYPE_LABELS: Record<string, { text: string; className: string }> = {
  PAGE_MISSING: {
    text: "Page Missing",
    className: "bg-warning/20 text-warning",
  },
  FULL_SHEET_MISSING: {
    text: "Full Sheet Missing",
    className: "bg-destructive/20 text-destructive",
  },
  GENERAL: {
    text: "General Grievance",
    className: "bg-primary/15 text-primary",
  },
};

const FacultyGrievancePage = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FacultyGrievanceFilter>("all");
  const [items, setItems] = useState<FacultyGrievanceItem[]>([]);
  const [stats, setStats] = useState<FacultyGrievanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const load = async (filter: FacultyGrievanceFilter) => {
    setLoading(true);
    try {
      const [data, statsData] = await Promise.all([getFacultyGrievances(filter), getFacultyGrievanceStats()]);
      setItems(Array.isArray(data) ? data : []);
      setStats(statsData || null);
    } catch (error) {
      console.error("Failed to load faculty grievances", error);
      toast.error("Failed to load grievances");
      setItems([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeFilter);
  }, [activeFilter]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.subject_code.localeCompare(b.subject_code) || a.student_university_id.localeCompare(b.student_university_id)), [items]);

  const handleReview = (item: FacultyGrievanceItem) => {
    navigate(`/evaluation/${item.subject_code.toLowerCase()}?role=faculty&mode=grievance&roll=${item.student_university_id}&grievanceId=${item.id}&paper_id=${item.paper_id}`);
  };

  const handleReject = async (item: FacultyGrievanceItem) => {
    setRejectingId(item.id);
    try {
      await decideFacultyGrievance(item.id, { status: "REJECTED" });
      toast.success(`Grievance #${item.id} rejected`);
      await load(activeFilter);
    } catch (error) {
      console.error("Failed to reject grievance", error);
      toast.error(error instanceof Error ? error.message : "Could not reject grievance");
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Faculty Grievance Management</h1>
          <p className="text-sm text-muted-foreground">Review and resolve submitted student grievances.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/dashboard/faculty")} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button type="button" onClick={() => load(activeFilter)} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <AlertCircle className="h-4 w-4" />
              To Resolve
            </div>
            <div className="mt-2 text-3xl font-bold text-destructive">{stats?.to_resolve_count ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <ShieldCheck className="h-4 w-4" />
              Assigned To You
            </div>
            <div className="mt-2 text-3xl font-bold text-primary">{stats?.assigned_open_count ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <CheckCircle2 className="h-4 w-4" />
              Resolved
            </div>
            <div className="mt-2 text-3xl font-bold text-success">{stats?.resolved_count ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <ClipboardList className="h-4 w-4" />
              Total Visible
            </div>
            <div className="mt-2 text-3xl font-bold text-foreground">{stats?.total_visible_count ?? 0}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Section-wise Grievance Load</h2>
          {!stats?.by_section || stats.by_section.length === 0 ? (
            <p className="text-sm text-muted-foreground">No grievance activity from your sections yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {stats.by_section.map((section) => (
                <div key={section.section_name} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Section {section.section_name}</span>
                    <span className="text-xs text-muted-foreground">Total {section.total}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded bg-warning/15 px-2 py-0.5 text-warning">Open {section.open}</span>
                    <span className="rounded bg-success/15 px-2 py-0.5 text-success">Resolved {section.resolved}</span>
                    <span className="rounded bg-destructive/15 px-2 py-0.5 text-destructive">Rejected {section.rejected}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`rounded-md px-3 py-2 text-sm border transition-colors ${
                activeFilter === filter.key ? "bg-primary/10 border-primary text-primary" : "bg-card border-border text-foreground hover:bg-muted/40"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Grievance</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Student</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Subject / Section</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Assignment</th>
                  <th className="px-4 py-3 text-left text-xs uppercase text-muted-foreground">Comment</th>
                  <th className="px-4 py-3 text-right text-xs uppercase text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      Loading grievances...
                    </td>
                  </tr>
                ) : sortedItems.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                      No open grievances in this filter.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((item) => {
                    const canShowCommentAndAction = item.assignment_status === "ASSIGNED_TO_YOU";
                    return (
                    <tr key={item.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">#{item.id}</div>
                        <div className="text-xs text-muted-foreground">Paper #{item.paper_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{item.student_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{item.student_university_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs">{item.subject_code}</div>
                        <div className="text-xs text-muted-foreground">{item.subject_title}</div>
                        <div className="text-xs text-muted-foreground">Section: {item.section_name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${TYPE_LABELS[item.grievance_type]?.className || "bg-muted text-muted-foreground"}`}>
                          {item.grievance_type_label || TYPE_LABELS[item.grievance_type]?.text || "General Grievance"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>Section faculty: {item.original_faculty_name || "-"}</div>
                        <div>Assigned faculty: {item.assigned_faculty_name || "Unassigned"}</div>
                        <div className="mt-1">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${
                              ASSIGNMENT_LABELS[item.assignment_status || "UNASSIGNED_AT_PRESENT"]?.className || "bg-muted text-muted-foreground"
                            }`}
                          >
                            {ASSIGNMENT_LABELS[item.assignment_status || "UNASSIGNED_AT_PRESENT"]?.text || "Unassigned at present"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[360px]">
                        {canShowCommentAndAction ? <p className="line-clamp-3 text-xs text-foreground/90">{item.student_comment}</p> : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canShowCommentAndAction ? (
                          <div className="inline-flex gap-2">
                            <button type="button" onClick={() => handleReview(item)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                              Review
                            </button>
                            <button
                              type="button"
                              disabled={rejectingId === item.id || !item.can_resolve}
                              onClick={() => handleReject(item)}
                              className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FacultyGrievancePage;
