import { statusBg, fmtTime, type AgendaAppt } from "./status";

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function WeekView({
  from,
  appts,
  onPickDay,
}: {
  from: Date;
  appts: AgendaAppt[];
  onPickDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const grouped = days.map((d) => {
    const next = addDays(d, 1);
    return {
      day: d,
      items: appts.filter((a) => {
        const t = new Date(a.scheduledAt);
        return t >= d && t < next;
      }),
    };
  });

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {grouped.map(({ day, items }) => {
        const isToday = day.toDateString() === new Date().toDateString();
        return (
          <button
            key={day.toISOString()}
            onClick={() => onPickDay(day)}
            className={`flex min-h-[100px] sm:min-h-[180px] flex-col rounded-2xl border bg-background p-3 text-left transition hover:border-primary ${
              isToday ? "border-primary" : "border-border"
            }`}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {day.toLocaleDateString("es-AR", { weekday: "short" })}
              </div>
              <div className="font-display text-xl">{day.getDate()}</div>
            </div>
            <div className="space-y-1.5">
              {items.length === 0 && (
                <div className="text-xs text-muted-foreground">Sin turnos</div>
              )}
              {items.slice(0, 4).map((a) => {
                const patientName = a.patient
                  ? `${a.patient.firstName} ${a.patient.lastName}`
                  : "Paciente";
                return (
                  <div
                    key={a.id}
                    className={`rounded-md px-2 py-1 text-xs ${statusBg(a.displayStatus ?? a.status)}`}
                  >
                    <div className="font-medium">{fmtTime(new Date(a.scheduledAt))}</div>
                    <div className="truncate text-muted-foreground">{patientName}</div>
                  </div>
                );
              })}
              {items.length > 4 && (
                <div className="text-xs text-primary">+{items.length - 4} más</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
