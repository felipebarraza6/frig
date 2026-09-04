/**
 * Colores de estado centralizados.
 *
 * Antes: cada página declaraba mapas inline con clases hardcodeadas
 * (`bg-emerald-500/10 text-emerald-700`, `bg-rose-500/10 text-rose-700`, etc.),
 * que ignoraban los tokens semánticos del tema y tenían contraste pobre en
 * modo oscuro.
 *
 * Ahora: una sola fuente de verdad que mapea un estado (string) a un par
 * de clases Tailwind usando los tokens `--color-success / --color-warning /
 * --color-danger / --color-muted`. Si un estado no se reconoce, cae al
 * estilo neutro.
 */

export const statusBadge = (status?: string | null): string => {
  const key = (status ?? "").toUpperCase();
  switch (key) {
    case "FREE":
    case "AVAILABLE":
    case "ACTIVE":
    case "PAID":
    case "COMPLETED":
    case "DELIVERED":
    case "DONE":
    case "OPEN":
      return "bg-success/10 text-success border-success/20";

    case "OCCUPIED":
    case "INACTIVE":
    case "CANCELLED":
    case "DELETED":
    case "EXPIRED":
    case "FAILED":
    case "OVERDUE":
    case "REFUNDED":
    case "RETURNED":
    case "CLOSED":
      return "bg-danger/10 text-danger border-danger/20";

    case "RESERVED":
    case "CLEANING":
    case "PENDING":
    case "PREPARING":
    case "PARTIAL":
    case "IN_PROGRESS":
    case "INVOICED":
    case "DRAFT":
    case "MAINTENANCE":
    case "LOW_STOCK":
      return "bg-warning/10 text-warning border-warning/20";

    case "OUT_OF_SERVICE":
      return "bg-muted/30 text-muted-foreground border-border";

    default:
      return "bg-muted/30 text-muted-foreground border-border";
  }
};

/**
 * Variante "sólida" para chips de filtro o KPIs pequeños
 * donde se quiere más peso visual.
 */
export const statusChip = (status?: string | null): string => {
  const key = (status ?? "").toUpperCase();
  switch (key) {
    case "FREE":
    case "AVAILABLE":
    case "ACTIVE":
    case "PAID":
    case "COMPLETED":
    case "DELIVERED":
    case "DONE":
    case "OPEN":
      return "bg-success text-success-foreground";
    case "OCCUPIED":
    case "INACTIVE":
    case "CANCELLED":
    case "DELETED":
    case "EXPIRED":
    case "FAILED":
    case "OVERDUE":
    case "REFUNDED":
    case "RETURNED":
    case "CLOSED":
      return "bg-danger text-white";
    case "RESERVED":
    case "CLEANING":
    case "PENDING":
    case "PREPARING":
    case "PARTIAL":
    case "IN_PROGRESS":
    case "INVOICED":
    case "DRAFT":
    case "MAINTENANCE":
    case "LOW_STOCK":
      return "bg-warning text-white";
    case "OUT_OF_SERVICE":
    default:
      return "bg-muted text-muted-foreground";
  }
};

/**
 * Punto de color pequeño para columnas/listas.
 */
export const statusDot = (status?: string | null): string => {
  const key = (status ?? "").toUpperCase();
  switch (key) {
    case "FREE":
    case "AVAILABLE":
    case "ACTIVE":
    case "PAID":
    case "COMPLETED":
    case "DELIVERED":
    case "DONE":
    case "OPEN":
      return "bg-success";
    case "OCCUPIED":
    case "INACTIVE":
    case "CANCELLED":
    case "DELETED":
    case "EXPIRED":
    case "FAILED":
    case "OVERDUE":
    case "REFUNDED":
    case "RETURNED":
    case "CLOSED":
      return "bg-danger";
    case "RESERVED":
    case "CLEANING":
    case "PENDING":
    case "PREPARING":
    case "PARTIAL":
    case "IN_PROGRESS":
    case "INVOICED":
    case "DRAFT":
    case "MAINTENANCE":
    case "LOW_STOCK":
      return "bg-warning";
    default:
      return "bg-muted-foreground/40";
  }
};
