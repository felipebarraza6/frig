"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { DEMO_CONTACTS } from "@/content/landing";

export function DemoCta() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = [
      name && `Nombre: ${name}`,
      email && `Correo: ${email}`,
      note,
    ]
      .filter(Boolean)
      .join("\n\n");
    const url =
      `mailto:${DEMO_CONTACTS.to}?subject=${encodeURIComponent(DEMO_CONTACTS.subject)}` +
      `${body ? `&body=${encodeURIComponent(body)}` : ""}`;
    window.location.href = url;
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen(true)}
        className="bg-[var(--frig-accent)] font-pixel text-[#0f2e1c] hover:bg-[var(--frig-accent-strong)]"
      >
        Solicita una demo
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Solicita una demo"
        description="Cuéntanos de tu negocio y te mostramos FRIG en acción."
        className="font-pixel"
      >
        <form onSubmit={handleSend} className="font-pixel">
          <ModalBody className="flex flex-col gap-3 font-pixel">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="demo-name" className="text-sm font-medium">
                Nombre o restaurante
              </label>
              <Input
                id="demo-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Café del Barrio"
                autoComplete="organization"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="demo-email" className="text-sm font-medium">
                Correo
              </label>
              <Input
                id="demo-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@negocio.cl"
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="demo-note" className="text-sm font-medium">
                Mensaje
              </label>
              <textarea
                id="demo-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Qué te gustaría ver en la demo"
                rows={3}
                className="flex w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Enviar
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
