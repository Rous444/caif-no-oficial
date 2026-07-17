import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApptCard } from "./ApptCard";
import { statusBg, statusBorder, fmtDate, fmtTime, type AgendaAppt } from "./status";
import {
  GRID_END_MIN,
  GRID_START_MIN,
  GRID_TOTAL_MIN,
  assignLanes,
  blockPosition,
  minutesSinceMidnight,
  nowLineOffsetMin,
} from "./gridLayout";
import { useNow } from "@/lib/useNow";

const PX_PER_MIN = 1.3;
const HOURS = Array.from(
  { length: GRID_END_MIN / 60 - GRID_START_MIN / 60 + 1 },
  (_, i) => GRID_START_MIN / 60 + i,
);

function patientName(appt: AgendaAppt) {
  return appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : "Paciente";
}

type Column = { key: string; label: string; appts: AgendaAppt[] };

export function DayGrid({
  date,
  appts,
  variant,
  onUpdateStatus,
  onChanged,
  pendingIds,
}: {
  date: Date;
  appts: AgendaAppt[];
  variant: "staff" | "doctor";
  onUpdateStatus: (id: string, status: AgendaAppt["status"]) => void;
  onChanged: () => void;
  pendingIds: Set<string>;
}) {
  const [patientSearch, setPatientSearch] = useState("");
  const [historyPatient, setHistoryPatient] = useState<AgendaAppt["patient"] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const now = useNow(30_000);

  const filtered =
    variant === "doctor" && patientSearch.trim()
      ? appts.filter((a) => patientName(a).toLowerCase().includes(patientSearch.toLowerCase()))
      : appts;

  const patientAppointments = historyPatient
    ? appts.filter((a) => a.patient?.id === historyPatient.id)
    : [];

  const columns: Column[] = useMemo(() => {
    if (variant === "doctor") {
      return [{ key: "self", label: "", appts: filtered }];
    }
    const byDoctor = new Map<string, Column>();
    for (const a of filtered) {
      const key = a.doctor?.id ?? "sin-profesional";
      const label = a.doctor?.user
        ? `${a.doctor.user.firstName} ${a.doctor.user.lastName}`
        : (a.doctor?.user?.name ?? "Sin profesional");
      if (!byDoctor.has(key)) byDoctor.set(key, { key, label, appts: [] });
      byDoctor.get(key)!.appts.push(a);
    }
    return Array.from(byDoctor.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [filtered, variant]);

  const [activeColumnKey, setActiveColumnKey] = useState<string | null>(null);
  useEffect(() => {
    if (columns.length > 0 && !columns.some((c) => c.key === activeColumnKey)) {
      setActiveColumnKey(columns[0].key);
    }
  }, [columns, activeColumnKey]);

  const showSelector = variant === "staff" && columns.length > 1;

  if (appts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
        No hay turnos para este día.
      </div>
    );
  }

  return (
    <>
      {variant === "doctor" && (
        <div className="relative mb-4 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar paciente..."
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
          />
        </div>
      )}

      {showSelector && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden lg:hidden">
          {columns.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => setActiveColumnKey(col.key)}
              className={`min-h-[36px] shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                col.key === activeColumnKey
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {col.label}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center text-muted-foreground">
          No se encontraron turnos para "{patientSearch}".
        </div>
      ) : (
        <div className="flex overflow-x-auto rounded-2xl border border-border bg-background">
          <div className="w-12 shrink-0 border-r border-border sm:w-14">
            <div className="h-9 border-b border-border" />
            <div className="relative" style={{ height: GRID_TOTAL_MIN * PX_PER_MIN }}>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-1/2 text-right text-[10px] text-muted-foreground sm:text-[11px]"
                  style={{ top: (h * 60 - GRID_START_MIN) * PX_PER_MIN }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div
              key={col.key}
              className={`border-r border-border last:border-r-0 ${
                showSelector
                  ? `min-w-[200px] flex-1 ${col.key === activeColumnKey ? "" : "hidden lg:block"}`
                  : "w-full flex-1"
              }`}
            >
              {variant === "staff" && columns.length > 1 && (
                <div
                  className="flex h-9 items-center justify-center truncate border-b border-border px-2 text-xs font-medium"
                  title={col.label}
                >
                  {col.label}
                </div>
              )}
              {variant === "staff" && columns.length === 1 && (
                <div className="h-9 border-b border-border" />
              )}
              <GridColumn
                column={col}
                date={date}
                now={now}
                variant={variant}
                onUpdateStatus={onUpdateStatus}
                onChanged={onChanged}
                pendingIds={pendingIds}
                onShowHistory={variant === "doctor" ? (p) => setHistoryPatient(p) : undefined}
                openId={openId}
                setOpenId={setOpenId}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!historyPatient}
        onOpenChange={(v) => {
          if (!v) setHistoryPatient(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Historial de {historyPatient?.firstName} {historyPatient?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {patientAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Solo tiene este turno.</p>
            ) : (
              patientAppointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{fmtDate(new Date(a.scheduledAt))}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtTime(new Date(a.scheduledAt))} · {a.durationMinutes ?? 30} min ·{" "}
                      {a.specialty?.name}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBg(a.displayStatus ?? a.status)}`}
                  >
                    {a.displayStatus ?? a.status}
                  </span>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryPatient(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GridColumn({
  column,
  date,
  now,
  variant,
  onUpdateStatus,
  onChanged,
  pendingIds,
  onShowHistory,
  openId,
  setOpenId,
}: {
  column: Column;
  date: Date;
  now: Date;
  variant: "staff" | "doctor";
  onUpdateStatus: (id: string, status: AgendaAppt["status"]) => void;
  onChanged: () => void;
  pendingIds: Set<string>;
  onShowHistory?: (patient: AgendaAppt["patient"]) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const laned = useMemo(
    () =>
      assignLanes(
        column.appts,
        (a) => minutesSinceMidnight(new Date(a.scheduledAt)),
        (a) => minutesSinceMidnight(new Date(a.scheduledAt)) + (a.durationMinutes ?? 30),
      ),
    [column.appts],
  );
  const nowOffset = nowLineOffsetMin(now, date);

  return (
    <div className="relative" style={{ height: GRID_TOTAL_MIN * PX_PER_MIN }}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-border/60"
          style={{ top: (h * 60 - GRID_START_MIN) * PX_PER_MIN }}
        />
      ))}

      {nowOffset != null && (
        <div
          className="absolute inset-x-0 z-20 border-t-2 border-destructive"
          style={{ top: nowOffset * PX_PER_MIN }}
        >
          <span className="absolute -left-0.5 -top-1 h-2 w-2 rounded-full bg-destructive" />
        </div>
      )}

      {laned.map(({ item: a, lane, lanes }) => {
        const { topMin, heightMin } = blockPosition(
          new Date(a.scheduledAt),
          a.durationMinutes ?? 30,
        );
        const widthPct = 100 / lanes;
        const pxHeight = Math.max(heightMin * PX_PER_MIN - 2, 20);
        const status = a.displayStatus ?? a.status;
        return (
          <Popover
            key={a.id}
            open={openId === a.id}
            onOpenChange={(v) => setOpenId(v ? a.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${fmtTime(new Date(a.scheduledAt))} · ${patientName(a)} · ${status}`}
                className={`absolute overflow-hidden rounded-md border border-l-4 border-border bg-background px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:z-30 hover:shadow-md focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${statusBorder(status)} ${
                  pendingIds.has(a.id) ? "opacity-60" : ""
                }`}
                style={{
                  top: topMin * PX_PER_MIN,
                  height: pxHeight,
                  left: `calc(${lane * widthPct}% + 2px)`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              >
                <div className="truncate font-medium text-foreground">
                  {fmtTime(new Date(a.scheduledAt))} · {patientName(a)}
                </div>
                {pxHeight > 32 && (
                  <div className="truncate capitalize text-muted-foreground">{status}</div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[22rem] max-w-[92vw] border-0 bg-transparent p-0 shadow-none"
              align="start"
            >
              <ApptCard
                appt={a}
                variant={variant}
                onUpdateStatus={onUpdateStatus}
                onChanged={() => {
                  onChanged();
                  setOpenId(null);
                }}
                onShowHistory={onShowHistory}
                pending={pendingIds.has(a.id)}
              />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
