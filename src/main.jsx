import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  Layers,
  Search,
  X,
  Download,
  Settings2,
  GitMerge,
  RotateCcw,
  ArrowLeft,
  Info,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import {
  seed,
  months,
  forecast,
  reconcile,
  recordDecision,
  decisionFor,
  closePacket,
  validateDataset,
  fingerprint,
  lineCost,
  forecastCsv,
} from "./engine";
import "./style.css";
const storeKey = "openroll-hiring-handoff-v1";
const usd = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n / 100);
const precise = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
const monthLabel = (m) =>
  new Date(m + "-15T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
const dateLabel = (d) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + usd(Math.abs(n));
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(storeKey));
    validateDataset(s.data);
    if (
      !s.decisions ||
      typeof s.decisions !== "object" ||
      !Number.isInteger(s.loadBps) ||
      s.loadBps < 0 ||
      s.loadBps > 10000
    )
      throw Error();
    return s;
  } catch {
    return { data: seed, decisions: {}, loadBps: 2000 };
  }
}
function download(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [state, setState] = useState(load),
    [page, setPage] = useState("review"),
    [month, setMonth] = useState(months[0]),
    [active, setActive] = useState("join:POS-101"),
    [query, setQuery] = useState(""),
    [choice, setChoice] = useState(""),
    [owner, setOwner] = useState(""),
    [note, setNote] = useState(""),
    [modal, setModal] = useState(null),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const f = forecast(state.data, state.decisions, month, state.loadBps),
    item = f.findings.find((i) => i.id === active) || f.findings[0],
    existing = item && decisionFor(state.data, state.decisions, item),
    allReviewed = f.pending.length === 0 && f.residualCents === 0;
  const projected =
    item && item.options.some((o) => o.value === choice)
      ? forecast(
          state.data,
          {
            ...state.decisions,
            [item.id]: {
              choice,
              owner: "Preview only",
              note: "Unrecorded source-choice preview.",
              fingerprint: fingerprint(state.data),
            },
          },
          month,
          state.loadBps,
        )
      : f;
  const related = item
    ? item.sourceIds
        .map((id) =>
          [...state.data.plan, ...state.data.ats, ...state.data.hris].find(
            (r) => r.id === id,
          ),
        )
        .filter(Boolean)
    : [];
  if (item?.type === "Unmapped offer" && choice !== "exclude") {
    const target = state.data.plan.find((p) => p.id === choice);
    if (target) related.push(target);
  }
  function persist(next) {
    setState(next);
    localStorage.setItem(storeKey, JSON.stringify(next));
  }
  function notify(t) {
    setToast(t);
    setTimeout(() => setToast(""), 2800);
  }
  function open(kind, value = "") {
    setError("");
    setText(value);
    setModal(kind);
  }
  useEffect(() => {
    setChoice(existing?.choice || item?.defaultChoice || "");
    setOwner(existing?.owner || "");
    setNote(existing?.note || "");
    setError("");
  }, [item?.id, existing?.recordedAt, fingerprint(state.data)]);
  useEffect(() => {
    if (!modal) return;
    const prior = document.activeElement,
      d = document.querySelector("[role=dialog]");
    d?.querySelector("button,input,textarea")?.focus();
    function key(e) {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const n = [
          ...d.querySelectorAll("button,a,input,select,textarea"),
        ].filter((x) => !x.disabled);
        if (e.shiftKey && document.activeElement === n[0]) {
          e.preventDefault();
          n.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === n.at(-1)) {
          e.preventDefault();
          n[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [modal]);
  function saveDecision(e) {
    e.preventDefault();
    try {
      const decisions = recordDecision(
        state.data,
        state.decisions,
        item.id,
        choice,
        owner,
        note,
      );
      persist({ ...state, decisions });
      notify("Decision recorded for this close. Source systems are unchanged.");
    } catch (err) {
      setError(err.message);
    }
  }
  function reopen(id) {
    const decisions = { ...state.decisions };
    delete decisions[id];
    persist({ ...state, decisions });
    notify("Exception reopened");
  }
  function sourceType(r) {
    return state.data.plan.includes(r)
      ? "Position plan"
      : state.data.ats.includes(r)
        ? "ATS"
        : "HRIS";
  }
  const readyCount = f.findings.length - f.pending.length;
  return (
    <>
      <header>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("review");
          }}
        >
          <span className="openroll-mark" />
          Openroll
        </a>
        <span className="header-divider" />
        <span className="product-label">Hiring handoff</span>
        <nav>
          {[
            ["review", "Review exceptions"],
            ["bridge", "Forecast bridge"],
            ["sources", "Source register"],
          ].map(([p, t]) => (
            <button
              key={p}
              className={page === p ? "selected" : ""}
              onClick={() => {
                setPage(p);
                setQuery("");
              }}
            >
              {t}
              {p === "review" && <span>{f.pending.length}</span>}
            </button>
          ))}
        </nav>
        <button
          className="button dark packet-button"
          onClick={() => setPage("packet")}
        >
          Close packet <ArrowUpRight size={13} />
        </button>
      </header>
      <main>
        <div className="breadcrumb">
          {state.data.workspace} <ChevronRight size={11} /> Workforce planning{" "}
          <ChevronRight size={11} />
          <span>November hiring cohort</span>
          <span className="prototype">
            Independent concept · Synthetic records
          </span>
        </div>
        <section className="page-title">
          <div>
            <div className="eyebrow">PEOPLE × FINANCE / MONTH-END HANDOFF</div>
            <h1>
              {page === "review"
                ? "One hire. One forecast line."
                : page === "bridge"
                  ? "A forecast you can explain."
                  : page === "sources"
                    ? "The records behind the numbers."
                    : "Ready for the finance handoff."}
            </h1>
            <p>
              {page === "review"
                ? "Reconcile the offer, the employee record, and the approved position before the forecast closes."
                : page === "bridge"
                  ? "Every movement from overlapping source records to the working forecast, tied to an explicit decision."
                  : page === "sources"
                    ? "Three fixed source snapshots. No live connectors, inferred identities, or changes to employee records."
                    : "Source choices, cost calculations, and review notes in one inspectable close packet."}
            </p>
          </div>
          <div className="period-control">
            <span>FORECAST MONTH</span>
            <select
              aria-label="Forecast month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </section>
        <div className="close-strip">
          <div className={"close-state " + (allReviewed ? "ready" : "")}>
            <span />
            {allReviewed ? "Ready for handoff" : "Working draft"}
            <b>
              {readyCount}/{f.findings.length} exceptions reviewed
            </b>
          </div>
          <div className="source-chips">
            <button
              onClick={() => {
                setPage("sources");
                setQuery("Plan");
              }}
            >
              <span className="source-symbol">P</span>Plan{" "}
              {state.data.plan.length}
            </button>
            <button
              onClick={() => {
                setPage("sources");
                setQuery("ATS");
              }}
            >
              <span className="source-symbol">A</span>ATS{" "}
              {state.data.ats.length}
            </button>
            <button
              onClick={() => {
                setPage("sources");
                setQuery("HRIS");
              }}
            >
              <span className="source-symbol">H</span>HRIS{" "}
              {state.data.hris.length}
            </button>
          </div>
          <button
            className="assumption-link"
            onClick={() => open("assumptions")}
          >
            <SlidersHorizontal size={12} />
            {state.loadBps / 100}% planning load
            <ChevronDown size={11} />
          </button>
        </div>
        <div className="forecast-summary">
          <div>
            <span>APPROVED PLAN BASIS</span>
            <strong>{usd(f.planTotalCents)}</strong>
            <small>{monthLabel(month)} · approved positions only</small>
          </div>
          <div className="working-total">
            <span>
              {allReviewed
                ? "REVIEWED COHORT FORECAST"
                : "PROPOSED COHORT FORECAST"}
            </span>
            <strong>
              {usd(f.totalCents)}
              <em>{f.pending.length ? "provisional" : "reviewed"}</em>
            </strong>
            <small>
              {f.activePositions} active forecast positions · includes planned
              vacancies
            </small>
          </div>
          <div>
            <span>VARIANCE TO PLAN</span>
            <strong>{signed(f.varianceCents)}</strong>
            <small>Same period, FTE, proration, and planning load</small>
          </div>
          <button className="trace-link" onClick={() => setPage("bridge")}>
            Trace every dollar <ArrowUpRight size={14} />
          </button>
        </div>
        {page === "review" && (
          <section className="workbench">
            <aside className="exception-list">
              <div className="list-title">
                EXCEPTIONS TO REVIEW<span>{f.findings.length}</span>
              </div>
              <div className="search-field">
                <Search size={13} />
                <input
                  aria-label="Search exceptions"
                  placeholder="Find a role or issue"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {f.findings
                .filter((i) =>
                  `${i.title} ${i.type} ${i.positionId || i.sourceIds[0]}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((i, index) => {
                  const done = decisionFor(state.data, state.decisions, i);
                  return (
                    <button
                      className={
                        "exception-item " + (item?.id === i.id ? "active" : "")
                      }
                      onClick={() => setActive(i.id)}
                      key={i.id}
                    >
                      <div>
                        <span className="mono">
                          {i.positionId || i.sourceIds[0]}
                        </span>
                        {done ? (
                          <span className="reviewed">
                            <Check size={10} />
                            Reviewed
                          </span>
                        ) : (
                          <span className="pending-dot">Review</span>
                        )}
                      </div>
                      <h3>{i.type}</h3>
                      <p>{i.title}</p>
                      <div className="exception-bottom">
                        <span>{i.sourceIds.length} source records</span>
                        <ChevronRight size={12} />
                      </div>
                    </button>
                  );
                })}
              <div className="list-foot">
                <GitMerge size={17} />
                <p>
                  A source choice changes this forecast. It never updates the
                  ATS, HRIS, or approved plan.
                </p>
              </div>
            </aside>
            {item ? (
              <>
                <article className="evidence-panel">
                  <div className="evidence-heading">
                    <span className="eyebrow">
                      {item.positionId || "POSITION LINK REQUIRED"} / SOURCE
                      RECONCILIATION
                    </span>
                    <h2>{item.title}</h2>
                    <p>{item.explanation}</p>
                  </div>
                  <div className="source-cards">
                    {related.map((r) => (
                      <section
                        className={
                          "source-card " +
                          (choice === r.id ||
                          (choice === r.id && item.type === "Unmapped offer")
                            ? "chosen"
                            : "")
                        }
                        key={r.id}
                      >
                        <div className="source-card-label">
                          <span className="source-symbol">
                            {sourceType(r).slice(0, 1)}
                          </span>
                          {sourceType(r)}
                          <span className="source-id">{r.id}</span>
                        </div>
                        {choice === r.id && (
                          <span className="source-selected">
                            <Check size={10} />
                            Selected for this preview
                          </span>
                        )}
                        <h3>{r.title}</h3>
                        <span
                          className={
                            "record-tag " +
                            (r.state === "frozen" ? "frozen" : "")
                          }
                        >
                          {r.status || r.state}
                        </span>
                        <dl>
                          <div>
                            <dt>Position ID</dt>
                            <dd>{r.positionId || r.id}</dd>
                          </div>
                          {r.personKey && (
                            <div>
                              <dt>Synthetic person key</dt>
                              <dd>{r.personKey}</dd>
                            </div>
                          )}
                          <div>
                            <dt>Effective start</dt>
                            <dd>{dateLabel(r.start)}</dd>
                          </div>
                          <div>
                            <dt>Annual base / FTE</dt>
                            <dd>
                              {usd(r.annualCents)} / {r.fteBps / 10000}
                            </dd>
                          </div>
                        </dl>
                        <button
                          onClick={() =>
                            open("record", JSON.stringify(r, null, 2))
                          }
                        >
                          Inspect source snapshot <ArrowUpRight size={11} />
                        </button>
                      </section>
                    ))}
                  </div>
                  {item.type === "Already joined" && (
                    <div className="identity-match">
                      <Link2 size={13} />
                      <span>
                        Explicit join: <code>{related[0]?.personKey}</code> +{" "}
                        <code>{item.positionId}</code>. Names and titles are not
                        used as identity matches.
                      </span>
                    </div>
                  )}
                  <div className="forecast-impact">
                    <span className="eyebrow">PREVIEW THIS SOURCE CHOICE</span>
                    <div>
                      <span>
                        Current working forecast
                        <strong>{usd(f.totalCents)}</strong>
                      </span>
                      <ArrowRight size={17} />
                      <span>
                        If this choice is recorded
                        <strong>{usd(projected.totalCents)}</strong>
                      </span>
                      <b>{signed(projected.totalCents - f.totalCents)}</b>
                    </div>
                    <p>
                      {projected.totalCents === f.totalCents
                        ? "No change to the current draft amount. Recording the source still resolves an exception."
                        : "The preview changes this local forecast only. Save a decision to include it in the close."}
                    </p>
                  </div>
                  <div className="line-calculation">
                    <div>
                      <span className="eyebrow">
                        COST BASIS / {monthLabel(month).toUpperCase()}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => setPage("bridge")}
                      >
                        Open position ledger <ArrowUpRight size={11} />
                      </button>
                    </div>
                    {(() => {
                      const positionId =
                          item.positionId ||
                          (choice !== "exclude" ? choice : null),
                        row = projected.details.find(
                          (r) => r.positionId === positionId,
                        );
                      return row ? (
                        <>
                          <div className="formula">
                            <span>
                              {usd(row.annualCents)} <small>annual base</small>
                            </span>
                            <b>÷ 12 ×</b>
                            <span>
                              {row.fteBps / 10000}
                              <small>FTE</small>
                            </span>
                            <b>×</b>
                            <span>
                              {row.activeDays}/{row.days}
                              <small>active calendar days</small>
                            </span>
                            <b>×</b>
                            <span>
                              {1 + state.loadBps / 10000}
                              <small>planning load</small>
                            </span>
                          </div>
                          <p>
                            Line result:{" "}
                            <strong>{precise(row.loadedCents)}</strong>. Round
                            base proration to cents first, then apply planning
                            load.
                          </p>
                        </>
                      ) : (
                        <p>
                          No cost line is included for this position under the
                          selected choice.
                        </p>
                      );
                    })()}
                  </div>
                </article>
                <aside className="decision-panel">
                  <div className="eyebrow">DECISION FOR THIS CLOSE</div>
                  <div className={"decision-state " + (existing ? "done" : "")}>
                    {existing ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Clock size={15} />
                    )}
                    <strong>
                      {existing ? "Decision recorded" : "Source choice needed"}
                    </strong>
                  </div>
                  <form onSubmit={saveDecision}>
                    <label>
                      Use in the cohort forecast
                      <select
                        aria-label="Source choice"
                        value={choice}
                        onChange={(e) => setChoice(e.target.value)}
                      >
                        {item.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Decision owner
                      <input
                        aria-label="Decision owner"
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        required
                        placeholder="Name or team"
                        maxLength={100}
                      />
                    </label>
                    <label>
                      Why this source?
                      <textarea
                        aria-label="Decision note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        required
                        placeholder="Record the source check or clarification behind your choice."
                        maxLength={2000}
                      />
                    </label>
                    {error && (
                      <p className="error" role="alert">
                        {error}
                      </p>
                    )}
                    <button type="submit" className="button dark wide">
                      <Check size={13} />
                      {existing ? "Update decision" : "Record decision"}
                    </button>
                  </form>
                  {existing && (
                    <div className="saved-note">
                      <span className="eyebrow">RECORDED LOCALLY</span>
                      <p>
                        {existing.owner}
                        <small>
                          {new Date(existing.recordedAt).toLocaleString(
                            "en-GB",
                          )}
                        </small>
                      </p>
                      <button
                        className="text-button"
                        onClick={() => reopen(item.id)}
                      >
                        <RotateCcw size={11} />
                        Reopen exception
                      </button>
                    </div>
                  )}
                  <div className="draft-rule">
                    <Info size={13} />
                    <p>
                      Unresolved drafts prefer HRIS, then ATS, then plan. Frozen
                      positions and unassigned offers stay excluded. These are
                      visible demo assumptions, not source authority.
                    </p>
                  </div>
                </aside>
              </>
            ) : (
              <div className="empty-state">
                <CheckCircle2 />
                <h2>No exceptions in these snapshots.</h2>
              </div>
            )}
          </section>
        )}
        {page === "bridge" && (
          <section className="bridge-layout">
            <article className="bridge-paper">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    SOURCE-TO-FORECAST RECONCILIATION
                  </span>
                  <h2>Nothing hidden in the total.</h2>
                  <p>
                    Each adjustment is the difference between its raw source
                    group and one reconciled position line.
                  </p>
                </div>
                <span className="bridge-status">
                  <CheckCircle2 size={13} />
                  {precise(f.residualCents)} unexplained
                </span>
              </div>
              <section className="budget-drivers">
                <div>
                  <span className="eyebrow">VARIANCE TO APPROVED PLAN</span>
                  <h3>Why the budget and forecast differ</h3>
                </div>
                {f.details
                  .filter((r) => r.varianceToPlanCents !== 0)
                  .map((r) => (
                    <div className="budget-driver" key={r.positionId}>
                      <span>
                        <strong>{r.title}</strong>
                        <small>
                          {r.positionId} · plan {dateLabel(r.plannedStart)} →{" "}
                          {r.source} {dateLabel(r.start)}
                        </small>
                      </span>
                      <div>
                        <small>PLAN</small>
                        <b>{usd(r.planCostCents)}</b>
                      </div>
                      <ArrowRight size={13} />
                      <div>
                        <small>FORECAST</small>
                        <b>{usd(r.loadedCents)}</b>
                      </div>
                      <strong>{signed(r.varianceToPlanCents)}</strong>
                    </div>
                  ))}
                {!f.details.some((r) => r.varianceToPlanCents !== 0) && (
                  <p className="no-variance">
                    Every approved position matches its planned period cost.
                  </p>
                )}
                <div className="budget-net">
                  <span>Net variance to approved plan</span>
                  <strong>{signed(f.varianceCents)}</strong>
                </div>
              </section>
              <div className="bridge-subheading">
                <h3>Reconcile the source records</h3>
                <span>Overlap removed, decisions retained.</span>
              </div>
              <div className="bridge-row starting">
                <span className="bridge-node" />
                <div>
                  <strong>Unreconciled source view</strong>
                  <p>
                    {f.rawRows.length} overlapping source and vacancy records
                  </p>
                </div>
                <b>{usd(f.rawTotalCents)}</b>
              </div>
              {f.bridge.map((b) => (
                <div className="bridge-row adjustment" key={b.id}>
                  <span className="bridge-node" />
                  <div>
                    <button
                      onClick={() => {
                        setActive(b.id);
                        setPage("review");
                      }}
                    >
                      {b.type}
                      <ArrowUpRight size={12} />
                    </button>
                    <p>
                      {decisionFor(state.data, state.decisions, b)
                        ? "Recorded choice · " +
                          decisionFor(state.data, state.decisions, b).choice
                        : "Draft assumption · not reviewed"}
                    </p>
                  </div>
                  <div className="bridge-bar">
                    <span
                      style={{
                        width:
                          Math.max(
                            (Math.abs(b.deltaCents) /
                              Math.max(f.rawTotalCents, 1)) *
                              160,
                            2,
                          ) + "%",
                      }}
                    />
                  </div>
                  <b>{signed(b.deltaCents)}</b>
                </div>
              ))}
              <div className="bridge-row ending">
                <span className="bridge-node" />
                <div>
                  <strong>
                    {allReviewed
                      ? "Reviewed cohort forecast"
                      : "Proposed cohort forecast"}
                  </strong>
                  <p>
                    {f.rows.length} approved position lines ·{" "}
                    {f.activePositions} active in period
                  </p>
                </div>
                <b>{usd(f.totalCents)}</b>
              </div>
              <div className="bridge-note">
                The raw view deliberately retains cross-system overlap.
                Reconciliation deltas are not cost savings. All rows use the
                same period and planning-load assumption.
              </div>
              <div className="ledger-heading">
                <h3>One line per approved position</h3>
                <span>USD · {state.loadBps / 100}% planning load</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>POSITION / TEAM</th>
                      <th>SOURCE</th>
                      <th>EFFECTIVE START</th>
                      <th>ACTIVE DAYS</th>
                      <th>PERIOD COST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.details.map((r) => (
                      <tr key={r.positionId}>
                        <td>
                          <b>{r.title}</b>
                          <small>
                            {r.positionId} · {r.team}
                          </small>
                        </td>
                        <td>
                          <span className="record-tag">{r.source}</span>
                          <small>{r.sourceId}</small>
                        </td>
                        <td>{dateLabel(r.start)}</td>
                        <td>
                          {r.activeDays}/{r.days}
                        </td>
                        <td className="money-cell">{precise(r.loadedCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
            <aside className="bridge-side">
              <span className="eyebrow">THE NEXT THREE MONTHS</span>
              <h2>
                Timing matters.
                <br />
                <span>Keep it visible.</span>
              </h2>
              {months.map((m) => {
                const v = forecast(
                  state.data,
                  state.decisions,
                  m,
                  state.loadBps,
                );
                return (
                  <button
                    className={"month-card " + (month === m ? "active" : "")}
                    onClick={() => setMonth(m)}
                    key={m}
                  >
                    <span>{monthLabel(m)}</span>
                    <strong>{usd(v.totalCents)}</strong>
                    <small>{signed(v.varianceCents)} vs approved plan</small>
                  </button>
                );
              })}
              <button
                className="button dark wide"
                onClick={() => setPage("packet")}
              >
                Review close packet <ArrowUpRight size={13} />
              </button>
              <button
                className="text-button"
                onClick={() => open("assumptions")}
              >
                Inspect model assumptions <Settings2 size={12} />
              </button>
            </aside>
          </section>
        )}
        {page === "sources" && (
          <section className="register">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  SNAPSHOTS AS OF {state.data.asOf}
                </span>
                <h2>Plan, ATS, and HRIS. Side by side.</h2>
                <p>
                  Edits create a new local snapshot and invalidate existing
                  source decisions.
                </p>
              </div>
              <button
                className="button outline"
                onClick={() =>
                  open("edit", JSON.stringify(state.data, null, 2))
                }
              >
                Edit synthetic snapshots <FileText size={13} />
              </button>
            </div>
            <div className="search-field register-search">
              <Search size={14} />
              <input
                aria-label="Search source records"
                placeholder="Filter by source, reference, or role"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SOURCE / REFERENCE</th>
                    <th>POSITION</th>
                    <th>ROLE</th>
                    <th>STATUS</th>
                    <th>EFFECTIVE START</th>
                    <th>ANNUAL BASE</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {["Plan", "ATS", "HRIS"]
                    .flatMap((type, i) =>
                      state.data[["plan", "ats", "hris"][i]].map((r) => ({
                        ...r,
                        type,
                      })),
                    )
                    .filter((r) =>
                      `${r.type} ${r.id} ${r.positionId} ${r.title}`
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <b>{r.type}</b>
                          <small>{r.id}</small>
                        </td>
                        <td>{r.positionId || r.id}</td>
                        <td>{r.title}</td>
                        <td>
                          <span
                            className={
                              "record-tag " +
                              (r.state === "frozen" ? "frozen" : "")
                            }
                          >
                            {r.status || r.state}
                          </span>
                        </td>
                        <td>{dateLabel(r.start)}</td>
                        <td>{usd(r.annualCents)}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={"Inspect " + r.id}
                            onClick={() =>
                              open("record", JSON.stringify(r, null, 2))
                            }
                          >
                            <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {page === "packet" && (
          <section className="packet-layout">
            <article className="packet-paper">
              <div className="paper-header">
                <span className="brand">Openroll</span>
                <span>HIRING COHORT / FINANCE HANDOFF</span>
              </div>
              <span className="eyebrow">
                {state.data.workspace.toUpperCase()} · SNAPSHOT{" "}
                {state.data.asOf}
              </span>
              <h2>November hiring handoff</h2>
              <p className="paper-subtitle">
                Three months of position-level forecast evidence.
              </p>
              <div className={"packet-status " + (allReviewed ? "ready" : "")}>
                <span />
                {allReviewed
                  ? "All source exceptions reviewed"
                  : "Draft packet · decisions still required"}
                <b>
                  {readyCount}/{f.findings.length}
                </b>
              </div>
              <div className="packet-totals">
                {months.map((m) => {
                  const v = forecast(
                    state.data,
                    state.decisions,
                    m,
                    state.loadBps,
                  );
                  return (
                    <div key={m}>
                      <small>{monthLabel(m)}</small>
                      <strong>{usd(v.totalCents)}</strong>
                      <span>{signed(v.varianceCents)} vs plan</span>
                    </div>
                  );
                })}
              </div>
              <h3>Recorded source decisions</h3>
              {f.findings.map((i) => {
                const r = decisionFor(state.data, state.decisions, i);
                return (
                  <section className="packet-decision" key={i.id}>
                    <div>
                      <span className="record-tag">
                        {i.positionId || i.sourceIds[0]}
                      </span>
                      <h4>{i.type}</h4>
                      {r ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                    </div>
                    <p>
                      {r
                        ? r.note
                        : "Awaiting a recorded source choice. Draft assumptions remain visible in the review."}
                    </p>
                    <small>
                      {r
                        ? `${r.owner} · ${r.choice} · ${new Date(r.recordedAt).toLocaleString("en-GB")}`
                        : "Not reviewed"}
                    </small>
                  </section>
                );
              })}
              <div className="packet-assumptions">
                <h3>Model assumptions</h3>
                <p>
                  USD only. Annual base ÷ 12, multiplied by FTE and active
                  calendar days in the month, with an inclusive start date. Base
                  cost rounds to cents before applying a {state.loadBps / 100}%
                  planning load. That load is an illustrative cost assumption,
                  not a statutory tax rate.
                </p>
                <p>
                  Scope: this synthetic hiring cohort, including approved vacant
                  roles. This is not company-wide actual payroll or an
                  instruction to change a people system.
                </p>
              </div>
            </article>
            <aside className="packet-side">
              <span className="eyebrow">THE AUDIT TRAIL TRAVELS WITH IT</span>
              <h2>
                A number is better
                <br />
                with its source.
              </h2>
              <p>
                The packet includes every input snapshot, position calculation,
                bridge adjustment, and recorded source decision.
              </p>
              <button
                className="button dark wide"
                disabled={!allReviewed}
                onClick={() => {
                  try {
                    download(
                      "northstar-hiring-handoff.json",
                      JSON.stringify(
                        closePacket(state.data, state.decisions, state.loadBps),
                        null,
                        2,
                      ),
                      "application/json",
                    );
                    notify("Close packet export prepared");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                <Download size={14} />
                Export close packet
              </button>
              <button
                className="button outline wide"
                disabled={!allReviewed}
                onClick={() => {
                  const p = closePacket(
                    state.data,
                    state.decisions,
                    state.loadBps,
                  );
                  download(
                    "northstar-forecast.csv",
                    forecastCsv(p),
                    "text/csv",
                  );
                  notify("Position forecast CSV export prepared");
                }}
              >
                Export position CSV <Download size={13} />
              </button>
              {!allReviewed && (
                <div className="export-reason">
                  <Clock size={14} />
                  <p>
                    {f.pending.length} source exceptions need a recorded
                    decision before export.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setActive(f.pending[0]?.id);
                      setPage("review");
                    }}
                  >
                    Continue the review <ArrowRight size={12} />
                  </button>
                </div>
              )}
              <div className="packet-footnote">
                <CheckCircle2 size={15} />
                <p>
                  Source snapshots are retained exactly as provided. Decisions
                  affect this local forecast only.
                </p>
              </div>
              <button className="text-button" onClick={() => open("about")}>
                About this concept <ArrowUpRight size={12} />
              </button>
            </aside>
          </section>
        )}
        <footer>
          <span>OPENROLL / HIRING HANDOFF</span>
          <p>Built by C Abhineeth · Independent product concept</p>
          <button onClick={() => open("about")}>
            Method & scope <ArrowUpRight size={11} />
          </button>
        </footer>
      </main>
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === "assumptions"
                ? "Model assumptions"
                : modal === "edit"
                  ? "Edit synthetic snapshots"
                  : "Source and method"
            }
            className="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-top">
              <span className="eyebrow">
                {modal === "assumptions"
                  ? "MODEL ASSUMPTIONS"
                  : modal === "edit"
                    ? "SYNTHETIC SOURCE EDITOR"
                    : modal === "about"
                      ? "INDEPENDENT CONCEPT"
                      : "SOURCE SNAPSHOT"}
              </span>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            {modal === "assumptions" ? (
              <>
                <h2>Make the assumptions visible.</h2>
                <p>
                  Proration uses actual calendar days, including the effective
                  start date. FTE is expressed in basis points. Each line rounds
                  base cost to cents before applying the planning load.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(new FormData(e.currentTarget).get("load"));
                    if (!Number.isInteger(n) || n < 0 || n > 100) {
                      setError("Use a whole percentage from 0 to 100.");
                      return;
                    }
                    persist({ ...state, loadBps: n * 100 });
                    setModal(null);
                    notify("Forecast recalculated with the new planning load");
                  }}
                >
                  <label>
                    Illustrative planning load (%)
                    <input
                      name="load"
                      type="number"
                      min="0"
                      max="100"
                      required
                      defaultValue={state.loadBps / 100}
                    />
                  </label>
                  <div className="method-note">
                    Unresolved records use HRIS, then ATS, then plan. Frozen
                    positions and unmatched offers are excluded. Approved
                    unfilled positions remain as planned vacancies. Decisions
                    identify the source for this close; they do not establish
                    source authority.
                  </div>
                  {error && (
                    <p role="alert" className="error">
                      {error}
                    </p>
                  )}
                  <button className="button dark" type="submit">
                    Apply to forecast <Check size={13} />
                  </button>
                </form>
              </>
            ) : modal === "about" ? (
              <>
                <h2>
                  Close the handoff.
                  <br />
                  Keep the source trail.
                </h2>
                <p>
                  Openroll's public platform connects people and finance systems
                  and emphasizes headcount, budget variance, and auditable
                  analysis. This concept explores the narrower reconciliation
                  between accepted offers, employee starts, and approved
                  position costs.
                </p>
                <p>
                  All roles, person keys, source records, and company data in
                  this project are synthetic. Matching uses explicit position
                  IDs and synthetic person keys, not inferred identities. This
                  browser-local prototype has no live connector and does not
                  update employment, compensation, or payroll records.
                </p>
                <a
                  className="text-button"
                  href="https://www.openroll.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Openroll's current platform <ArrowUpRight size={13} />
                </a>
              </>
            ) : (
              <>
                <h2>
                  {modal === "edit"
                    ? "Review a different snapshot."
                    : "Inspect the original record."}
                </h2>
                <p>
                  {modal === "edit"
                    ? "Use the existing schema and SYN- person keys. Saving a changed snapshot makes prior source decisions stale."
                    : "This is the source value used by the local model. No source system is queried."}
                </p>
                <textarea
                  className="json-editor"
                  aria-label="Source JSON"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  readOnly={modal !== "edit"}
                  spellCheck="false"
                />
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                {modal === "edit" && (
                  <button
                    className="button dark"
                    onClick={() => {
                      try {
                        if (text.length > 70000)
                          throw Error(
                            "Keep the synthetic snapshots under 70 KB.",
                          );
                        const data = validateDataset(JSON.parse(text));
                        persist({ ...state, data });
                        setModal(null);
                        notify(
                          "New snapshots loaded. Source decisions require review.",
                        );
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Load synthetic snapshots <ArrowRight size={13} />
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
