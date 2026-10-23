/**
 * "Abierta hoy a las HH:MM" solo si la caja es del día; si es de otro día
 * muestra la fecha ("Abierta el 15-09-2026 a las HH:MM") para no confundir.
 */
export function openedLabel(
  registerDate: string | null | undefined,
  created: string,
  today: string,
): string {
  const time = new Date(created).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!registerDate || registerDate === today) return `Abierta hoy a las ${time}`;
  const [y, m, d] = registerDate.split("-");
  return `Abierta el ${d}-${m}-${y} a las ${time} (día anterior)`;
}

/**
 * Fecha de caja ("YYYY-MM-DD", sin hora) como "DD-MM-YYYY". No pasa por
 * `new Date()`: esa cadena se interpreta en UTC y en Chile muestra un día menos.
 */
export function formatRegisterDate(registerDate: string): string {
  const [y, m, d] = registerDate.slice(0, 10).split("-");
  if (!y || !m || !d) return registerDate;
  return `${d}-${m}-${y}`;
}
