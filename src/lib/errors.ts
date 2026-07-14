// Errores tipados compartidos por las server functions (Plan 03).
// El código viaja en `.code`, pero lo que cruza confiablemente al cliente
// a través del RPC de TanStack Start es `.message` — por eso cada mensaje
// ya es el texto final a mostrar al usuario.
export class AppError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export class SlotTakenError extends AppError {
  constructor(message = "Ese horario ya no está disponible para este profesional") {
    super("SLOT_TAKEN", message);
  }
}

export class StaleStateError extends AppError {
  constructor(
    message = "Este turno cambió de estado en otra pantalla mientras tanto. Recargá para ver el estado actual.",
  ) {
    super("STALE_STATE", message);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string) {
    super("INVALID_TRANSITION", message);
  }
}
