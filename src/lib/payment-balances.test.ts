import { describe, expect, it } from "vitest";
import {
  applyCancelToBalances,
  applyPaymentToBalances,
  toProcessPaymentDto,
} from "./payment-balances";

describe("applyPaymentToBalances", () => {
  it("subtracts the payment from that student's owed amount", () => {
    expect(applyPaymentToBalances({ "7": 100, "8": 50 }, 7, 25)).toEqual({
      "7": 75,
      "8": 50,
    });
  });

  it("leaves the map unchanged when studentId is missing", () => {
    const start = { "7": 100 };
    expect(applyPaymentToBalances(start, 9, 25)).toBe(start);
  });
});

describe("applyCancelToBalances", () => {
  it("adds the amount back for that student", () => {
    expect(applyCancelToBalances({ "7": 75 }, 7, 25)).toEqual({ "7": 100 });
  });

  it("leaves the map unchanged when studentId is missing", () => {
    const start = { "7": 75 };
    expect(applyCancelToBalances(start, 9, 25)).toBe(start);
  });
});

describe("toProcessPaymentDto", () => {
  it("returns only UI fields and ISO issueDate", () => {
    const dto = toProcessPaymentDto({
      payment: {
        id: 1,
        studentId: 7,
        paymentMethod: "cash",
        referenceNumber: null,
        notes: "x",
      },
      receipt: {
        id: 2,
        receiptNumber: 10,
        amount: 25,
        issueDate: new Date("2026-09-06T00:00:00.000Z"),
        studentName: "أحمد علي",
      },
    });
    expect(dto).toEqual({
      payment: {
        id: 1,
        studentId: 7,
        paymentMethod: "cash",
        referenceNumber: null,
        notes: "x",
      },
      receipt: {
        id: 2,
        receiptNumber: 10,
        amount: 25,
        issueDate: "2026-09-06T00:00:00.000Z",
        studentName: "أحمد علي",
      },
    });
  });
});
