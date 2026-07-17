import { useState } from "react";
import { Clock, User, Stethoscope, Building2, History, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RescheduleDialog } from "./RescheduleDialog";
import { statusBg, fmtTime, type AgendaAppt } from "./status";

export function ApptCard({
  appt,
  variant,
  onUpdateStatus,
  onChanged,
  onShowHistory,
  pending,
}: {
  appt: AgendaAppt;
  variant: "staff" | "doctor";
  onUpdateStatus: (id: string, status: AgendaAppt["status"]) => void;
  onChanged: () => void;
  onShowHistory?: (patient: AgendaAppt["patient"]) => void;
  pending: boolean;
}) {
  const date = new Date(appt.scheduledAt);
  const isPast = date.getTime() < Date.now();
  const [reschedOpen, setReschedOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const patientName = appt.patient
    ? `${appt.patient.firstName} ${appt.patient.lastName}`
    : "Paciente";
  const docName = appt.doctor?.user
    ? `${appt.doctor.user.firstName} ${appt.doctor.user.lastName}`
    : (appt.doctor?.user?.name ?? "Profesional");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg text-foreground">
            {fmtTime(date)} · {appt.durationMinutes ?? 30} min
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="inline-flex items-center gap-1 text-foreground">
              <User className="h-3.5 w-3.5" /> {patientName}
            </span>
            {appt.patient?.phone && (
              <span className="text-muted-foreground">· {appt.patient.phone}</span>
            )}
            {appt.patient?.email && (
              <span className="text-muted-foreground">· {appt.patient.email}</span>
            )}
          </div>
          {variant === "staff" ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="h-3 w-3" /> {docName}
              </span>
              <span>· {appt.doctor?.specialty?.name ?? appt.specialty?.name}</span>
              {appt.doctor?.insuranceCompanies && appt.doctor.insuranceCompanies.length > 0 && (
                <span>
                  · <Building2 className="mr-0.5 inline h-3 w-3" />
                  {appt.doctor.insuranceCompanies.join(", ")}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="h-3 w-3" /> {appt.specialty?.name}
              </span>
            </div>
          )}
          {appt.notes && <div className="mt-2 text-sm text-muted-foreground">"{appt.notes}"</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {variant === "doctor" && appt.patient && onShowHistory && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onShowHistory(appt.patient)}
            className="min-h-[44px]"
          >
            <History className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Historial</span>
          </Button>
        )}
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusBg(appt.displayStatus ?? appt.status)}`}
        >
          {appt.displayStatus ?? appt.status}
        </span>
        {appt.status === "pendiente" && (
          <Button
            size="sm"
            onClick={() => onUpdateStatus(appt.id, "confirmado")}
            disabled={pending}
            className="min-h-[44px]"
          >
            {variant === "doctor" ? (
              <>
                <Check className="h-4 w-4" />{" "}
                <span className="ml-1 hidden sm:inline">Confirmar</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Confirmar</span>
                <span className="sm:hidden">Conf.</span>
              </>
            )}
          </Button>
        )}
        {(appt.status === "pendiente" || appt.status === "confirmado") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReschedOpen(true)}
            disabled={pending}
            className="min-h-[44px]"
          >
            <span className="hidden sm:inline">Reprogramar</span>
            <span className="sm:hidden">Reprog.</span>
          </Button>
        )}
        {variant === "doctor" && appt.status === "confirmado" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(appt.id, "ausente")}
            disabled={pending}
            className="min-h-[44px]"
          >
            <span className="hidden sm:inline">Marcar ausente</span>
            <span className="sm:hidden">Ausente</span>
          </Button>
        )}
        {(appt.status === "pendiente" || appt.status === "confirmado") && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmCancelOpen(true)}
            disabled={pending}
            className="min-h-[44px]"
          >
            {variant === "doctor" ? (
              <>
                <X className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">Cancelar</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Cancelar</span>
                <span className="sm:hidden">Canc.</span>
              </>
            )}
          </Button>
        )}
        {appt.status === "cancelado" && !isPast && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(appt.id, "pendiente")}
            disabled={pending}
            className="min-h-[44px]"
          >
            <span className="hidden sm:inline">Reactivar</span>
            <span className="sm:hidden">React.</span>
          </Button>
        )}
      </div>

      <RescheduleDialog
        open={reschedOpen}
        onOpenChange={setReschedOpen}
        appt={appt}
        onDone={() => {
          setReschedOpen(false);
          onChanged();
        }}
      />

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
            <AlertDialogDescription>
              {fmtTime(date)} · {patientName}
              {variant === "staff" ? ` con ${docName}` : ""}. El turno queda cancelado y el horario
              vuelve a estar disponible. Se puede reactivar después, pero solo si nadie más lo
              reservó mientras tanto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onUpdateStatus(appt.id, "cancelado")}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar turno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
