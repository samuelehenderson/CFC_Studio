/**
 * EN / ENO support.
 *
 * In Siemens CFC every elementary block carries two extra binary pins:
 *   EN  — enable input. The block only computes when EN = 1 (default 1 when
 *         the pin is left open). When EN = 0 the block is skipped and its
 *         outputs hold their last value.
 *   ENO — enable output / binary result. 1 = the block ran and produced a
 *         valid result; 0 = it was disabled or hit an error (e.g. /0, √-1).
 *
 * `elementary()` wraps a "bare" block definition and adds these pins plus the
 * enable/hold/validity logic, so the individual block files stay focused on
 * the actual function. A block can signal an error from its evaluate() by
 * returning `_eno: false` in its result.
 */
import type { BlockDefinition, EvalContext, EvalResult, Value } from '../types';

export function elementary(def: BlockDefinition): BlockDefinition {
  return {
    ...def,
    inputs: [
      ...def.inputs,
      { id: 'en', name: 'EN', type: 'BOOL', default: true, description: 'Enable (1 = run block)' },
    ],
    outputs: [
      ...def.outputs,
      { id: 'eno', name: 'ENO', type: 'BOOL', description: '1 = valid result' },
    ],
    evaluate: (ctx: EvalContext): EvalResult => {
      const en = ctx.inputs.en;
      if (en === false || en === 0) {
        // Disabled: hold previous outputs, ENO = 0.
        const held: Record<string, Value> = {};
        for (const pin of def.outputs) held[pin.id] = ctx.prev[pin.id] ?? (pin.type === 'BOOL' ? false : 0);
        return { ...held, eno: false };
      }
      const out = def.evaluate(ctx);
      const eno = out._eno === undefined ? true : Boolean(out._eno);
      delete out._eno;
      return { ...out, eno };
    },
  };
}
