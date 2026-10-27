export const months = ["2026-11", "2026-12", "2027-01"];
const position = (id, title, team, annual, start, state = "approved") => ({
  id,
  title,
  team,
  annualCents: annual * 100,
  start,
  fteBps: 10000,
  state,
});
const record = (
  id,
  positionId,
  personKey,
  title,
  annual,
  start,
  status,
  updated,
) => ({
  id,
  positionId,
  personKey,
  title,
  annualCents: annual * 100,
  start,
  fteBps: 10000,
  status,
  updated,
});
export const seed = {
  asOf: "2026-10-28",
  workspace: "Northstar Labs",
  currency: "USD",
  plan: [
    position(
      "POS-101",
      "Backend engineer",
      "Engineering",
      120000,
      "2026-11-02",
    ),
    position(
      "POS-102",
      "Product engineer",
      "Engineering",
      144000,
      "2026-11-16",
    ),
    position(
      "POS-103",
      "Support lead",
      "Customer experience",
      96000,
      "2026-11-01",
      "frozen",
    ),
    position("POS-104", "Product designer", "Design", 108000, "2026-11-01"),
    position("POS-105", "Account executive", "Sales", 132000, "2026-11-01"),
    position(
      "POS-106",
      "Platform engineer",
      "Engineering",
      156000,
      "2026-12-01",
    ),
  ],
  ats: [
    record(
      "ATS-401",
      "POS-101",
      "SYN-01",
      "Backend engineer",
      120000,
      "2026-11-02",
      "accepted",
      "2026-10-24",
    ),
    record(
      "ATS-402",
      "POS-102",
      "SYN-02",
      "Product engineer",
      144000,
      "2026-11-16",
      "accepted",
      "2026-10-26",
    ),
    record(
      "ATS-403",
      "POS-103",
      "SYN-03",
      "Support lead",
      96000,
      "2026-11-01",
      "accepted",
      "2026-10-25",
    ),
    record(
      "ATS-404",
      "POS-999",
      "SYN-04",
      "Product designer",
      108000,
      "2026-11-09",
      "accepted",
      "2026-10-27",
    ),
    record(
      "ATS-405",
      "POS-105",
      "SYN-05",
      "Account executive",
      132000,
      "2026-11-01",
      "accepted",
      "2026-10-25",
    ),
  ],
  hris: [
    record(
      "HRIS-201",
      "POS-101",
      "SYN-01",
      "Backend engineer",
      120000,
      "2026-10-12",
      "active",
      "2026-10-27",
    ),
    record(
      "HRIS-202",
      "POS-102",
      "SYN-02",
      "Product engineer",
      144000,
      "2026-12-01",
      "preboarding",
      "2026-10-28",
    ),
  ],
};
export function isoDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw Error("Use a valid ISO date.");
  return value;
}
export function validateDataset(d) {
  if (
    !d ||
    d.currency !== "USD" ||
    typeof d.workspace !== "string" ||
    !d.workspace.trim()
  )
    throw Error("The demo supports one named USD workspace.");
  isoDate(d.asOf);
  const ids = new Set();
  for (const key of ["plan", "ats", "hris"]) {
    if (!Array.isArray(d[key]) || d[key].length > 30)
      throw Error("Use up to 30 records per source.");
    for (const r of d[key]) {
      if (typeof r.id !== "string" || !r.id || ids.has(r.id))
        throw Error("Source record IDs must be unique across all sources.");
      ids.add(r.id);
      if (
        !Number.isSafeInteger(r.annualCents) ||
        r.annualCents < 0 ||
        r.annualCents > 1000000000
      )
        throw Error("Annual cost must be integer cents from 0 to 1 billion.");
      if (!Number.isInteger(r.fteBps) || r.fteBps < 1 || r.fteBps > 10000)
        throw Error("FTE must be 1 to 10000 basis points.");
      isoDate(r.start);
      if (typeof r.title !== "string" || !r.title.trim())
        throw Error("Every record needs a role title.");
      if (key === "plan") {
        if (
          !["approved", "frozen"].includes(r.state) ||
          typeof r.team !== "string"
        )
          throw Error("Invalid position-plan state.");
      } else {
        if (
          typeof r.personKey !== "string" ||
          !/^SYN-[\w-]+$/.test(r.personKey) ||
          typeof r.positionId !== "string"
        )
          throw Error("Use synthetic person keys and explicit position IDs.");
        isoDate(r.updated);
        if (
          !(key === "ats" ? ["accepted"] : ["active", "preboarding"]).includes(
            r.status,
          )
        )
          throw Error("Invalid source status.");
      }
    }
  }
  if (!d.plan.length) throw Error("At least one plan position is required.");
  if (d.hris.some((r) => !d.plan.some((p) => p.id === r.positionId)))
    throw Error(
      "This focused demo requires HRIS records to have known position IDs.",
    );
  return d;
}
export const fingerprint = (d) => JSON.stringify(d);
export function monthDetails(month) {
  if (!/^\d{4}-\d{2}$/.test(month))
    throw Error("Use a YYYY-MM forecast month.");
  const [y, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) throw Error("Invalid month.");
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${days}`, days };
}
const roundRatio = (n, d) => Number((n + d / 2n) / d);
export function lineCost(row, month, loadBps = 2000) {
  isoDate(row.start);
  if (!Number.isInteger(loadBps) || loadBps < 0 || loadBps > 10000)
    throw Error("Planning load must be 0 to 100 percent.");
  const p = monthDetails(month),
    activeDays =
      row.start > p.last
        ? 0
        : row.start <= p.first
          ? p.days
          : p.days - Number(row.start.slice(-2)) + 1;
  const base = roundRatio(
    BigInt(row.annualCents) * BigInt(row.fteBps) * BigInt(activeDays),
    12n * 10000n * BigInt(p.days),
  );
  return {
    activeDays,
    days: p.days,
    baseCents: base,
    loadedCents: roundRatio(BigInt(base) * BigInt(10000 + loadBps), 10000n),
    fte: activeDays > 0 ? row.fteBps / 10000 : 0,
  };
}
export function issues(d) {
  const out = [];
  for (const p of d.plan) {
    const a = d.ats.filter((r) => r.positionId === p.id),
      h = d.hris.filter((r) => r.positionId === p.id);
    if (p.state === "frozen" && (a.length || h.length)) {
      out.push({
        id: "freeze:" + p.id,
        type: "Frozen position",
        title: "A live record points to a frozen position",
        positionId: p.id,
        sourceIds: [p.id, ...a.map((x) => x.id), ...h.map((x) => x.id)],
        defaultChoice: "exclude",
        options: [
          {
            value: "exclude",
            label: "Keep excluded from this close",
            ref: p.id,
          },
        ],
        explanation:
          "The plan is frozen while another system still carries the position. Exclude it from the proposed close and record the discrepancy. No source record is changed.",
      });
      continue;
    }
    if (a.length > 1 || h.length > 1) {
      out.push({
        id: "multiple:" + p.id,
        type: "Multiple records",
        title: "Several source records occupy one position",
        positionId: p.id,
        sourceIds: [...h, ...a].map((r) => r.id),
        defaultChoice: (h[0] || a[0]).id,
        options: [...h, ...a].map((r) => ({
          value: r.id,
          label: `Use ${r.id} · ${r.start}`,
          ref: r.id,
        })),
        explanation:
          "One position has multiple records within a source. Choose an explicit record for this local forecast; no automatic identity merge is made.",
      });
      continue;
    }
    if (a.length && h.length) {
      const aa = a[0],
        hh = h[0];
      const same = aa.personKey === hh.personKey;
      out.push({
        id: "join:" + p.id,
        type: !same
          ? "Identity mismatch"
          : hh.status === "active"
            ? "Already joined"
            : "Start-date conflict",
        title: !same
          ? "Different person keys occupy one position"
          : hh.status === "active"
            ? "One hire appears in two systems"
            : "ATS and HRIS disagree on the start date",
        positionId: p.id,
        sourceIds: [aa.id, hh.id],
        defaultChoice: hh.id,
        options: [
          { value: hh.id, label: `Use HRIS · ${hh.start}`, ref: hh.id },
          { value: aa.id, label: `Use ATS · ${aa.start}`, ref: aa.id },
        ],
        explanation: !same
          ? "Position IDs agree but synthetic person keys differ. Do not assume these are one hire. An operator must record a source choice for this scenario."
          : hh.status === "active"
            ? "The synthetic person key and position ID link an accepted offer to a joined employee. Carry one cost line, with a recorded source choice."
            : "Two records for the same synthetic person and position contain different effective dates. Choose the source for this forecast without editing either system.",
      });
    }
  }
  for (const a of d.ats.filter(
    (r) => !d.plan.some((p) => p.id === r.positionId),
  )) {
    const candidates = d.plan.filter(
      (p) =>
        p.state === "approved" &&
        !d.hris.some((h) => h.positionId === p.id) &&
        !d.ats.some((x) => x.positionId === p.id),
    );
    out.push({
      id: "unmapped:" + a.id,
      type: "Unmapped offer",
      title: "An accepted offer has no approved position link",
      positionId: null,
      sourceIds: [a.id],
      defaultChoice: "exclude",
      options: [
        {
          value: "exclude",
          label: "Leave unassigned and exclude the offer",
          ref: a.id,
        },
        ...candidates.map((p) => ({
          value: p.id,
          label: `Link to ${p.id} · ${p.title}`,
          ref: p.id,
        })),
      ],
      explanation:
        "The offer points outside the approved plan. A matching role title is not proof of identity. Choose a plan position explicitly or leave the offer unassigned.",
    });
  }
  return out;
}
export function decisionFor(d, decisions, item) {
  const r = decisions[item.id];
  return r?.fingerprint === fingerprint(d) &&
    typeof r.owner === "string" &&
    r.owner.trim().length >= 2 &&
    typeof r.note === "string" &&
    r.note.trim().length >= 12 &&
    item.options.some((o) => o.value === r.choice)
    ? r
    : null;
}
export function recordDecision(d, existing, issueId, choice, owner, note) {
  const item = issues(d).find((i) => i.id === issueId);
  if (!item || !item.options.some((o) => o.value === choice))
    throw Error("Choose one of this exception’s source options.");
  if (owner.trim().length < 2 || note.trim().length < 12)
    throw Error("Add an owner and a note of at least 12 characters.");
  if (
    item.type === "Unmapped offer" &&
    choice !== "exclude" &&
    Object.entries(existing).some(
      ([id, r]) =>
        id !== issueId &&
        id.startsWith("unmapped:") &&
        r.choice === choice &&
        r.fingerprint === fingerprint(d),
    )
  )
    throw Error("Another unassigned offer already uses that position.");
  return {
    ...existing,
    [issueId]: {
      choice,
      owner: owner.trim(),
      note: note.trim(),
      fingerprint: fingerprint(d),
      recordedAt: new Date().toISOString(),
    },
  };
}
export function rawRows(d) {
  const known = new Set([...d.ats, ...d.hris].map((r) => r.positionId));
  return [
    ...d.hris.map((r) => ({ ...r, source: "HRIS", sourceId: r.id })),
    ...d.ats.map((r) => ({ ...r, source: "ATS", sourceId: r.id })),
    ...d.plan
      .filter((p) => p.state === "approved" && !known.has(p.id))
      .map((p) => ({ ...p, positionId: p.id, source: "Plan", sourceId: p.id })),
  ];
}
export function reconcile(d, decisions = {}) {
  validateDataset(d);
  const findings = issues(d),
    rows = [];
  for (const p of d.plan) {
    if (p.state === "frozen") continue;
    const issue = findings.find((i) => i.positionId === p.id),
      review = issue && decisionFor(d, decisions, issue);
    const source =
      [...d.hris, ...d.ats].find(
        (r) => r.id === (review?.choice || issue?.defaultChoice),
      ) ||
      d.hris.find((r) => r.positionId === p.id) ||
      d.ats.find((r) => r.positionId === p.id) ||
      p;
    rows.push({
      ...source,
      positionId: p.id,
      team: p.team,
      title: p.title,
      source: source === p ? "Plan" : d.hris.includes(source) ? "HRIS" : "ATS",
      sourceId: source.id,
      positionState: source === p ? "Planned vacancy" : "Linked record",
    });
  }
  for (const item of findings.filter((i) => i.type === "Unmapped offer")) {
    const review = decisionFor(d, decisions, item);
    if (review && review.choice !== "exclude") {
      const a = d.ats.find((r) => r.id === item.sourceIds[0]),
        p = d.plan.find((r) => r.id === review.choice),
        index = rows.findIndex((r) => r.positionId === p.id);
      if (index >= 0)
        rows[index] = {
          ...a,
          positionId: p.id,
          team: p.team,
          title: p.title,
          source: "ATS",
          sourceId: a.id,
          positionState: "Operator-linked offer",
        };
    }
  }
  return {
    rows,
    findings,
    pending: findings.filter((i) => !decisionFor(d, decisions, i)),
  };
}
export function forecast(d, decisions = {}, month = "2026-11", loadBps = 2000) {
  const close = reconcile(d, decisions),
    raw = rawRows(d),
    cost = (rows) =>
      rows.reduce((n, r) => n + lineCost(r, month, loadBps).loadedCents, 0),
    rawTotal = cost(raw),
    total = cost(close.rows);
  const bridge = close.findings.map((i) => {
    let ids = i.positionId ? [i.positionId] : [];
    if (i.type === "Unmapped offer") {
      const a = d.ats.find((r) => r.id === i.sourceIds[0]),
        choice = decisionFor(d, decisions, i)?.choice;
      ids = [a.positionId, ...(choice && choice !== "exclude" ? [choice] : [])];
    }
    return {
      ...i,
      deltaCents:
        cost(close.rows.filter((r) => ids.includes(r.positionId))) -
        cost(raw.filter((r) => ids.includes(r.positionId))),
    };
  });
  return {
    ...close,
    month,
    loadBps,
    rawRows: raw,
    rawTotalCents: rawTotal,
    totalCents: total,
    planTotalCents: cost(d.plan.filter((p) => p.state === "approved")),
    varianceCents: total - cost(d.plan.filter((p) => p.state === "approved")),
    deltaCents: total - rawTotal,
    bridge,
    residualCents:
      total - rawTotal - bridge.reduce((n, b) => n + b.deltaCents, 0),
    activePositions: close.rows.filter(
      (r) => lineCost(r, month, loadBps).activeDays > 0,
    ).length,
    details: close.rows.map((r) => {
      const calculated = lineCost(r, month, loadBps),
        planned = d.plan.find((p) => p.id === r.positionId),
        planCost = lineCost(planned, month, loadBps).loadedCents;
      return {
        ...r,
        ...calculated,
        plannedStart: planned.start,
        planCostCents: planCost,
        varianceToPlanCents: calculated.loadedCents - planCost,
      };
    }),
  };
}
export function closePacket(d, decisions, loadBps = 2000) {
  const r = reconcile(d, decisions);
  if (r.pending.length)
    throw Error(
      "Record a decision for every exception before exporting the close packet.",
    );
  const forecasts = months.map((month) =>
    forecast(d, decisions, month, loadBps),
  );
  if (forecasts.some((f) => f.residualCents !== 0))
    throw Error(
      "The bridge must reconcile to zero unexplained residual before export.",
    );
  return {
    schema: "openroll-hiring-handoff.v1",
    workspace: d.workspace,
    asOf: d.asOf,
    currency: d.currency,
    createdAt: new Date().toISOString(),
    assumptions: {
      loadBps,
      annualDivisor: 12,
      proration:
        "Calendar days, inclusive start date; rounded per line in integer cents.",
      scope:
        "Synthetic hiring cohort only. Employer load is a planning assumption, not a tax rate.",
    },
    sources: d,
    decisions: r.findings.map((i) => ({
      issue: i,
      record: decisionFor(d, decisions, i),
    })),
    forecast: forecasts.map((f) => ({
      month: f.month,
      rawTotalCents: f.rawTotalCents,
      totalCents: f.totalCents,
      planTotalCents: f.planTotalCents,
      varianceCents: f.varianceCents,
      deltaCents: f.deltaCents,
      bridge: f.bridge.map((b) => ({ id: b.id, deltaCents: b.deltaCents })),
      residualCents: f.residualCents,
      positions: f.details,
    })),
  };
}

export function forecastCsv(packet) {
  const rows = [
    [
      "month",
      "position_id",
      "source_ref",
      "active_days",
      "period_cost_cents",
      "plan_cost_cents",
      "variance_cents",
    ],
    ...packet.forecast.flatMap((m) =>
      m.positions.map((r) => [
        m.month,
        r.positionId,
        r.sourceId,
        r.activeDays,
        r.loadedCents,
        r.planCostCents,
        r.varianceToPlanCents,
      ]),
    ),
  ];
  return rows
    .map((row) =>
      row
        .map((value) => '"' + String(value).replaceAll('"', '""') + '"')
        .join(","),
    )
    .join("\r\n");
}
