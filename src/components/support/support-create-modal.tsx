"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleHelp,
  AlertTriangle,
  MessageSquareHeart,
  BookOpen,
  MessageSquareWarning,
} from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SUPPORT_INQUIRY_OPTIONS,
  bootstrapFrigSupport,
  createSupportTicket,
  fetchSupportCategories,
  fetchSupportSlaPolicies,
  type SupportAttachment,
  type SupportInquiryKind,
} from "@/lib/api/support";
import { SupportAttachmentPicker } from "@/components/support/support-attachment-picker";
import { useSessionStore } from "@/lib/store/session";
import { useProductName } from "@/lib/product-name";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

interface SupportCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (ticketId: string) => void;
  /** Prefija el tipo al abrir (desde los portales del hub). */
  initialKind?: SupportInquiryKind;
  /** Cliente CRM fijado (p. ej. reclamo desde ficha 360). */
  initialClientId?: number | null;
  /** Nombre del cliente para el chip de contexto. */
  initialClientName?: string | null;
}

const KIND_META: Record<
  SupportInquiryKind,
  { icon: typeof CircleHelp; hint: string; placeholder: string }
> = {
  doubt: {
    icon: CircleHelp,
    hint: "Algo no te queda claro del uso.",
    placeholder: "Ej: ¿Cómo abro la caja del día?",
  },
  incident: {
    icon: AlertTriangle,
    hint: "Algo falló o no funciona como debería.",
    placeholder: "Ej: El POS no carga los productos",
  },
  claim: {
    icon: MessageSquareWarning,
    hint: "Queja o reclamo de un cliente.",
    placeholder: "Ej: Pedido incompleto / demora en delivery",
  },
  feedback: {
    icon: MessageSquareHeart,
    hint: "Ideas o comentarios para mejorar el producto.",
    placeholder: "Ej: Me gustaría ver el stock en el POS",
  },
  manual: {
    icon: BookOpen,
    hint: "Pides una guía, tutorial o material de apoyo.",
    placeholder: "Ej: Manual para capacitar a cajeros",
  },
};

export function SupportCreateModal({
  open,
  onClose,
  onCreated,
  initialKind = "doubt",
  initialClientId = null,
  initialClientName = null,
}: SupportCreateModalProps) {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const productName = useProductName();
  const toast = useToast();
  const queryClient = useQueryClient();
  const branchIdNum = Number(currentBranchId);

  const [kind, setKind] = useState<SupportInquiryKind>(initialKind);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset del formulario al reabrir o cambiar de tipo inicial (ajuste en render).
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openKeyNow = open ? initialKind : null;
  if (openKey !== openKeyNow) {
    setOpenKey(openKeyNow);
    if (open) {
      setKind(initialKind);
      setError(null);
    }
  }

  const bootstrapQuery = useQuery({
    queryKey: ["support-bootstrap", currentBranchId, productName],
    queryFn: async () => {
      await bootstrapFrigSupport(branchIdNum, productName);
      const [categories, sla] = await Promise.all([
        fetchSupportCategories(),
        fetchSupportSlaPolicies(),
      ]);
      return { categories, sla };
    },
    enabled: open && Number.isFinite(branchIdNum) && branchIdNum > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const categoryId = useMemo(() => {
    const opt = SUPPORT_INQUIRY_OPTIONS.find((o) => o.value === kind);
    const cats = bootstrapQuery.data?.categories;
    if (!opt || !cats?.length) return null;
    const match = cats.find(
      (c) => c.name.trim().toLowerCase() === opt.categoryName.toLowerCase(),
    );
    return match?.id ?? cats[0]?.id ?? null;
  }, [kind, bootstrapQuery.data?.categories]);

  const meta = KIND_META[kind];

  const create = useMutation({
    mutationFn: async () => {
      const opt = SUPPORT_INQUIRY_OPTIONS.find((o) => o.value === kind)!;
      if (!categoryId) {
        throw new Error(
          "Soporte no tiene categorías configuradas en esta sucursal. Escribe a contacto@frig.cl.",
        );
      }
      const slaId = bootstrapQuery.data?.sla?.[0]?.id;
      if (!slaId) {
        throw new Error(
          "Falta una política SLA de soporte en esta sucursal. Escribe a contacto@frig.cl.",
        );
      }
      const cleanSubject = subject.trim();
      const prefixed = cleanSubject.toLowerCase().startsWith(opt.subjectPrefix.toLowerCase())
        ? cleanSubject
        : `${opt.subjectPrefix} ${cleanSubject}`;
      const name =
        [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
        user?.username ||
        undefined;
      return createSupportTicket({
        subject: prefixed,
        description: description.trim(),
        category: categoryId,
        priority: opt.priority,
        sla_policy: slaId,
        client: initialClientId ?? undefined,
        requester_email: user?.email || undefined,
        requester_name: name,
        attachments,
      });
    },
    onSuccess: (ticket) => {
      toast.success(
        initialClientId
          ? "Reclamo registrado en la ficha del cliente."
          : "Solicitud enviada. Te responderemos aquí.",
      );
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      if (initialClientId != null) {
        queryClient.invalidateQueries({
          queryKey: ["support-tickets", "client", initialClientId],
        });
      }
      setSubject("");
      setDescription("");
      setAttachments([]);
      setKind("doubt");
      setError(null);
      onCreated?.(ticket.id);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "No se pudo crear la solicitud.");
      toast.error(err.message || "No se pudo crear la solicitud.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) {
      setError("El asunto es obligatorio.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Cuéntanos un poco más (al menos 10 caracteres) para poder ayudarte.");
      return;
    }
    create.mutate();
  }

  const categoriesMissing =
    bootstrapQuery.isSuccess &&
    (!bootstrapQuery.data?.categories || bootstrapQuery.data.categories.length === 0);
  const ready =
    !bootstrapQuery.isLoading &&
    !categoriesMissing &&
    !!categoryId &&
    !!bootstrapQuery.data?.sla;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialClientId ? "Nuevo reclamo" : "Nueva solicitud de soporte"}
      description={
        initialClientId
          ? "Queda asociado a este cliente y aparece en su ficha (Casos)."
          : `El equipo de ${productName} recibe tu mensaje y te responde en esta misma bandeja.`
      }
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <ModalBody className="flex flex-col gap-4">
          {initialClientId != null && (
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Cliente · </span>
              <span className="font-medium text-foreground">
                {initialClientName?.trim() || `Cliente #${initialClientId}`}
              </span>
            </div>
          )}
          {bootstrapQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Tipo de consulta</p>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORT_INQUIRY_OPTIONS.map((opt) => {
                  const meta = KIND_META[opt.value];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  const selected = kind === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKind(opt.value)}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span>
                        <span className="block text-sm font-medium">{opt.label}</span>
                        <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
                          {opt.value === "doubt"
                            ? `Algo no te queda claro del uso de ${productName}.`
                            : meta.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Field label="Asunto" required>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={meta.placeholder}
              maxLength={200}
            />
          </Field>

          <Field
            label="Mensaje"
            required
            hint="Incluye qué estabas haciendo y qué viste en pantalla."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Cuéntanos qué pasó, qué esperabas y cómo te podemos ayudar."
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </Field>

          <Field
            label="Adjuntos"
            hint="Capturas de pantalla o un PDF ayudan a entender el problema."
          >
            <SupportAttachmentPicker value={attachments} onChange={setAttachments} />
          </Field>

          {bootstrapQuery.isError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              No pudimos preparar el soporte. Reintenta o escribe a{" "}
              <a className="underline" href="mailto:contacto@frig.cl">
                contacto@frig.cl
              </a>
              .
            </p>
          )}
          {categoriesMissing && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              Soporte aún no está configurado en esta sucursal. Contacta a{" "}
              <a className="underline" href="mailto:contacto@frig.cl">
                contacto@frig.cl
              </a>
              .
            </p>
          )}
          {bootstrapQuery.isSuccess && !bootstrapQuery.data?.sla && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              Falta la política SLA de soporte. Un administrador debe configurarla o escribe a{" "}
              <a className="underline" href="mailto:contacto@frig.cl">
                contacto@frig.cl
              </a>
              .
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={create.isPending} disabled={!ready}>
            Enviar solicitud
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
