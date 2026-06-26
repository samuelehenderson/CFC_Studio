/**
 * PPCL → CFC translation analyzer (teaching aid, NOT an automated transpiler).
 *
 * Siemens publishes no PPCL→CFC converter; migration is manual. This analyzer
 * reads PPCL line-by-line, recognises common constructs, and shows the CFC
 * block equivalent for each, flagging constructs (GOTO/GOSUB) that have no
 * clean CFC analogue and need rethinking as data flow.
 *
 * The RULES table below is the single place to extend coverage — it is seeded
 * from docs/CFC-reference.md §5 and is intended to be enriched from a real
 * APOGEE PPCL manual (exact statement syntax + examples).
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
  /** Test against the statement body (line-number stripped, upper-cased). */
  test: RegExp;
  map: (body: string) => { cfc: string; blocks: string[]; note?: string; status?: MapStatus };
}

/** Detect arithmetic / relational / logical operators present in an expression. */
function operatorBlocks(body: string): string[] {
  const b = new Set<string>();
  if (/\.AND\./.test(body)) b.add('AND');
  if (/\.OR\./.test(body)) b.add('OR');
  if (/\.NOT\./.test(body)) b.add('NOT');
  if (/\.GT\.|\.GE\.|\.LT\.|\.LE\.|\.EQ\.|\.NE\./.test(body)) b.add('CMP_R');
  if (/[^.\w]\+|\s\+\s/.test(body)) b.add('ADD_R');
  if (/\s-\s/.test(body)) b.add('SUB_R');
  if (/\*/.test(body)) b.add('MUL_R');
  if (/\//.test(body)) b.add('DIV_R');
  if (/\bSQRT\b/.test(body)) b.add('SQRT');
  if (/\bMIN\b/.test(body)) b.add('MIN_R');
  if (/\bMAX\b/.test(body)) b.add('MAX_R');
  return [...b];
}

const RULES: Rule[] = [
  {
    // LOOP(...) — PID controller
    test: /\bLOOP\s*\(/,
    map: () => ({
      cfc: 'LOOP (BA PID) — or CONT_C on SIMATIC. Map gain/reset/rate and SP/PV/output to W/X/Y, Kp/Tn/Tv.',
      blocks: ['LOOP'],
      note: 'PPCL LOOP arguments become LOOP pins/params: setpoint→W, process→X, output→Y, with direct/reverse action.',
      status: 'ok',
    }),
  },
  {
    test: /\bGOSUB\b|\bRETURN\b/,
    map: () => ({
      cfc: 'No direct equivalent — restructure the subroutine as a hierarchical subchart.',
      blocks: [],
      note: 'CFC has no call/return. Factor reusable logic into a subchart and gate it with EN.',
      status: 'manual',
    }),
  },
  {
    test: /\bGOTO\b/,
    map: () => ({
      cfc: 'No direct equivalent — replace jump-based flow with EN (enable) gating / selectors.',
      blocks: ['SEL_BO'],
      note: 'CFC is declarative data flow; conditional branching becomes EN gating or SEL/MUX routing, not jumps.',
      status: 'manual',
    }),
  },
  {
    test: /\bIF\b.*\bTHEN\b/,
    map: (body) => ({
      cfc: 'Comparator/logic drives a selector or a block EN. ' + (operatorBlocks(body).length ? 'Uses: ' + operatorBlocks(body).join(', ') + '.' : ''),
      blocks: ['CMP_R', ...operatorBlocks(body).filter((b) => b !== 'CMP_R'), 'SEL_R'],
      note: 'IF condition → comparator/logic gates; THEN action → SEL_R/SEL_BO output or the target block’s EN input.',
      status: 'ok',
    }),
  },
  {
    test: /\bSAMPLE\b/,
    map: () => ({
      cfc: 'Per-block scan-rate reduction (run every Nth cycle), optionally a PT1_P filter.',
      blocks: ['PT1_P'],
      status: 'ok',
    }),
  },
  {
    test: /\bTIMAVG\b/,
    map: () => ({ cfc: 'First-order lag / averaging.', blocks: ['PT1_P'], status: 'ok' }),
  },
  {
    test: /\bTABLE\b/,
    map: () => ({ cfc: 'Piecewise-linear characteristic curve.', blocks: ['POLYG_P'], note: 'POLYG_P is on the roadmap; approximate with SCALE + LIMIT for now.', status: 'ok' }),
  },
  {
    test: /\bMIN\b|\bMAX\b/,
    map: (body) => ({ cfc: body.includes('MIN') ? 'Minimum selector.' : 'Maximum selector.', blocks: body.includes('MIN') ? ['MIN_R'] : ['MAX_R'], status: 'ok' }),
  },
  {
    test: /\b(ON|OFF|SET|ACT|DEACT|START|STOP)\b/,
    map: () => ({
      cfc: 'Commanded output point (Binary/Analog Output), honouring BACnet priority.',
      blocks: ['BO'],
      note: 'PPCL point commands become writes to an output point; multiple sources arbitrate via the BACnet priority array.',
      status: 'ok',
    }),
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
    test: /\b(TOD|TODSET|HOLIDA|DAY|NIGHT|DOW)\b/,
    map: () => ({ cfc: 'BACnet Schedule / Calendar object.', blocks: [], status: 'info' }),
  },
  {
    // generic assignment "POINT" = expression
    test: /=/,
    map: (body) => {
      const ops = operatorBlocks(body);
      return {
        cfc: ops.length ? 'Arithmetic / logic expression: ' + ops.join(', ') + ' → output point.' : 'Direct assignment to an output point.',
        blocks: ops.length ? ops : ['AO'],
        status: 'ok',
      };
    },
  },
];

const COMMENT = /^\s*C\b|^\s*'/i;

export function translatePpcl(src: string): MapResult[] {
  const out: MapResult[] = [];
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  lines.forEach((raw, i) => {
    const text = raw.trimEnd();
    if (text.trim() === '') return; // skip blanks in the output list
    if (COMMENT.test(text)) {
      out.push({ line: i + 1, ppcl: text, cfc: 'Comment — drops out; document it as a chart annotation.', blocks: [], status: 'comment' });
      return;
    }
    // strip a leading line number
    const body = text.replace(/^\s*\d+\s*/, '').toUpperCase();
    const rule = RULES.find((r) => r.test.test(body));
    if (rule) {
      const m = rule.map(body);
      out.push({ line: i + 1, ppcl: text, cfc: m.cfc, blocks: m.blocks, note: m.note, status: m.status ?? 'ok' });
    } else {
      out.push({ line: i + 1, ppcl: text, cfc: 'Unrecognised statement — map by hand (extend the rule set from the PPCL manual).', blocks: [], status: 'info' });
    }
  });
  return out;
}

/** Illustrative PPCL snippets. Replace/extend with examples from the real
 *  APOGEE PPCL manual once available. */
export const PPCL_SAMPLES: { name: string; code: string }[] = [
  {
    name: 'Economizer + heating (illustrative)',
    code: `C  Single-zone AHU sequence (illustrative PPCL)
10 IF ("OAT" .LT. "SPACE_TEMP") THEN "OA_DMPR" = 100
20 IF ("OAT" .GE. "SPACE_TEMP") THEN "OA_DMPR" = 20
30 LOOP("SPACE_TEMP","HTG_VLV","SPACE_SP",1,4,0,40,0,100)
40 IF ("SUPPLY_TEMP" .LT. 38) THEN ON("FREEZE_ALM")
50 IF ("OCC" .AND. .NOT. "OVERRIDE") THEN ON("SUPPLY_FAN")
60 IF ("OCC" .EQ. 0) THEN OFF("SUPPLY_FAN")`,
  },
  {
    name: 'Reset schedule (illustrative)',
    code: `C  Outdoor-air reset of hot-water setpoint
10 "HW_SP" = 180 - (("OAT" - 20) * 1.5)
20 "HW_SP" = MAX("HW_SP", 120)
30 "HW_SP" = MIN("HW_SP", 180)`,
  },
];
