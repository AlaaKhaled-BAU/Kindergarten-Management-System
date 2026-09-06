/** Local picker balances: positive = amount still owed. Payment reduces it; cancel restores it. */

export function applyPaymentToBalances(
  balances: Record<string, number>,
  studentId: number,
  amount: number,
): Record<string, number> {
  const key = String(studentId);
  if (!(key in balances)) {
    return balances;
  }
  return { ...balances, [key]: balances[key] - amount };
}

export function applyCancelToBalances(
  balances: Record<string, number>,
  studentId: number,
  amount: number,
): Record<string, number> {
  const key = String(studentId);
  if (!(key in balances)) {
    return balances;
  }
  return { ...balances, [key]: balances[key] + amount };
}

export function toProcessPaymentDto(args: {
  payment: {
    id: number;
    studentId: number;
    paymentMethod: string;
    referenceNumber: string | null;
    notes: string | null;
  };
  receipt: {
    id: number;
    receiptNumber: number;
    amount: number;
    issueDate: Date;
    studentName: string;
  };
}) {
  return {
    payment: {
      id: args.payment.id,
      studentId: args.payment.studentId,
      paymentMethod: args.payment.paymentMethod,
      referenceNumber: args.payment.referenceNumber,
      notes: args.payment.notes,
    },
    receipt: {
      id: args.receipt.id,
      receiptNumber: args.receipt.receiptNumber,
      amount: args.receipt.amount,
      issueDate: args.receipt.issueDate.toISOString(),
      studentName: args.receipt.studentName,
    },
  };
}
