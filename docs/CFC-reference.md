# Siemens CFC — Technical Reference (for CFC Studio)

This is the domain reference the simulator's block library is built against. It
covers the CFC execution model, block semantics, data types, file formats, and
the PPCL→CFC migration map.

> **Sourcing honesty.** Much of the building-automation (Desigo/PXC) detail is
> guarded behind Siemens' SID portal and was not verbatim-retrievable. Facts
> below are marked **[Confirmed]** (seen in Siemens/vendor documentation) or
> **[Inferred]** (standard IEC 61131-3 / SIMATIC CFC behaviour applied where the
> exact Desigo spec wasn't public). Where a block's exact Desigo pin table isn't
> public, CFC Studio implements the documented SIMATIC CFC / IEC equivalent —
> CFC is an FBD superset, so these are faithful starting points. **Verify pin
> tables against the official PDFs (linked at the end) before treating any block
> as authoritative.**

"CFC" spans two related worlds that share the paradigm, editor lineage,
run-sequence model and feedback handling, but differ in runtime and exact block
library:

- **SIMATIC / PCS 7 CFC** (STEP 7 / TIA Portal) — very well documented publicly;
  the source of most exact block names below.
- **Building-automation CFC** — the graphical chart language in **ABT Site** for
  **Desigo PXC4/5/7** (BACnet controllers), and the legacy CFC editor in Desigo
  XWorks Plus for Desigo PX. Sparsely documented publicly. The PID block here is
  **`LOOP`** — the direct successor to PPCL's `LOOP` statement.

---

## 1. Execution model

- CFC is a **graphical FBD-based language, a superset of IEC 61131-3 FBD**
  (not itself part of the standard). Blocks are placed freely and their pin
  interconnections form a data-flow graph. **[Confirmed]**
- Every block carries a **run-sequence number** setting its position in the
  cyclic solve; a *Run Sequence* editor exposes and reorders it. New blocks
  insert relative to a predecessor pointer. **[Confirmed — SIMATIC CFC]**
- The chart is **re-solved continuously/cyclically**. On SIMATIC this is a
  cyclic-interrupt OB (default OB35 = 100 ms), with per-block scan-rate
  reduction (run every Nth cycle). **[Confirmed — SIMATIC]** PXC panels are
  BACnet controllers with their own firmware scheduler; **no public PXC CFC
  solve-interval figure was found — [Gap]**. CFC Studio uses a configurable
  fixed cycle (default 100 ms wall / scalable sim-dt).
- **Feedback loops** are legal. The engineer designates a loop-start block
  ("Set Start of Feedback"); the loop-closing wire then carries the **previous
  cycle's value** (a one-scan z⁻¹ delay), avoiding an algebraic loop.
  **[Confirmed for CODESYS/Beckhoff CFC; Inferred for Siemens]** — this is
  exactly what CFC Studio's solver implements.
- **EN / ENO**: every elementary block has an `EN` input (block runs only when
  `EN`=1, default 1 if open) and an `ENO` output (1 = valid result, 0 =
  disabled or error). **[Confirmed]**

### CFC vs PPCL

Both are continuously re-solved. **PPCL** is line-numbered and imperative:
lines run in ascending order, wrap at the end, repeat; flow is controlled with
`GOTO` (jump forward to avoid infinite loops). **CFC** derives order from data
flow + a tool-managed run sequence, with explicit feedback break-points — no
source-line order. **[Confirmed PPCL side]**

---

## 2. Block catalog

Universal pins on elementary blocks: **`EN`** (BOOL enable), **`ENO`** (BOOL
valid). Implemented in CFC Studio via `engine/blocks/elementary.ts`.

### Math — `MATH_FP` (REAL), `MATH_INT` (INT) [Confirmed names]
`ADD_R SUB_R MUL_R DIV_R` and `ADD_I SUB_I MUL_I DIV_I` (`<OP>_<type>`).
Math functions on REAL: `ABS_R SQRT EXP LN LOG10 POW10 SIN COS TAN`.
`SUB` does IN1−IN2; `DIV` does IN1/IN2. CFC Studio sets `ENO`=0 on `DIV_R` by
zero, `SQRT`/`LN`/`LOG10` of non-positive input.

### Logic — `BIT_LGC` [Confirmed]
`AND OR XOR NAND NOR NOT`, multi-input `IN1..INn → OUT`.

### Compare — `COMPARE` family [Confirmed]
`CMP_I CMP_DI CMP_R CMP_T`. **One comparator compares IN1/IN2 and exposes all
six relations simultaneously** — `GT GE EQ NE LE LT` — not separate GT/LT
blocks. CFC Studio implements `CMP_R` and `CMP_I` this way.

### Selectors / multiplexers / limiters — `MULTIPLX`, `MATH_FP` [Confirmed names]
`SEL_BO SEL_R` (1-of-2, selector K), `MUXn_BO MUXn_R` (1-of-n), `MAXn_R MINn_R`
(extremum of n), `LIM_R` (clamp between low/high). Pin names like `LIM_R`'s
`HI_LIM`/`LO_LIM` and `SEL`'s `K` are **[Inferred]** from convention.

### Flip-flops — [Confirmed]
`RS_FF` (reset-dominant, R wins), `SR_FF` (set-dominant, S wins). Inputs S, R;
output Q. Edge detectors `R_TRIG`/`F_TRIG` are IEC standard.

### Timers — IEC TP/TON/TOF (+ TONR retentive) [Confirmed]
Pins `IN` (BOOL), `PT` (preset time), `Q` (BOOL), `ET` (elapsed). `TONR` adds
`R` (reset) and accumulates across pulses.

### Counters — IEC [Confirmed]
`CTU` (CU,R,PV→Q,CV), `CTD` (CD,LD,PV→Q,CV), `CTUD` (CU,CD,R,LD,PV→QU,QD,CV).

### Control loops — PID
- **SIMATIC `CONT_C`** (SFB 41) — continuous position PID, parallel P/I/D each
  individually enabled. Key pins: `SP_INT` (setpoint), `PV_IN` (process value),
  `MAN`/`MAN_ON` (manual), `GAIN` (Kp), `TI` (reset time), `TD` (derivative
  time), `TM_LAG` (D lag), `DEADB_W` (deadband), `LMN_HLM`/`LMN_LLM` (output
  limits) → `LMN` (output), `QLMN_HLM`/`QLMN_LLM` (at-limit flags). Output
  scaling `LMN = LMN·LMN_FAC + LMN_OFF`. Defaults TD=10 s, TM_LAG=2 s.
  **[Confirmed]** Companions: `CONT_S` (step PID for motorized valves),
  `PULSEGEN` (PWM). APL: `PIDConL`/`PIDConR`.
- **Building-automation `LOOP`** — universal PID (P/PI/PD/PID) with external
  tracking, direct/reverse acting, modulating output. The block PXC/PPCL users
  actually use. Tuning in the European convention: **`Kp`** (gain) or **`Pb`**
  (proportional band), **`Tn`** (reset/integral time), **`Tv`** (derivative
  time); `W`=setpoint, `X`=process value, `Y`=output. Exact PXC pin names are
  **[Inferred]**. CFC Studio's `LOOP` models this: `W X TRK TRKV → Y E`, params
  `Kp Tn Tv action Ymin Ymax`, ideal form with derivative-on-measurement,
  conditional-integration anti-windup, and bumpless tracking.

### Signal conditioning — PCS 7 `*_P` [Confirmed names]
`RAMP_P` (ramp), `INT_P` (integrator), `DIF_P` (differentiator), `PT1_P`
(first-order lag), `POLYG_P` (piecewise-linear characteristic), `DEADBAND`,
`DEADTIME`. CFC Studio implements `INT_P DIF_P PT1_P RAMP_P` plus a 2-position
`HYST` controller (convenience).

### HVAC / psychrometric — [Confirmed they exist, names Gap]
ABT Site's library (advertised "250+ blocks") includes enthalpy/wet-bulb/
dew-point/economizer, heating curves, optimum start/stop, load shedding,
sequencers. Exact names weren't public. Implement from standard psychrometrics
when added (e.g. h ≈ 1.006·T + W·(2501 + 1.86·T)).

---

## 3. Data types

CFC pins use SIMATIC elementary types: **BOOL, BYTE, WORD, DWORD, INT, DINT,
REAL, TIME** (CFC Studio models BOOL / INT / REAL). **Connections require
compatible types** — you cannot wire BOOL straight into a REAL pin; a
**CONVERT** block is required (`R_I`, `I_R`, `I_DI`, …; BOOL↔REAL normally via
an INT intermediate). **[Confirmed]**

Desigo logical points: **LAI/LAO** (analog in/out, REAL), **LDI/LDO** (digital
in/out, BOOL), mapping to BACnet objects **AI/AO/BI/BO/AV/BV/MV** (M\*=
multistate, \*V = virtual/calculated points). **[Confirmed]**

---

## 4. File formats

- **ABT Site** projects transfer via **Pack & Go / Pack & Return**
  (`*.ABTReturn`). No public open-project schema. **[Confirmed extension]**
- **Desigo CC** import/export via **`*.s1x`** plus CSV/JSON point import; schema
  not public. **[Confirmed]**
- **CFC chart XML export** (ABT/TIA) is **lossy** — it omits block types, task
  settings and the run sequence — so an importer must reconstruct execution
  order. **[Confirmed]**
- **SIMATIC CFC**: charts → XML, I/Os → CSV, TIA Openness / Version Control
  Interface → XML/SCL, project archive `*.zap*`. **[Confirmed]**
- **No fully round-trippable open format** exists for BA CFC programs; the
  richest public path is SIMATIC CFC's TIA-Openness XML. **[Confirmed]**

---

## 5. PPCL → CFC migration map

PPCL commands are **[Confirmed]** (APOGEE PPCL manual 125-1896); CFC equivalents
are a practical mapping (**[Inferred]** — Siemens publishes no automated
transpiler; migration is manual reprogramming).

| PPCL | CFC equivalent |
|---|---|
| Line numbers + ascending execution | Run sequence / sequence numbers |
| `GOTO` / `GOSUB` / `RETURN` | No direct equivalent — restructure as `EN` gating + subcharts |
| `IF/THEN/ELSE`, `.GT./.LT./.EQ.`… | `CMP_R` (six relation outs) → `SEL_R`/`SEL_BO` or block `EN` |
| `.AND./.OR./.NAND./.XOR.` | `AND` `OR` `NAND` `XOR` |
| `+ − * /` | `ADD_R` `SUB_R` `MUL_R` `DIV_R` |
| `SQRT EXP LOG SIN COS TAN` | `SQRT` `EXP` `LN`/`LOG10` `SIN` `COS` … |
| `LOOP` (PID) | `LOOP` (BA) / `CONT_C` (SIMATIC) |
| `MIN` / `MAX` | `MINn_R` / `MAXn_R` |
| `TABLE` (curve lookup) | `POLYG_P` |
| `SAMPLE` (throttle eval) | Per-block scan-rate reduction + `PT1_P` |
| `TIMAVG` | `PT1_P` / averaging |
| `DC` / `DCR` (duty cycle) | `TP`/`TON`/`TOF` + scheduler |
| `SSTO`/`SSTOCO` (optimum start/stop) | Optimum start/stop HVAC block |
| `ROTATE` / `RUNTIME` (lead/lag) | Sequencer/rotation block, or counter+compare |
| `ON/OFF/SET/ACT/DEACT/STATE` | I/O point writes + BACnet priority |
| `ENABLE` / `DISABL` | Block `EN` |
| `ALARM`/`HLIMIT`/`LLIMIT` | BACnet alarming/limit objects |
| `PDL` (peak demand limit) | Load-shedding HVAC block |
| `TOD/HOLIDA/DAY/NIGHT` | BACnet Schedule/Calendar |
| `$LOC*`, `$ARG*`, `LOCAL`, `DEFINE` | CFC internal connectors / chart I/O |
| `@EMER/@OPER/@PDL/@SMOKE` priorities | BACnet priority array |

> Terminology: Siemens also calls the BA function-block language **DMAP**
> (Desigo Modular Application Programming); PPCL is the legacy APOGEE-US
> language. Users may say either.

---

## Primary sources (verify directly)

- SIMATIC CFC for S7 manual — `CFC_for_S7_e.pdf`
- SIMATIC CFC Elementary Blocks — `s7jbib_b_en-US.pdf`
- Standard PID Control (CONT_C/CONT_S/PULSEGEN) — `Stdpid_e.pdf`
- S7-1500 PID Control function manual
- STEP 7 CFC V18 manual (run sequence, hierarchy)
- PCS 7 Standard Library V71 (RAMP_P/INT_P/PT1_P/CTRL_PID)
- APOGEE PPCL User's Manual 125-1896
- Desigo PXC4/5/7 product pages (ABT Site CFC programming) — behind SID portal
- Desigo CC `LOOP` block EngineeringHelp

All hosted under `cache.industry.siemens.com` / `support.industry.siemens.com` /
the Siemens SID & Desigo help portals.
