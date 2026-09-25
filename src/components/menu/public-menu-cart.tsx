"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2, MessageCircle, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  payPublicCatalogProduct,
  type MenuMode,
  type PublicMenuProduct,
} from "@/lib/api/public-catalog";

export type PublicCartLine = {
  product: PublicMenuProduct;
  quantity: number;
};

type Props = {
  mode: MenuMode | string;
  themeColor: string;
  slug: string;
  catalogTitle: string;
  whatsappPhone?: string | null;
  cart: PublicCartLine[];
  onChangeQty: (productId: number, quantity: number) => void;
  onClear: () => void;
};

function buildWhatsAppMessage(
  catalogTitle: string,
  cart: PublicCartLine[],
  customer: { name: string; phone: string; note: string },
): string {
  const lines = cart.map((l) => {
    const price = Number(l.product.sale_price ?? l.product.price ?? 0);
    return `• ${l.quantity}× ${l.product.name} — ${formatCLP(price * l.quantity)}`;
  });
  const total = cart.reduce((sum, l) => {
    const price = Number(l.product.sale_price ?? l.product.price ?? 0);
    return sum + price * l.quantity;
  }, 0);
  return [
    `Pedido — ${catalogTitle}`,
    "",
    ...lines,
    "",
    `Total: ${formatCLP(total)}`,
    customer.name ? `Cliente: ${customer.name}` : null,
    customer.phone ? `Tel: ${customer.phone}` : null,
    customer.note ? `Nota: ${customer.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function PublicMenuCartBar({
  mode,
  themeColor,
  slug,
  catalogTitle,
  whatsappPhone,
  cart,
  onChangeQty,
  onClear,
}: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [paying, setPaying] = useState(false);

  const canOrder = mode === "ORDENAR" || mode === "PAGAR";
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);
  const total = useMemo(
    () =>
      cart.reduce((sum, l) => {
        const price = Number(l.product.sale_price ?? l.product.price ?? 0);
        return sum + price * l.quantity;
      }, 0),
    [cart],
  );

  if (!canOrder || itemCount === 0) return null;

  function openWhatsApp() {
    const text = buildWhatsAppMessage(catalogTitle, cart, { name, phone, note });
    const encoded = encodeURIComponent(text);
    const digits = (whatsappPhone ?? "").replace(/\D/g, "");
    const url = digits
      ? `https://wa.me/${digits}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Pedido listo para enviar por WhatsApp");
  }

  async function handlePay() {
    if (!email.trim()) {
      toast.error("Indica tu email para el pago.");
      return;
    }
    if (cart.length === 0) return;
    setPaying(true);
    try {
      // El API de Flow cobra de a un producto; pagamos el primero y
      // el resto va en la nota del pedido por WhatsApp si hay más.
      const first = cart[0];
      const result = await payPublicCatalogProduct(slug, {
        product_id: first.product.id,
        quantity: first.quantity,
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      const url =
        (typeof result.payment_url === "string" && result.payment_url) ||
        (typeof result.url === "string" && result.url) ||
        (typeof result.redirect_url === "string" && result.redirect_url) ||
        null;
      if (url) {
        if (cart.length > 1) {
          toast.warning(
            "Flow cobra un producto por vez. Se abrirá el pago del primero; el resto envíalo por WhatsApp.",
          );
        }
        window.location.assign(url);
        return;
      }
      toast.error("No se recibió URL de pago. Usa WhatsApp para completar el pedido.");
      openWhatsApp();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo iniciar el pago";
      toast.error(msg);
      // Sucursal sin Flow: caer a WhatsApp
      if (/pagos online|Flow|habilitad/i.test(msg)) {
        toast.warning("Pagos online no habilitados. Enviando por WhatsApp…");
        openWhatsApp();
      }
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="glass-strong mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left shadow-lg"
          style={{ borderColor: `${themeColor}40` }}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="h-4 w-4" style={{ color: themeColor }} />
            {itemCount} en el pedido
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: themeColor }}>
            {formatCLP(total)}
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="glass-read flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <h2 className="text-base font-semibold">
                {mode === "PAGAR" ? "Pedir y pagar" : "Tu pedido"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {cart.map((line) => {
                const unit = Number(line.product.sale_price ?? line.product.price ?? 0);
                return (
                  <div
                    key={line.product.id}
                    className="flex items-center gap-3 rounded-xl border border-border/50 bg-white/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.product.name}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatCLP(unit)} c/u
                      </p>
                    </div>
                    <div className="inline-flex items-center overflow-hidden rounded-lg border border-border">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center"
                        onClick={() => onChangeQty(line.product.id, line.quantity - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-semibold tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center"
                        onClick={() => onChangeQty(line.product.id, line.quantity + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-danger"
                      onClick={() => onChangeQty(line.product.id, 0)}
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              <div className="grid gap-2 pt-1">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="h-10"
                />
                {mode === "PAGAR" && (
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email (requerido para pagar)"
                    className="h-10"
                    required
                  />
                )}
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Tu teléfono"
                  className="h-10"
                />
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota (opcional)"
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-2 border-t border-border/60 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold tabular-nums" style={{ color: themeColor }}>
                  {formatCLP(total)}
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={openWhatsApp}
                >
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  WhatsApp
                </Button>
                {mode === "PAGAR" && (
                  <Button
                    className="flex-1 text-white"
                    style={{ backgroundColor: themeColor }}
                    isLoading={paying}
                    onClick={handlePay}
                  >
                    <CreditCard className="mr-1.5 h-4 w-4" />
                    Pagar online
                  </Button>
                )}
              </div>
              <button
                type="button"
                className={cn("w-full text-center text-xs text-muted-foreground hover:underline")}
                onClick={onClear}
              >
                Vaciar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
