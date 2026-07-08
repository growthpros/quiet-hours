import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import { COMPASSION_PROMPTS } from "@/lib/quiet-hours-data";
import type { CompassionEntry } from "@shared/schema";

function NewEntryDialog() {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [firstThought, setFirstThought] = useState("");
  const [before, setBefore] = useState(5);
  const [reframe, setReframe] = useState("");
  const [after, setAfter] = useState(5);
  const [outcome, setOutcome] = useState("");

  // deterministic-ish rotating placeholder chosen once per open
  const [promptIdx] = useState(() =>
    Math.floor(Math.random() * COMPASSION_PROMPTS.length),
  );

  const create = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/compassion", {
        trigger,
        firstThought,
        intensityBefore: before,
        reframe,
        intensityAfter: after,
        outcome: outcome || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compassion"] });
      setOpen(false);
      setTrigger("");
      setFirstThought("");
      setBefore(5);
      setReframe("");
      setAfter(5);
      setOutcome("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-entry">
          <Plus className="mr-1 h-4 w-4" /> New entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">A moment, held gently</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-trigger">What happened?</Label>
            <Input
              id="c-trigger"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="The moment that landed hard."
              data-testid="input-trigger"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-thought">First thought</Label>
            <Textarea
              id="c-thought"
              value={firstThought}
              onChange={(e) => setFirstThought(e.target.value)}
              placeholder={COMPASSION_PROMPTS[promptIdx]}
              className="font-serif italic placeholder:italic"
              data-testid="input-first-thought"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Intensity before</Label>
              <span className="font-serif text-lg font-semibold text-foreground">
                {before}
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[before]}
              onValueChange={(v) => setBefore(v[0])}
              data-testid="slider-before"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-reframe">A kinder, truer line</Label>
            <Textarea
              id="c-reframe"
              value={reframe}
              onChange={(e) => setReframe(e.target.value)}
              placeholder="Say it the way you'd say it to a friend."
              className="font-serif italic placeholder:italic"
              data-testid="input-reframe"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Intensity after</Label>
              <span className="font-serif text-lg font-semibold text-foreground">
                {after}
              </span>
            </div>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[after]}
              onValueChange={(v) => setAfter(v[0])}
              data-testid="slider-after"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-outcome">What happened next (optional)</Label>
            <Textarea
              id="c-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Optional — how it actually turned out."
              data-testid="input-outcome"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={
              !trigger.trim() ||
              !firstThought.trim() ||
              !reframe.trim() ||
              create.isPending
            }
            data-testid="button-save-entry"
          >
            Save entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="font-serif text-xl font-semibold text-foreground">
          {value}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default function Compassion() {
  const { data, isLoading } = useQuery<CompassionEntry[]>({
    queryKey: ["/api/compassion"],
  });

  const del = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/compassion/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/compassion"] }),
  });

  const entries = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.createdAt - b.createdAt),
    [data],
  );

  const stats = useMemo(() => {
    if (entries.length === 0)
      return { count: 0, avgDrop: "—", pctReduced: "—" };
    const drops = entries.map((e) => e.intensityBefore - e.intensityAfter);
    const avgDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
    const reduced = entries.filter(
      (e) => e.intensityAfter < e.intensityBefore,
    ).length;
    return {
      count: entries.length,
      avgDrop: avgDrop.toFixed(1),
      pctReduced: `${Math.round((reduced / entries.length) * 100)}%`,
    };
  }, [entries]);

  const chartData = entries.map((e, i) => ({
    name: `#${i + 1}`,
    before: e.intensityBefore,
    after: e.intensityAfter,
  }));

  const displayEntries = [...entries].reverse();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Compassion"
        subtitle="A log for the moments that hit hard — and the kinder line you found afterward."
      >
        <NewEntryDialog />
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card className="bg-card">
          <CardContent className="p-10 text-center">
            <p className="font-serif text-lg italic text-muted-foreground">
              Nothing logged yet. When something lands hard, come back.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Entries logged" value={String(stats.count)} />
            <StatCard label="Avg intensity drop" value={stats.avgDrop} />
            <StatCard
              label="Reframing helped"
              value={stats.pctReduced}
            />
          </div>

          {entries.length >= 2 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Intensity, before and after
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        domain={[0, 10]}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          fontSize: "0.8rem",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
                      <Line
                        type="monotone"
                        dataKey="before"
                        name="Before"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="after"
                        name="After"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {displayEntries.map((entry) => (
              <Card key={entry.id} data-testid={`card-entry-${entry.id}`}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-foreground">
                        {entry.trigger}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.firstThought}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <span className="font-serif font-semibold text-foreground">
                          {entry.intensityBefore}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span className="font-serif font-semibold text-primary">
                          {entry.intensityAfter}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => del.mutate(entry.id)}
                        data-testid={`button-delete-entry-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="border-l-2 border-accent pl-4 font-serif italic text-muted-foreground">
                    {entry.reframe}
                  </p>
                  {entry.outcome && (
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground">Then: </span>
                      {entry.outcome}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
