import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Rounds to 3 decimal places (JOD fils precision). Money fields are stored
 * as Float; SUM-ing hundreds of rows over years without this can drift by
 * fractions of a fils (0.1 + 0.2 !== 0.3 territory). Not a fix for Float's
 * imprecision -- an integer-fils/Decimal migration would be that -- but it
 * stops drift from compounding across the ledger's aggregate sums.
 */
export function roundMoney(amount: number): number {
  return Math.round(amount * 1000) / 1000
}
