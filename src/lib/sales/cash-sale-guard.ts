export function cashPaymentWithoutRegister(
  payments: { payment_method_id: string; amount: string }[],
  methods: { id: string; payment_type?: string | null }[],
  hasRegister: boolean,
): boolean {
  if (hasRegister) return false;
  return payments.some((payment) => {
    const amount = Number(payment.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const method = methods.find((item) => item.id === payment.payment_method_id);
    return method?.payment_type === "CASH";
  });
}
