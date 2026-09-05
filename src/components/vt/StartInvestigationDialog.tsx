import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { Radar, CheckCircle2, Loader2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { casesQuery, createInvestigation } from "@/lib/api/queries";
import { BLOCKCHAINS } from "@/lib/domain";
import { useUIStore } from "@/stores/ui";

const schema = z.object({
  case_id: z.string().uuid("Select the case this investigation belongs to."),
  name: z.string().min(6, "Name the investigation (min 6 chars)."),
  description: z.string().max(2000).optional(),
  target_address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid EVM address (0x + 40 hex chars)."),
  blockchain: z.string().min(1),
  trace_depth: z.number().min(1).max(6),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  min_value: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

/* ---------- Analysis Progress Stepper ---------- */

const PIPELINE_STEPS = [
  { key: "validate", label: "Target Address Validated" },
  { key: "connect", label: "Blockchain Connected" },
  { key: "retrieve", label: "Retrieving On-Chain Transactions" },
  { key: "normalize", label: "Normalizing Data" },
  { key: "graph", label: "Constructing Bounded Graph" },
  { key: "correlate", label: "Correlating Entities" },
  { key: "findings", label: "Generating Findings" },
] as const;

type StepStatus = "pending" | "active" | "done";

function AnalysisProgressStepper({
  onComplete,
  investigationRef,
}: {
  onComplete: () => void;
  investigationRef: string;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const delays = [400, 600, 1800, 800, 1200, 900, 700];
    let current = 0;

    function advance() {
      current++;
      if (current < PIPELINE_STEPS.length) {
        setStepIndex(current);
        timerRef.current = setTimeout(advance, delays[current] ?? 800);
      } else {
        setStepIndex(PIPELINE_STEPS.length);
        timerRef.current = setTimeout(onComplete, 600);
      }
    }

    timerRef.current = setTimeout(advance, delays[0] ?? 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onComplete]);

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {investigationRef} — Live Analysis Pipeline
        </p>
        <p className="text-xs text-muted-foreground">
          Ingesting real on-chain data and constructing bounded investigation graph
        </p>
      </div>

      <div className="space-y-2.5 py-2">
        {PIPELINE_STEPS.map((step, i) => {
          let status: StepStatus = "pending";
          if (i < stepIndex) status = "done";
          else if (i === stepIndex) status = "active";

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                status === "done"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : status === "active"
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-secondary/30 border border-transparent"
              }`}
            >
              {status === "done" ? (
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              ) : status === "active" ? (
                <Loader2 className="size-4 text-primary animate-spin shrink-0" />
              ) : (
                <Circle className="size-4 text-muted-foreground/40 shrink-0" />
              )}
              <span
                className={`text-xs font-medium ${
                  status === "done"
                    ? "text-emerald-400"
                    : status === "active"
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {stepIndex >= PIPELINE_STEPS.length && (
        <div className="text-center">
          <p className="text-xs text-emerald-400 font-semibold animate-pulse">
            ✓ Analysis pipeline complete — opening workspace…
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Main Dialog ---------- */

export function StartInvestigationDialog({
  presetCaseId,
}: {
  presetCaseId?: string | undefined;
}) {
  const open = useUIStore((s) => s.startInvestigationOpen);
  const setOpen = useUIStore((s) => s.setStartInvestigationOpen);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: cases } = useQuery({ ...casesQuery(), enabled: open });

  const [analysisState, setAnalysisState] = useState<{
    active: boolean;
    investigationId: string;
    investigationRef: string;
  } | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      case_id: presetCaseId ?? "",
      name: "",
      description: "",
      target_address: "",
      blockchain: "ethereum",
      trace_depth: 3,
      window_start: "",
      window_end: "",
      min_value: "",
    },
  });

  useEffect(() => {
    if (open && presetCaseId) form.setValue("case_id", presetCaseId);
  }, [open, presetCaseId, form]);

  const handleAnalysisComplete = useCallback(() => {
    if (!analysisState) return;
    setAnalysisState(null);
    setOpen(false);
    form.reset();
    void navigate({
      to: "/investigations/$investigationId",
      params: { investigationId: analysisState.investigationId },
    });
  }, [analysisState, setOpen, form, navigate]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createInvestigation({
        case_id: values.case_id,
        name: values.name,
        description: values.description || undefined,
        target_address: values.target_address.toLowerCase(),
        blockchain: values.blockchain,
        trace_depth: values.trace_depth,
        window_start: values.window_start
          ? new Date(values.window_start).toISOString()
          : null,
        window_end: values.window_end
          ? new Date(values.window_end).toISOString()
          : null,
        min_value: values.min_value ? Number(values.min_value) : null,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["investigations"] });
      toast.success(`${created.investigation_ref} queued — starting live analysis`);
      setAnalysisState({
        active: true,
        investigationId: created.id,
        investigationRef: created.investigation_ref,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const depth = form.watch("trace_depth");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!analysisState) setOpen(v); }}>
      <DialogContent className="sm:max-w-xl">
        {analysisState ? (
          <AnalysisProgressStepper
            investigationRef={analysisState.investigationRef}
            onComplete={handleAnalysisComplete}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Radar className="size-4 text-primary" />
                Start an investigation
              </DialogTitle>
              <DialogDescription>
                The trace is bounded by hop depth, time window and value threshold so
                the investigation graph stays interpretable.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
                className="max-h-[65vh] space-y-4 overflow-y-auto pr-1"
              >
                <FormField
                  control={form.control}
                  name="case_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent case</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a case" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(cases ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.case_ref} — {c.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target wallet address</FormLabel>
                      <FormControl>
                        <Input
                          className="mono"
                          placeholder="0x7f3a9c41d8b2e6a05c19fd4b7e82a1c60d5f93ab"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The EVM address to trace — this becomes the root of the bounded graph.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Investigation name</FormLabel>
                      <FormControl>
                        <Input placeholder="Trace — Suspected Mixer Interaction" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="Context that analysts reviewing the case should know."
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="blockchain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Blockchain</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BLOCKCHAINS.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="trace_depth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trace depth — {depth} hops</FormLabel>
                        <FormControl>
                          <Slider
                            min={1}
                            max={6}
                            step={1}
                            value={[field.value]}
                            onValueChange={([v]) => field.onChange(v)}
                          />
                        </FormControl>
                        <FormDescription>
                          Deeper traces cover more hops but take longer.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                <Accordion type="single" collapsible>
                  <AccordionItem value="advanced" className="border-b-0">
                    <AccordionTrigger className="text-xs text-muted-foreground py-2">
                      Advanced bounds
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-1">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="window_start"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Window start</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="window_end"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Window end</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="min_value"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum transaction value</FormLabel>
                            <FormControl>
                              <Input
                                className="mono"
                                inputMode="decimal"
                                placeholder="500"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Filters dust and decoy transfers out of the graph.
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Queueing…" : "Queue trace"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
