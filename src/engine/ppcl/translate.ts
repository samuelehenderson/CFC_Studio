/**
 * PPCL → CFC translation analyzer (teaching aid, NOT an automated transpiler).
 *
 * Siemens publishes no PPCL→CFC converter; migration is manual. This analyzer
 * reads PPCL line-by-line, recognises the constructs, and shows the CFC block
 * equivalent for each — flagging the ones (GOTO loop-back, GOSUB) that don't
 * map to data flow and need rethinking.
 *
 * Construct coverage and semantics follow docs/reference/ppcl-reference.md
 * (an APOGEE PPCL reference reconciled against the official PPCL User's Manual):
 * quoted dotted point names, DEFINE/%X% macros, the LOOP(type,pv,cv,sp,pg,ig,
 * dg,st,bias,lo,hi,0) signature with Kp = pg/1000 and type 0/128 = direct/
 * reverse, SET/GOSUB/SAMPLE/TABLE/MIN/MAX/ONPWRT and the scan model.
 */

export type MapStatus = 'ok' | 'manual' | 'info' | 'comment';

export interface MapResult {
  line: number; // 1-based source line
  ppcl: string; // original text
  cfc: string; // CFC equivalent (human description)
  blocks: string[]; // CFC block types involved
  note?: string;
  status: MapStatus;
}

interface Rule {
  test: RegExp; // tested against the body (line-number stripped, upper-cased)
  map: (body: string, raw: string) => { cfc: string; blocks: string[]; note?: string; status?: MapStatus };
}

/** Detect arithmetic / relational / logical operators + functions present. */
function exprBlocks(body: string): string[] {
  const b = new Set<string>();
  if (/\.AND\./.test(body)) b.add('AND');
  if (/\.OR\./.test(body)) b.add('OR');
  if (/\.NOT\./.test(body)) b.add('NOT');
  if (/\.GT\.|\.GE\.|\.LT\.|\.LE\.|\.EQ\.|\.NE\./.test(body)) b.add('CMP_R');
  if (/\bSQRT\b|\bROOT\b/.test(body)) b.add('SQRT');
  if (/\bABS\b/.test(body)) b.add('ABS_R');
  if (/\bMIN\b/.test(body)) b.add('MIN_R');
  if (/\bMAX\b/.test(body)) b.add('MAX_R');
  if (/\bAVG\b/.test(body)) b.add('AVG');
  if (/\+/.test(body)) b.add('ADD_R');
  if (/(?:\)|\w|")\s*-\s*(?:\(|\w|")/.test(body)) b.add('SUB_R');
  if (/\*/.test(body)) b.add('MUL_R');
  if (/\//.test(body)) b.add('DIV_R');
  return [...b];
}

/** Split the comma-separated args of the first FUNC(...) found. */
function args(body: string, fn: string): string[] {
  const m = new RegExp(fn + '\\s*\\(([^)]*)\\)', 'i').exec(body);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim());
}

const RULES: Rule[] = [
  {
    test: /\bDEFINE\s*\(/,
    map: () => ({
      cfc: 'Macro definition — expanded (%X%) before parsing; no runtime block.',
      blocks: [],
      note: 'DEFINE(X,"prefix") just text-substitutes %X%. In CFC, reuse is a subchart or naming convention.',
      status: 'info',
    }),
  },
  {
    test: /\bLOOP\s*\(/,
    map: (body) => {
      const a = args(body, 'LOOP'); // type,pv,cv,sp,pg,ig,dg,st,bias,lo,hi,0
      const reverse = a[0] === '128';
      const kp = a[4] ? `Kp=${a[4]}/1000` : 'Kp=pg/1000';
      const detail =
        a.length >= 11
          ? `PV ${a[1]}→X, SP ${a[3]}→W, output ${a[2]}→Y; ${kp}; ${reverse ? 'REVERSE' : 'DIRECT'} acting; bias ${a[8]}; limits [${a[9]}, ${a[10]}]; sample ${a[7]}s.`
          : 'Map type→action (0 direct/128 reverse), pv→X, sp→W, cv→Y, Kp=pg/1000, bias, [lo,hi] limits, st sample time.';
      return {
        cfc: 'LOOP (BA PID) — or CONT_C on SIMATIC.',
        blocks: ['LOOP'],
        note: detail,
        status: 'ok',
      };
    },
  },
  {
    test: /\bGOSUB\b/,
    map: (body) => {
      const passed = args(body, 'GOSUB');
      return {
        cfc: 'Subroutine call — restructure as a hierarchical subchart.',
        blocks: [],
        note:
          'CFC has no call/return. Passed points (→ $ARG1…) become subchart I/O; gate the subchart with EN.' +
          (passed.length > 1 ? ` Here ${passed.length - 1} point(s) bind to $ARG1…` : ''),
        status: 'manual',
      };
    },
  },
  {
    test: /\bRETURN\b/,
    map: () => ({ cfc: 'End of subroutine — boundary of the subchart.', blocks: [], status: 'info' }),
  },
  {
    test: /\bSAMPLE\s*\(/,
    map: (body) => {
      const n = args(body, 'SAMPLE')[0] ?? 'n';
      return {
        cfc: 'Throttle: run the wrapped statement every N seconds.',
        blocks: ['PT1_P'],
        note: `SAMPLE(${n}) → per-block scan-rate reduction (execute every ${n}s), and/or a PT1_P filter on noisy inputs.`,
        status: 'ok',
      };
    },
  },
  {
    test: /\bGOTO\b/,
    map: (body) => {
      // A trailing GOTO to a low line number is the scan/main-loop boundary.
      const m = /\bGOTO\s+(\d+)/.exec(body);
      const target = m ? Number(m[1]) : NaN;
      const loopBack = !Number.isNaN(target) && target <= 30;
      return loopBack
        ? {
            cfc: 'Main-loop / end-of-scan marker — not a block.',
            blocks: [],
            note: 'A GOTO back to the top is the continuous main loop = one scan. CFC re-solves the whole chart every cycle, so this disappears.',
            status: 'info',
          }
        : {
            cfc: 'Forward branch — replace with EN gating or a selector.',
            blocks: ['SEL_BO'],
            note: 'Forward GOTOs (skip-arounds/decision trees) become EN enables or SEL/MUX routing in declarative CFC.',
            status: 'manual',
          };
    },
  },
  {
    test: /\bIF\b.*\bTHEN\b/,
    map: (body) => {
      const ops = exprBlocks(body);
      const logic = ops.filter((b) => b !== 'CMP_R');
      return {
        cfc: 'Comparator/logic drives a selector or a block EN.' + (logic.length ? ' Logic: ' + logic.join(', ') + '.' : ''),
        blocks: ['CMP_R', ...logic.filter((b) => ['AND', 'OR', 'NOT'].includes(b)), 'SEL_R'],
        note: 'IF condition → CMP_R/logic gates; THEN/ELSE action → SEL_R/SEL_BO output or the target block’s EN input.',
        status: 'ok',
      };
    },
  },
  {
    test: /\bSET\s*\(/,
    map: (body) => {
      const a = args(body, 'SET');
      return {
        cfc: 'Write one value to multiple output points.',
        blocks: ['AO'],
        note: `SET(value, pt1…pt15) commands ${Math.max(0, a.length - 1)} point(s) to ${a[0] ?? 'value'}. The manual also sets their priority to NONE (BACnet priority array — on the roadmap).`,
        status: 'ok',
      };
    },
  },
  {
    test: /\bON\s*\(|\bOFF\s*\(/,
    map: () => ({
      cfc: 'Command a digital output point (1/0).',
      blocks: ['BO'],
      note: 'ON/OFF write a Binary Output; on real panels the command lands in the BACnet priority array.',
      status: 'ok',
    }),
  },
  {
    test: /\bMIN\s*\(|\bMAX\s*\(/,
    map: (body) => {
      const isMin = /\bMIN\s*\(/.test(body);
      return {
        cfc: isMin ? 'Minimum selector: dest = min(args).' : 'Maximum selector: dest = max(args).',
        blocks: [isMin ? 'MIN_R' : 'MAX_R'],
        status: 'ok',
      };
    },
  },
  {
    test: /\bTABLE\s*\(/,
    map: () => ({
      cfc: 'Piecewise-linear characteristic curve.',
      blocks: ['POLYG_P'],
      note: 'TABLE(in,out,x1,y1…) is ascending-x linear interpolation with endpoint clamping → POLYG_P (roadmap; approximate with SCALE + LIM_R today).',
      status: 'ok',
    }),
  },
  {
    test: /\bSAMPLE\b|\bWAIT\b/,
    map: () => ({ cfc: 'Self-timed statement → scan-rate / timer.', blocks: ['TON'], status: 'ok' }),
  },
  {
    test: /\bLOCAL\s*\(/,
    map: () => ({ cfc: 'Local/virtual point → internal connector or chart I/O.', blocks: [], status: 'ok' }),
  },
  {
    test: /\b(ENABLE|DISABL)\b/,
    map: () => ({ cfc: 'Block EN (enable) input.', blocks: [], status: 'ok' }),
  },
  {
    test: /\b(ALARM|ENALM|DISALM|HLIMIT|LLIMIT)\b/,
    map: () => ({ cfc: 'BACnet alarming / limit objects (configured, not a CFC block).', blocks: [], status: 'info' }),
  },
  {
    test: /\b(TOD|TODSET|HOLIDA|DAY|NIGHT|DAYOTWK|CRTIME|TIMEOFDAY)\b/,
    map: () => ({ cfc: 'Time-of-day / calendar → BACnet Schedule & Calendar.', blocks: [], status: 'info' }),
  },
  {
    test: /\bONPWRT\b/,
    map: () => ({
      cfc: 'First-scan one-shot (power-up init).',
      blocks: ['R_TRIG'],
      note: 'ONPWRT() is 1 on the first scan after start/reset → a rising-edge one-shot at startup (R_TRIG) seeding initial values.',
      status: 'ok',
    }),
  },
  {
    // generic assignment: <point> = <expr>
    test: /=/,
    map: (body) => {
      const ops = exprBlocks(body);
      return {
        cfc: ops.length ? 'Expression → output point: ' + ops.join(', ') + '.' : 'Direct assignment to an output point.',
        blocks: ops.length ? ops : ['AO'],
        note: 'Point names are quoted dotted refs ("GVL.B1.AHU65.…"); $-names are virtual/local points.',
        status: 'ok',
      };
    },
  },
];

const COMMENT = /^\s*\d*\s*C\b/i;

export function translatePpcl(src: string): MapResult[] {
  const out: MapResult[] = [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    const text = raw.trimEnd();
    if (text.trim() === '') return;
    if (COMMENT.test(text)) {
      out.push({ line: i + 1, ppcl: text, cfc: 'Comment — document it as a chart annotation.', blocks: [], status: 'comment' });
      return;
    }
    const body = text.replace(/^\s*\d+\s*/, '').toUpperCase();
    const rule = RULES.find((r) => r.test.test(body));
    if (rule) {
      const m = rule.map(body, text);
      out.push({ line: i + 1, ppcl: text, cfc: m.cfc, blocks: m.blocks, note: m.note, status: m.status ?? 'ok' });
    } else {
      out.push({ line: i + 1, ppcl: text, cfc: 'Unrecognised — map by hand (extend the rule set).', blocks: [], status: 'info' });
    }
  });
  return out;
}

/** Realistic PPCL programs using genuine syntax (quoted dotted points, DEFINE
 *  macros, the real LOOP signature). Drawn from common APOGEE idioms. */
export const PPCL_SAMPLES: { name: string; code: string }[] = [
  {
    name: 'AHU economizer + heating',
    code: `C  AHU-65 single-zone sequence
10 DEFINE(A,"GVL.B1.AHU65.")
20 IF ("%A%OAT" .LT. "%A%RAT") THEN "%A%OAD" = 100
30 IF ("%A%OAT" .GE. "%A%RAT") THEN "%A%OAD" = 20
40 LOOP(128,"%A%SAT","%A%HCV","%A%SASP",2000,40,0,5,0,0,100,0)
50 IF ("%A%SAT" .LT. 38) THEN ON("%A%FRZ")
60 IF ("%A%OCC" .AND. .NOT. "%A%OVR") THEN ON("%A%SF1")
70 IF ("%A%OCC" .EQ. OFF) THEN OFF("%A%SF1")
80 GOTO 20`,
  },
  {
    name: 'Hot-water reset from OAT',
    code: `C  Outdoor-air reset of hot-water supply setpoint
10 DEFINE(P,"GVL.CENT.HHW.")
20 "%P%SP" = 180 - (("OAT" - 20) * 1.5)
30 MAX("%P%SP", "%P%SP", 120)
40 MIN("%P%SP", "%P%SP", 180)
50 GOTO 20`,
  },
  {
    name: 'Lead/lag with init + sampling',
    code: `C  Pump lead/lag, initialised on power-up, evaluated every 60s
10 IF (ONPWRT() .EQ. ON) THEN "$LEAD" = 1
20 SAMPLE(60) GOSUB 100 "PMP1","PMP2"
30 GOTO 10
100 C  --- subroutine: stage the lag pump ---
110 IF ("$ARG1" .EQ. OFF) THEN ON("$ARG2")
120 RETURN`,
  },
];
