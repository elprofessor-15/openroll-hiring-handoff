import { test } from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  issues,
  rawRows,
  reconcile,
  forecast,
  lineCost,
  recordDecision,
  decisionFor,
  closePacket,
  validateDataset,
} from "../src/engine.js";
function reviewed(d = seed) {
  let decisions = {};
  for (const i of issues(d)) {
    const choice =
      i.id === "join:POS-102"
        ? "ATS-402"
        : i.type === "Unmapped offer"
          ? "POS-104"
          : i.defaultChoice;
    decisions = recordDecision(
      d,
      decisions,
      i.id,
      choice,
      "Demo reviewer",
      "Checked source references and effective dates for this synthetic close.",
    );
  }
  return decisions;
}
test("seed exposes four actionable issues and exactly one row per approved position", () => {
  const r = reconcile(seed);
  assert.equal(r.findings.length, 4);
  assert.equal(r.pending.length, 4);
  assert.equal(r.rows.length, 5);
  assert.equal(new Set(r.rows.map((p) => p.positionId)).size, 5);
  assert.ok(!r.rows.some((p) => p.positionId === "POS-103"));
  assert.equal(rawRows(seed).length, 9);
});
test("draft assumptions are explicit and do not silently review exceptions", () => {
  const f = forecast(seed);
  assert.equal(f.totalCents, 3600000);
  assert.equal(f.planTotalCents, 4280000);
  assert.equal(f.rawTotalCents, 7232000);
  assert.equal(f.pending.length, 4);
  assert.equal(f.residualCents, 0);
});
test("recorded source choices yield the independently calculated November forecast", () => {
  const f = forecast(seed, reviewed());
  assert.equal(f.totalCents, 4032000);
  assert.equal(f.varianceCents, -248000);
  assert.equal(f.activePositions, 4);
  assert.deepEqual(
    f.bridge.map((i) => i.deltaCents),
    [-1160000, 0, -960000, -1080000],
  );
  assert.equal(f.residualCents, 0);
});
test("bridge reconciles exactly across months and a year boundary", () => {
  for (const m of ["2026-11", "2026-12", "2027-01"]) {
    const f = forecast(seed, reviewed(), m);
    assert.equal(
      f.rawTotalCents + f.bridge.reduce((n, b) => n + b.deltaCents, 0),
      f.totalCents,
    );
    assert.equal(f.residualCents, 0);
  }
  assert.equal(forecast(seed, reviewed(), "2026-12").totalCents, 6600000);
});
test("calendar proration includes start day and applies FTE and load separately", () => {
  const r = { ...seed.plan[1], start: "2026-11-16" };
  assert.deepEqual(lineCost(r, "2026-11"), {
    activeDays: 15,
    days: 30,
    baseCents: 600000,
    loadedCents: 720000,
    fte: 1,
  });
  assert.equal(
    lineCost({ ...r, fteBps: 5000 }, "2026-11", 0).baseCents,
    300000,
  );
  assert.equal(
    lineCost({ ...r, start: "2026-12-01" }, "2026-11").loadedCents,
    0,
  );
});
test("leap-month and last-day proration do not use a fixed 30-day denominator", () => {
  const r = { ...seed.plan[0], start: "2028-02-15" };
  assert.equal(lineCost(r, "2028-02").days, 29);
  assert.equal(lineCost(r, "2028-02").activeDays, 15);
  assert.equal(lineCost(r, "2028-02").baseCents, 517241);
  assert.equal(
    lineCost({ ...r, annualCents: 37200000, start: "2027-01-31" }, "2027-01", 0)
      .baseCents,
    100000,
  );
});
test("linked orphan replaces a planned vacancy instead of adding another headcount row", () => {
  const r = reconcile(seed, reviewed());
  const designer = r.rows.filter((p) => p.positionId === "POS-104");
  assert.equal(designer.length, 1);
  assert.equal(designer[0].sourceId, "ATS-404");
  assert.equal(designer[0].start, "2026-11-09");
});
test("operator decisions require a permitted source, owner and useful note", () => {
  assert.throws(() =>
    recordDecision(
      seed,
      {},
      "join:POS-101",
      "WRONG",
      "Reviewer",
      "This note is sufficiently long.",
    ),
  );
  assert.throws(() =>
    recordDecision(seed, {}, "join:POS-101", "HRIS-201", "R", "short"),
  );
  assert.equal(Object.keys(reviewed()).length, 4);
});
test("snapshot edits invalidate previous decisions and reblock packet export", () => {
  const decisions = reviewed(),
    d = structuredClone(seed);
  d.ats[0].updated = "2026-10-28";
  assert.equal(decisionFor(d, decisions, issues(d)[0]), null);
  assert.equal(reconcile(d, decisions).pending.length, 4);
  assert.throws(() => closePacket(d, decisions));
});
test("packet blocks unresolved exceptions and preserves source records and evidence", () => {
  assert.throws(() => closePacket(seed, {}));
  const before = JSON.stringify(seed),
    p = closePacket(seed, reviewed());
  assert.equal(p.forecast.length, 3);
  assert.equal(p.decisions.length, 4);
  assert.deepEqual(p.sources, seed);
  assert.equal(
    p.forecast[0].positions.find((r) => r.positionId === "POS-104").activeDays,
    22,
  );
  assert.equal(JSON.stringify(seed), before);
});
test("validation rejects invalid dates, duplicate IDs, real person keys and unsafe amounts", () => {
  validateDataset(seed);
  for (const edit of [
    (d) => (d.plan[0].start = "2026-02-30"),
    (d) => (d.ats[0].id = d.hris[0].id),
    (d) => (d.ats[0].personKey = "not-synthetic"),
    (d) => (d.plan[0].annualCents = 1.5),
    (d) => (d.currency = "EUR"),
    (d) => (d.hris[0].positionId = "UNKNOWN"),
  ]) {
    const d = structuredClone(seed);
    edit(d);
    assert.throws(() => validateDataset(d));
  }
  assert.throws(() => forecast(seed, {}, "2026-13"));
  assert.throws(() => forecast(seed, {}, "2026-11", -1));
});
test("different person keys are surfaced rather than inferred to be the same hire", () => {
  const d = structuredClone(seed);
  d.hris[0].personKey = "SYN-OTHER";
  assert.equal(
    issues(d).find((i) => i.positionId === "POS-101").type,
    "Identity mismatch",
  );
  assert.throws(() => closePacket(d, {}));
});
test("multiple records within a source remain an explicit operator exception", () => {
  const d = structuredClone(seed);
  d.ats.push({ ...d.ats[4], id: "ATS-406", personKey: "SYN-06" });
  assert.equal(
    issues(d).find((i) => i.positionId === "POS-105").type,
    "Multiple records",
  );
  assert.equal(
    reconcile(d).rows.filter((r) => r.positionId === "POS-105").length,
    1,
  );
  assert.equal(forecast(d).residualCents, 0);
});
test("two unassigned offers cannot claim the same vacant plan position", () => {
  const d = structuredClone(seed);
  d.ats.push({
    ...d.ats[3],
    id: "ATS-407",
    positionId: "POS-998",
    personKey: "SYN-07",
  });
  let decisions = recordDecision(
    d,
    {},
    "unmapped:ATS-404",
    "POS-104",
    "Reviewer",
    "Verified explicit approved position reference.",
  );
  assert.throws(() =>
    recordDecision(
      d,
      decisions,
      "unmapped:ATS-407",
      "POS-104",
      "Reviewer",
      "Verified explicit approved position reference.",
    ),
  );
});

test("position-level budget drivers explain the full variance to approved plan", () => {
  const f = forecast(seed, reviewed());
  const drivers = f.details.filter((r) => r.varianceToPlanCents !== 0);
  assert.deepEqual(
    drivers.map((r) => [r.positionId, r.varianceToPlanCents]),
    [
      ["POS-101", 40000],
      ["POS-104", -288000],
    ],
  );
  assert.equal(
    f.details.reduce((n, r) => n + r.varianceToPlanCents, 0),
    f.varianceCents,
  );
});
test("CSV handoff quotes source references and states money units as cents", async () => {
  const { forecastCsv } = await import("../src/engine.js");
  const p = closePacket(seed, reviewed());
  p.forecast[0].positions[0].sourceId = 'HRIS,"201"';
  const csv = forecastCsv(p);
  assert.ok(csv.includes('"HRIS,""201"""'));
  assert.ok(csv.startsWith('"month","position_id"'));
  assert.ok(csv.includes('"period_cost_cents"'));
  assert.equal(csv.split("\r\n").length, 16);
});
