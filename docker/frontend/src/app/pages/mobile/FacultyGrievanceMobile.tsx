import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { decideFacultyGrievance, getFacultyGrievances, getFacultyGrievanceStats } from "@/app/services/evaluationService";
import type { FacultyGrievanceFilter, FacultyGrievanceItem, FacultyGrievanceStats } from "@/app/services/evaluationService";

const FILTERS: Array<{ key: FacultyGrievanceFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "my_section", label: "My Section" },
  { key: "other_section", label: "Other" },
];

const FacultyGrievanceMobile = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FacultyGrievanceFilter>("all");
  const [items, setItems] = useState<FacultyGrievanceItem[]>([]);
  const [stats, setStats] = useState<FacultyGrievanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const load = async (filter: FacultyGrievanceFilter) => {
    setLoading(true);
    try {
      const [list, statsData] = await Promise.all([getFacultyGrievances(filter), getFacultyGrievanceStats()]);
      setItems(Array.isArray(list) ? list : []);
      setStats(statsData || null);
    } catch (error) {
      console.error("Failed to load grievances:", error);
      toast.error("Failed to load grievances");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeFilter);
  }, [activeFilter]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.subject_code.localeCompare(b.subject_code)), [items]);

  const handleReject = async (item: FacultyGrievanceItem) => {
    setRejectingId(item.id);
    try {
      await decideFacultyGrievance(item.id, { status: "REJECTED" });
      toast.success(`Grievance #${item.id} rejected`);
      await load(activeFilter);
    } catch (error) {
      console.error("Reject failed:", error);
      toast.error(error instanceof Error ? error.message : "Reject failed");
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold">Grievance Management</h1>
          <p className="text-[11px] text-muted-foreground">Faculty mobile view</p>
        </div>
        <button onClick={() => navigate("/dashboard/faculty")} className="rounded-md border border-border px-3 py-1.5 text-xs">
          Back
        </button>
      </header>

      <main className="px-4 py-4 space-y-4 pb-24">
        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">To Resolve</p>
            <p className="text-lg font-bold text-destructive">{stats?.to_resolve_count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">Assigned</p>
            <p className="text-lg font-bold text-primary">{stats?.assigned_open_count ?? 0}</p>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`rounded-md px-2 py-2 text-xs ${activeFilter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              {f.label}
            </button>
          ))}
        </section>

        <section className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading grievances...</p>}
          {!loading && sortedItems.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No grievances found.</p>}

          {!loading &&
            sortedItems.map((item) => {
              const canShowCommentAndAction = item.assignment_status === "ASSIGNED_TO_YOU";
              return (
              <article key={item.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm">#{item.id}</p>
                  <span className="rounded-md bg-muted px-2 py-1 text-[10px]">{item.grievance_type_label || item.grievance_type}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.student_name} ({item.student_university_id})</p>
                <p className="font-mono text-xs text-primary">{item.subject_code} • Sec {item.section_name}</p>
                {canShowCommentAndAction ? (
                  <>
                    <p className="text-xs line-clamp-3">{item.student_comment}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => navigate(`/evaluation/${item.subject_code.toLowerCase()}?role=faculty&mode=grievance&roll=${item.student_university_id}&grievanceId=${item.id}`)}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                      >
                        Review
                      </button>
                      <button
                        disabled={rejectingId === item.id || !item.can_resolve}
                        onClick={() => handleReject(item)}
                        className="rounded-lg border border-destructive/50 px-3 py-2 text-xs text-destructive disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Comment and actions are hidden for unassigned grievances.</p>
                )}
              </article>
            );})}
        </section>
      </main>
    </div>
  );
};

export default FacultyGrievanceMobile;
