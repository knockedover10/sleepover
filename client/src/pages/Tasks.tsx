import { useMemo, useState } from "react";
import {
  useTripData,
  getTraveler,
  formatDateShort,
  TASK_VIEW_TO_DB,
  type Task as ViewTask,
} from "@/lib/trip-data";
import { useUpsertTask, useToggleTask, useDeleteTask } from "@/lib/trip-queries";
import { PageContainer, Avatar } from "@/components/AppShell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Check, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Filter =
  | { kind: "all" }
  | { kind: "mine" }
  | { kind: "open" }
  | { kind: "person"; id: string };

const CAT_COLOR: Record<string, string> = {
  "Pre-trip": "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  Booking: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Packing: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "On-trip": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function Tasks() {
  const { tasks, travelers, me, trip } = useTripData();
  const tripId = trip?.id || null;
  const toggleMut = useToggleTask(tripId);
  const deleteMut = useDeleteTask(tripId);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [editTask, setEditTask] = useState<ViewTask | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter.kind === "all") return true;
      if (filter.kind === "open") return !t.done;
      if (filter.kind === "mine") return me ? t.assignees.includes(me.id) : false;
      if (filter.kind === "person") return t.assignees.includes(filter.id);
      return true;
    });
  }, [tasks, filter, me]);

  return (
    <PageContainer>
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
        <p className="text-xs text-muted-foreground">
          {tasks.filter((t) => !t.done).length} open · {tasks.filter((t) => t.done).length} done
        </p>
      </div>

      {/* Filter chips */}
      <div className="-mx-4 mb-3 overflow-x-auto scrollbar-hide px-4">
        <div className="flex w-max gap-1.5">
          {[
            { f: { kind: "all" } as Filter, label: "All" },
            { f: { kind: "mine" } as Filter, label: "Mine" },
            { f: { kind: "open" } as Filter, label: "Open only" },
          ].map((opt) => {
            const active = filter.kind === opt.f.kind;
            return (
              <button
                key={opt.label}
                onClick={() => setFilter(opt.f)}
                className={cn(
                  "ios-tap shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                )}
                data-testid={`chip-filter-${opt.label.toLowerCase().replace(" ", "-")}`}
              >
                {opt.label}
              </button>
            );
          })}
          <span className="my-1 w-px bg-border" />
          {travelers.map((t) => {
            const active = filter.kind === "person" && filter.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFilter({ kind: "person", id: t.id })}
                className={cn(
                  "ios-tap flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                )}
                data-testid={`chip-person-${t.id}`}
              >
                <Avatar {...t} size={18} />
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <ul className="space-y-2" data-testid="tasks-list">
        {filtered.length === 0 ? (
          <li className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No tasks match this filter.
          </li>
        ) : (
          filtered.map((task) => (
            <li
              key={task.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border bg-card p-3",
                task.done && "opacity-60"
              )}
              data-testid={`task-${task.id}`}
            >
              <button
                onClick={() => toggleMut.mutate({ id: task.id, is_done: !task.done })}
                aria-label={task.done ? "Mark not done" : "Mark done"}
                className={cn(
                  "ios-tap mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all",
                  task.done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                )}
                data-testid={`checkbox-${task.id}`}
              >
                {task.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      task.done && "line-through"
                    )}
                  >
                    {task.title}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      CAT_COLOR[task.category]
                    )}
                  >
                    {task.category}
                  </span>
                </div>
                {task.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {task.assignees.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">Unassigned</span>
                    ) : (
                      task.assignees.map((aid) => {
                        const a = getTraveler(travelers, aid);
                        if (!a) return null;
                        return <Avatar key={aid} {...a} size={20} ring />;
                      })
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {task.dueDate && (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Due {formatDateShort(task.dueDate)}
                      </span>
                    )}
                    <button
                      onClick={() => setEditTask(task)}
                      aria-label="Edit task"
                      className="ios-tap grid h-7 w-7 place-items-center rounded-full hover-elevate"
                      data-testid={`button-edit-${task.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete task?")) deleteMut.mutate(task.id);
                      }}
                      aria-label="Delete task"
                      className="ios-tap grid h-7 w-7 place-items-center rounded-full hover-elevate"
                      data-testid={`button-delete-${task.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>

      <button
        className="ios-tap fixed bottom-[72px] right-[max(1rem,calc(50%-13rem))] z-30 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
        aria-label="Add task"
        data-testid="button-add-task"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-5 w-5" />
      </button>

      {addOpen && (
        <TaskSheet
          mode="add"
          onClose={() => setAddOpen(false)}
        />
      )}
      {editTask && (
        <TaskSheet
          mode="edit"
          task={editTask}
          onClose={() => setEditTask(null)}
        />
      )}
    </PageContainer>
  );
}

function TaskSheet({
  mode,
  task,
  onClose,
}: {
  mode: "add" | "edit";
  task?: ViewTask;
  onClose: () => void;
}) {
  const { trip, travelers, me } = useTripData();
  const tripId = trip?.id || null;
  const upsert = useUpsertTask(tripId);
  const { toast } = useToast();
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [dueDate, setDueDate] = useState(task?.dueDate || "");
  const [category, setCategory] = useState<ViewTask["category"]>(
    task?.category || "Pre-trip"
  );
  const [assignees, setAssignees] = useState<string[]>(
    task?.assignees || (me ? [me.id] : [])
  );

  const toggle = (id: string) =>
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: task?.id,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        category: TASK_VIEW_TO_DB[category],
        assignees,
        is_done: task?.done || false,
        created_by_traveler_id: me?.id || null,
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t-0 max-w-md mx-auto max-h-[88vh] overflow-y-auto"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{mode === "add" ? "New task" : "Edit task"}</SheetTitle>
          <SheetDescription>
            {mode === "add" ? "Add a to-do for the trip." : "Update task details."}
          </SheetDescription>
        </SheetHeader>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ttitle">Title</Label>
            <Input
              id="ttitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book airport transfer"
              data-testid="input-task-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tdesc">Description</Label>
            <Textarea
              id="tdesc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              data-testid="input-task-description"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tdue">Due date</Label>
              <Input
                id="tdue"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="input-task-due"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tcat">Category</Label>
              <select
                id="tcat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ViewTask["category"])}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-task-category"
              >
                <option>Pre-trip</option>
                <option>Booking</option>
                <option>Packing</option>
                <option>On-trip</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assignees</Label>
            <div className="flex flex-wrap gap-1.5">
              {travelers.map((t) => {
                const on = assignees.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    className={cn(
                      "ios-tap flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm",
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground"
                    )}
                    data-testid={`button-assignee-${t.id}`}
                  >
                    <Avatar {...t} size={20} />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={upsert.isPending}
            data-testid="button-save-task"
          >
            {upsert.isPending ? "Saving..." : mode === "add" ? "Add task" : "Save changes"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
