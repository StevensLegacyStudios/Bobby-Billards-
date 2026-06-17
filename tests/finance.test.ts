import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyPayment, financingFor, outTheDoor } from "../lib/finance/payment.ts";
import { estimateApr } from "../lib/finance/apr.ts";
import { monthlyFuelCost } from "../lib/finance/gas.ts";
import { tierFromScore } from "../lib/profile.ts";

test("monthlyPayment matches a known amortization", () => {
  // $20,000 at 21.5% APR over 72 months ≈ $497/mo
  const p = monthlyPayment(20000, 21.5, 72);
  assert.ok(p > 495 && p < 499, `expected ~497, got ${p.toFixed(2)}`);
});

test("zero-interest loan is principal / term", () => {
  assert.equal(monthlyPayment(12000, 0, 60), 200);
});

test("tierFromScore buckets correctly", () => {
  assert.equal(tierFromScore(480), "deep-subprime");
  assert.equal(tierFromScore(529), "subprime");
  assert.equal(tierFromScore(560), "subprime");
  assert.equal(tierFromScore(640), "fair");
  assert.equal(tierFromScore(700), "good");
  assert.equal(tierFromScore(800), "excellent");
});

test("estimateApr returns deep-subprime rates", () => {
  assert.equal(estimateApr("deep-subprime", "used"), 21.5);
  assert.equal(estimateApr("deep-subprime", "new"), 16.0);
});

test("financingFor enforces the lender loan cap (Shawn's case)", () => {
  const fin = financingFor({ price: 18990, downPayment: 2000, loanCap: 13500 });
  assert.equal(fin.fitsCap, false);
  assert.equal(fin.amountFinanced, 13500);
  // Out-the-door minus the cap is the cash the buyer must bring.
  assert.ok(fin.requiredDown > 7700 && fin.requiredDown < 7800, `got ${fin.requiredDown}`);
});

test("financingFor within cap keeps the chosen down payment", () => {
  const fin = financingFor({ price: 13000, downPayment: 2000, loanCap: 13500 });
  assert.equal(fin.fitsCap, true);
  assert.equal(fin.requiredDown, 2000);
});

test("outTheDoor adds tax and fees", () => {
  assert.ok(outTheDoor(20000) > 21000);
});

test("monthlyFuelCost computes commute cost", () => {
  // 2,000 mi/mo at 50 MPG and $4.80/gal = $192
  assert.equal(monthlyFuelCost(50, 2000, 4.8), 192);
});
