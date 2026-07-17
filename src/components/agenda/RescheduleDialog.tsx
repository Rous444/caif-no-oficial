import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { rescheduleAppointment } from "@/lib/api/appointments.functions";
import { toastError } from "@/lib/toastError";
import type { AgendaAppt } from "./status";

export function RescheduleDialog({
  open,
  onOpenChange,
  appt,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appt: AgendaAppt;
  onDone: () => void;
}) {
  const initial = new Date(appt.scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(initial.getDate())}T${pad(
    initial.getHours(),
  )}:${pad(initial.getMinutes())}`;
  const [value, setValue] = useState(local);
  const [duration, setDuration] = useState(appt.durationMinutes ?? 30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(local);
      setDuration(appt.durationMinutes ?? 30);
    }
  }, [open]);

  const submit = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await rescheduleAppointment({
        data: {
          appointmentId: appt.id,
          scheduledAt: new Date(value).toISOString(),
          durationMinutes: duration,
        },
      });
      toast.success("Turno reprogramado");
      onDone();
    } catch (err) {
      toastError(err, "Error al reprogramar el turno");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprogramar turno</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nueva fecha y hora</Label>
            <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <Label>Duración (minutos)</Label>
            <Input
              type="number"
              min={10}
              step={5}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
            />
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
            El sistema bloquea horarios superpuestos con otros turnos del profesional.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Guardando..." : "Confirmar cambio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
