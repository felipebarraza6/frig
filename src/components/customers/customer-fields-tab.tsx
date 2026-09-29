"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, Save, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QuotationCreateModal } from "@/components/sales/quotation-create-modal";
import {
  fetchExtraFieldDefinitions,
  fetchExtraFieldGroups,
  fetchExtraFieldValuesForClient,
  formatFichaNotesForQuotation,
  parseFieldOptions,
  upsertExtraFieldValue,
  type ExtraFieldDefinition,
} from "@/lib/api/customer-fields";
import { useToast } from "@/lib/store/toast";

function valueToInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseInput(def: ExtraFieldDefinition, raw: string): unknown {
  const t = def.field_type ?? "TEXT";
  if (t === "BOOLEAN") return raw === "true" || raw === "1" || raw === "sí" || raw === "si";
  if (t === "NUMBER" || t === "INTEGER" || t === "DECIMAL") {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}

export function CustomerFieldsTab({
  clientId,
  clientName,
  groupId,
}: {
  clientId: number;
  clientName?: string | null;
  /** Una ficha (grupo). Sin esto se muestran todas. */
  groupId?: string | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteNotes, setQuoteNotes] = useState("");

  const groupsQuery = useQuery({
    queryKey: ["customers", "extra-field-groups"],
    queryFn: fetchExtraFieldGroups,
  });
  const defsQuery = useQuery({
    queryKey: ["customers", "extra-field-definitions"],
    queryFn: () => fetchExtraFieldDefinitions(),
  });
  const valuesQuery = useQuery({
    queryKey: ["customers", "extra-field-values", clientId],
    queryFn: () => fetchExtraFieldValuesForClient(clientId),
  });

  const groups = groupsQuery.data ?? [];
  const allDefs = defsQuery.data ?? [];
  const defs =
    groupId === "__loose"
      ? allDefs.filter(
          (d) => !d.group || !groups.some((g) => g.id === String(d.group)),
        )
      : groupId
        ? allDefs.filter((d) => String(d.group) === groupId)
        : allDefs;
  const values = valuesQuery.data ?? [];

  const valueByDef = useMemo(() => {
    const map = new Map<string, { id: string; value: unknown }>();
    for (const v of values) {
      map.set(String(v.field_definition), { id: v.id, value: v.value });
    }
    return map;
  }, [values]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const d of defs) {
      const existing = valueByDef.get(d.id);
      next[d.id] = existing ? valueToInput(existing.value) : "";
    }
    setDraft(next);
  }, [defs, valueByDef]);

  const save = useMutation({
    mutationFn: async () => {
      const jobs: Promise<unknown>[] = [];
      for (const d of defs) {
        const raw = draft[d.id] ?? "";
        const existing = valueByDef.get(d.id);
        const nextVal = parseInput(d, raw);
        const prev = existing ? valueToInput(existing.value) : "";
        if (raw === prev) continue;
        if (!raw && !existing) continue;
        jobs.push(
          upsertExtraFieldValue({
            clientId,
            fieldDefinitionId: d.id,
            value: nextVal,
            existingId: existing?.id,
          }),
        );
      }
      if (jobs.length === 0) return 0;
      await Promise.all(jobs);
      return jobs.length;
    },
    onSuccess: (n) => {
      queryClient.invalidateQueries({
        queryKey: ["customers", "extra-field-values", clientId],
      });
      toast.success(n === 0 ? "Sin cambios" : "Ficha guardada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const loading = groupsQuery.isLoading || defsQuery.isLoading || valuesQuery.isLoading;

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (defs.length === 0) {
    const groupName = groups.find((g) => g.id === groupId)?.name;
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <FileText className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-medium">
          {groupName ? `${groupName} no tiene campos` : "Sin campos de ficha"}
        </p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Cada grupo de Fichas es una ficha distinta de este cliente. Los campos
          se arman allá y se llenan acá.
        </p>
        <Link
          href="/customers/forms"
          className="mt-3 text-sm text-primary hover:underline"
        >
          Ir a Fichas
        </Link>
      </div>
    );
  }

  const grouped = (
    groups.length
      ? groups.map((g) => ({
          id: g.id,
          name: g.name,
          fields: defs.filter((d) => String(d.group) === String(g.id)),
        }))
      : [{ id: "_", name: "Campos", fields: defs }]
  ).filter((section) => section.fields.length > 0);

  const loose = defs.filter(
    (d) => !grouped.some((section) => section.fields.some((field) => field.id === d.id)),
  );
  if (loose.length > 0) {
    grouped.push({ id: "_loose", name: "Sin grupo", fields: loose });
  }

  function openQuote() {
    const rows: Array<{ groupName: string; fieldName: string; value: unknown }> =
      [];
    for (const section of grouped) {
      for (const d of section.fields) {
        const raw = draft[d.id] ?? "";
        if (!raw.trim()) continue;
        rows.push({
          groupName: section.name,
          fieldName: d.name,
          value: parseInput(d, raw),
        });
      }
    }
    const notes = formatFichaNotesForQuotation(rows);
    if (!notes) {
      toast.error("Completá al menos un campo de la ficha para cotizar.");
      return;
    }
    setQuoteNotes(notes);
    setQuoteOpen(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Campos de esta ficha.</p>
      {grouped.map((section) =>
        section.fields.length === 0 ? null : (
          <section key={section.id} className="glass space-y-3 rounded-2xl p-4 sm:p-5">
            <h3 className="text-sm font-semibold">{section.name}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {section.fields.map((d) => (
              <FieldEditor
                key={d.id}
                def={d}
                value={draft[d.id] ?? ""}
                onChange={(v) => setDraft((prev) => ({ ...prev, [d.id]: v }))}
              />
            ))}
            </div>
          </section>
        ),
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => save.mutate()}
          isLoading={save.isPending}
          className="w-full sm:w-auto"
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Guardar ficha
        </Button>
        <Button
          variant="outline"
          onClick={openQuote}
          className="w-full sm:w-auto"
        >
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
          Cotizar
        </Button>
      </div>

      <QuotationCreateModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        initialClient={{ id: clientId, name: clientName || `Cliente #${clientId}` }}
        initialObservation={quoteNotes}
      />
    </div>
  );
}

function FieldEditor({
  def,
  value,
  onChange,
}: {
  def: ExtraFieldDefinition;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = def.field_type ?? "TEXT";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">
        {def.name}
        {def.is_required ? (
          <span className="text-danger"> · Obligatorio</span>
        ) : (
          <span> · Opcional</span>
        )}
      </label>
      {t === "BOOLEAN" ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={value === "true" ? "default" : "outline"}
            onClick={() => onChange(value === "true" ? "" : "true")}
          >
            Sí
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value === "false" ? "default" : "outline"}
            onClick={() => onChange(value === "false" ? "" : "false")}
          >
            No
          </Button>
        </div>
      ) : t === "SELECT" || t === "MULTISELECT" ? (
        (() => {
          const opts = parseFieldOptions(def.options);
          if (opts.length === 0) {
            return (
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Sin opciones cargadas en Fichas"
              />
            );
          }
          return (
            <Select value={value} onChange={(e) => onChange(e.target.value)}>
              <option value="">Elegí…</option>
              {opts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          );
        })()
      ) : t === "FILE" || t === "IMAGE" ? (
        <div className="flex flex-col gap-1">
          <input
            type="file"
            accept={t === "IMAGE" ? "image/*" : undefined}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onChange(file ? file.name : "");
            }}
          />
          {value ? (
            <p className="truncate text-xs text-muted-foreground">{value}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Todavía no hay archivo</p>
          )}
        </div>
      ) : (
        <Input
          type={
            t === "NUMBER" || t === "INTEGER" || t === "DECIMAL"
              ? "number"
              : t === "DATE"
                ? "date"
                : t === "DATETIME"
                  ? "datetime-local"
                  : t === "EMAIL"
                    ? "email"
                    : t === "PHONE"
                      ? "tel"
                      : t === "URL"
                        ? "url"
                        : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            def.unit
              ? `En ${def.unit}`
              : t === "EMAIL"
                ? "correo@ejemplo.cl"
                : t === "PHONE"
                  ? "+56 9 …"
                  : t === "URL"
                    ? "https://"
                    : undefined
          }
        />
      )}
    </div>
  );
}
