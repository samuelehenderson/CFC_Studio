# PPCL Reference (as implemented by this simulator)

This is a working reference for the PPCL constructs the simulator supports, and —
importantly — **how each is modeled here**, with explicit `[VERIFY]` flags where
the behavior is a best-effort guess that should be confirmed against the official
the APOGEE **PPCL User's Manual**.

> The official manual now lives in the repo at
> **`docs/reference/ppcl-users-manual.md`**. The semantics below for LOOP,
> TABLE, SAMPLE, and SET have been reconciled against it. Remaining `[VERIFY]`
> flags are the parts the manual describes qualitatively (e.g. the LOOP integral
> update units) where an exact digital formula isn't given.

---

## Program structure & the scan model

- Every statement is prefixed by a line number; statements run top-to-bottom.
- `GOTO n` redirects flow. **Forward** GOTOs (skip-arounds, decision trees) work
  as you'd expect.
- **Loop-back = end of scan.** A `GOTO` to a line already executed this scan
  (e.g. a trailing `GOTO 100` returning to the top) is treated as the program's
  main-loop point: one trip around the loop == one scan. This matches the common
  APOGEE idiom of a continuous main loop paced by the controller. **[VERIFY]** —
  and note the limitation: a *bounded intra-scan* loop (e.g. an averaging
  countdown using a backward GOTO) will run only one iteration per scan here.
- A per-scan instruction cap (default 10,000) remains as a runaway backstop.

## Comments

- `C <text>` — with or without a line number. Un-numbered `C` lines are skipped.

## Point names

- Quoted, dotted names: `"GVL.B1.AHU65.SF1.STS"`. The quotes delimit a single
  point reference whose name contains dots.
- `$`-prefixed names (`$LOC11`, `$OAFALM`) are **virtual/local** points.
- Names are case-insensitive (normalized internally).

## Macros — `DEFINE` / `%X%`

- `DEFINE(X,"GVL.B1.AHU65.")` defines macro `X`.
- `%X%` is substituted with the macro value everywhere **before** parsing, so
  `"%X%CCV"` becomes `"GVL.B1.AHU65.CCV"`. `DEFINE` itself is a runtime no-op.

## Operators

- Arithmetic `+ - * /`, parentheses.
- Comparison (dotted): `.GT. .LT. .EQ. .NE. .GE. .LE.`
- Logical (dotted): `.AND. .OR. .NOT.`
- Digital logic: nonzero = true; comparisons/logicals yield 1/0.

## Named constants

| Constant | Value | Notes |
|----------|-------|-------|
| `OFF`    | 0     | |
| `ON`     | 1     | |
| `PRFON`  | 1     | "proof on". **[VERIFY]** some firmware separates commanded (1) from proven (e.g. 2). |
| `PRFOFF` | 0     | **[VERIFY]** |

## Expression functions

`ABS(x)`, `SQRT(x)`, `ROOT(x)` (≈ sqrt, **[VERIFY]**), `MIN(a,…)`, `MAX(a,…)`,
`AVG(a,…)`, `ONPWRT()` (1 on the first scan after start/reset, else 0).

## System time points (read-only)

`TIME` (decimal hours, 14.5 = 2:30pm), `TIMEOFDAY`, `SECND`, `CRTIME` (HHMM int,
**[VERIFY]**), `DAYOTWK` (1=Sun…7=Sat, **[VERIFY]**), `DAYOTYR`, `MONTH`, `DATE`,
`YEAR`.

## Statements (commands)

| Statement | Form | Modeled behavior | Flag |
|-----------|------|------------------|------|
| Assignment | `<pt> = <expr>` | write expr to point | |
| `ON` / `OFF` | `ON(pt)` / `OFF(pt)` | set digital 1 / 0 | |
| `SET` | `SET(value, pt1, …, pt15)` | write `value` to every listed point (value first) | |
| `MIN` / `MAX` | `MIN(dest, a, b, …)` | dest = min/max(rest) | |
| `IF … THEN … ELSE …` | condition may be parenthesized; THEN/ELSE are statements or `GOTO n` | branch | |
| `GOTO` | `GOTO n` (or bare `n` after THEN) | jump | |
| `GOSUB` | `GOSUB n [pt1,…,pt15]` (parens optional) | call subroutine at line `n`; passed points bind to `$ARG1…$ARGn` (alias — reads *and* writes pass through); `RETURN` resumes after the GOSUB. Real call stack; same sub may be called many times per scan. | nested `$ARG`→`$ARG` passing [VERIFY] |
| `RETURN` | `RETURN` | end of subroutine; pop back to the line after the GOSUB | |
| `SAMPLE` | `SAMPLE(n) <stmt>` | run `<stmt>` only every `n` seconds of sim time | |
| `LOCAL` | `LOCAL(name)` | declare a local point (also auto-discovered) | [VERIFY: `$` naming] |
| `DEFINE` | `DEFINE(name,"prefix")` | macro (no-op at runtime) | |
| `TABLE` | `TABLE(in, out, x1,y1, …, x7,y7)` | piecewise-linear interpolation; x ascending; input below x1 → y1, above last x → last y. Matches the manual. | |
| `LOOP` | `LOOP(type, pv, cv, sp, pg, ig, dg, st, bias, lo, hi, 0)` | `type` 0=direct/128=reverse; `Kp = pg/1000`; output = `bias + Kp·error (+ I)`, clamped to `[lo,hi]`; sampled every `st` s | I/D term scaling [VERIFY] |

### Manual-confirmed vs still approximate

- **`TABLE`** ✓ matches the manual (ascending x, endpoint clamping, straight-
  line interpolation).
- **`SAMPLE(n)`** ✓ matches — runs on the first execution after a load/power-up,
  then every *n* seconds; cannot wrap a self-timed command (LOOP/WAIT/…).
- **`SET`** ✓ commands one value to up to 15 points. (The manual also sets those
  points' priority to NONE; this sim writes the value at program priority and
  does not yet model the full BACnet priority array.)
- **`LOOP`** — signature, `Kp = pg/1000`, bias, direct/reverse action, output
  limits, and the `st` sample gate are faithful. **[VERIFY]** the integral-gain
  (`ig`) digital update units and the derivative term: the manual gives
  starting-point formulas (`ig = pg·0.02`) but not an exact per-sample update,
  so the I term here is a best-effort accumulator with anti-windup, and the
  derivative term is not yet applied.
- **`PRFON`/`ON`/`OFF`** are *status indicators* in the manual (they compare a
  point's operational status). This sim maps them to digital values
  (`OFF`=0, `ON`=1, `PRFON`=1); the richer status set (FAILED, HAND, DAYMOD, …)
  is not yet modeled.
- **`LOCAL(NAME)` vs `$NAME`** — `LOCAL(OAFALM)` is declared but referenced as
  `"$OAFALM"`; currently treated as distinct names. [VERIFY] the `$` convention.

## Point modeling (relinquish defaults)

- Commandable points (`AO/DO/LAO/LDO`) carry a **relinquish default**.
- **Default: HOLD.** Points keep their value across scans (faithful to real
  PPCL — timers/accumulators rely on this). Auto-relinquish (reset to the
  relinquish default at the start of each scan) is **opt-in per point** via the
  Point Config box.
- **Operator command + release:** commanding a point pins it (status MANUAL)
  above the program until released; program writes and auto-relinquish are
  blocked while commanded.
