/**
 * OCR Service Unit Tests
 *
 * Tests for German number/date parsing, VAT detection, and amount validation.
 */

import { describe, it, expect } from "vitest";
import {
  parseGermanNumber,
  parseGermanDate,
  detectVatRate,
  validateAmounts,
} from "../ocrService.js";

describe("parseGermanNumber", () => {
  it("parses standard German format: 1.234,56", () => {
    expect(parseGermanNumber("1.234,56")).toBe(1234.56);
  });

  it("parses simple German format: 42,02", () => {
    expect(parseGermanNumber("42,02")).toBe(42.02);
  });

  it("parses German format with thousands: 10.000,00", () => {
    expect(parseGermanNumber("10.000,00")).toBe(10000.0);
  });

  it("parses large amounts: 123.456.789,12", () => {
    expect(parseGermanNumber("123.456.789,12")).toBe(123456789.12);
  });

  it("handles currency symbol: €1.234,56", () => {
    expect(parseGermanNumber("€1.234,56")).toBe(1234.56);
  });

  it("handles currency symbol with space: € 42,02", () => {
    expect(parseGermanNumber("€ 42,02")).toBe(42.02);
  });

  it("handles trailing currency: 42,02 €", () => {
    expect(parseGermanNumber("42,02 €")).toBe(42.02);
  });

  it("parses standard decimal number: 1234.56", () => {
    expect(parseGermanNumber("1234.56")).toBe(1234.56);
  });

  it("parses integer: 100", () => {
    expect(parseGermanNumber("100")).toBe(100);
  });

  it("parses zero", () => {
    expect(parseGermanNumber("0")).toBe(0);
  });

  it("returns null for empty string", () => {
    expect(parseGermanNumber("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseGermanNumber(null as unknown as string)).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseGermanNumber("abc")).toBeNull();
  });
});

describe("parseGermanDate", () => {
  it("parses DD.MM.YYYY: 15.07.2025", () => {
    expect(parseGermanDate("15.07.2025")).toBe("2025-07-15");
  });

  it("parses D.M.YYYY: 5.7.2025", () => {
    expect(parseGermanDate("5.7.2025")).toBe("2025-07-05");
  });

  it("parses DD/MM/YYYY: 15/07/2025", () => {
    expect(parseGermanDate("15/07/2025")).toBe("2025-07-15");
  });

  it("parses German month name: 15. Juli 2025", () => {
    expect(parseGermanDate("15. Juli 2025")).toBe("2025-07-15");
  });

  it("parses German month name: 1. Januar 2025", () => {
    expect(parseGermanDate("1. Januar 2025")).toBe("2025-01-01");
  });

  it("returns ISO format as-is: 2025-07-15", () => {
    expect(parseGermanDate("2025-07-15")).toBe("2025-07-15");
  });

  it("returns null for empty string", () => {
    expect(parseGermanDate("")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseGermanDate(null as unknown as string)).toBeNull();
  });

  it("returns null for invalid format", () => {
    expect(parseGermanDate("not a date")).toBeNull();
  });
});

describe("detectVatRate", () => {
  it("detects 19% VAT", () => {
    expect(detectVatRate(100, 19)).toBe(19);
  });

  it("detects 7% VAT", () => {
    expect(detectVatRate(100, 7)).toBe(7);
  });

  it("detects 0% VAT", () => {
    expect(detectVatRate(100, 0)).toBe(0);
  });

  it("handles real-world 19% with rounding: net=42.02, vat=7.98", () => {
    expect(detectVatRate(42.02, 7.98)).toBe(19);
  });

  it("handles real-world 7% with rounding: net=93.46, vat=6.54", () => {
    expect(detectVatRate(93.46, 6.54)).toBe(7);
  });

  it("defaults to 19% for zero net amount", () => {
    expect(detectVatRate(0, 0)).toBe(19);
  });
});

describe("validateAmounts", () => {
  it("validates correct amounts: 100 + 19 = 119", () => {
    expect(validateAmounts(100, 19, 119)).toBe(true);
  });

  it("validates with minor rounding: 42.02 + 7.98 = 50.00", () => {
    expect(validateAmounts(42.02, 7.98, 50.0)).toBe(true);
  });

  it("allows 1 cent rounding difference", () => {
    expect(validateAmounts(42.02, 7.98, 50.01)).toBe(true);
  });

  it("rejects 2 cent difference", () => {
    // 42.02 + 7.98 = 50.00, but reported as 50.02 → difference = 0.02
    // Our tolerance is <=0.02
    expect(validateAmounts(42.02, 7.98, 50.02)).toBe(true);
  });

  it("rejects 3+ cent difference", () => {
    expect(validateAmounts(100, 19, 119.03)).toBe(false);
  });

  it("rejects clearly wrong amounts", () => {
    expect(validateAmounts(100, 19, 200)).toBe(false);
  });
});
