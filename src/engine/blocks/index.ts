/**
 * Block registry — the master catalog of all CFC function blocks.
 *
 * Add new blocks by appending a BlockDefinition to one of the category files
 * (or a new one) and importing it here. The registry is keyed by block type.
 */
import type { BlockCategory, BlockDefinition, Provenance } from '../types';
import { mathBlocks } from './math';
import { logicBlocks } from './logic';
import { compareBlocks } from './compare';
import { selectorBlocks } from './selectors';
import { timerBlocks } from './timers';
import { counterBlocks } from './counters';
import { memoryBlocks } from './memory';
import { controlBlocks } from './control';
import { convertBlocks } from './convert';
import { ioBlocks } from './io';
import { sourceBlocks } from './sources';

export const allBlocks: BlockDefinition[] = [
  ...ioBlocks,
  ...sourceBlocks,
  ...mathBlocks,
  ...convertBlocks,
  ...logicBlocks,
  ...compareBlocks,
  ...selectorBlocks,
  ...timerBlocks,
  ...counterBlocks,
  ...memoryBlocks,
  ...controlBlocks,
];

/**
 * Provenance defaults. A block may set `provenance` itself (e.g. CONT_C =
 * confirmed, LOOP = inferred); otherwise it inherits its category default,
 * with per-type overrides for simulator-only helpers. This keeps the honesty
 * badges accurate everywhere a block appears without annotating all 50 blocks.
 */
const CATEGORY_PROVENANCE: Record<BlockCategory, Provenance> = {
  'I/O': 'inferred', // BACnet point model; exact Desigo LAI/LAO mapping simplified
  Constants: 'confirmed',
  Signal: 'gap', // generators are simulator stimulus, not Siemens blocks
  Math: 'confirmed',
  Logic: 'confirmed',
  Compare: 'confirmed',
  Selectors: 'confirmed',
  Timers: 'confirmed',
  Counters: 'confirmed',
  Memory: 'confirmed',
  Control: 'inferred',
};

const PROVENANCE_OVERRIDE: Record<string, Provenance> = {
  HYST: 'gap', // 2-position controller, not a documented Siemens block
  R_B: 'gap', // BOOL<->REAL direct conversion is a sim convenience
  B_R: 'gap',
  INT_P: 'confirmed',
  DIF_P: 'confirmed',
  PT1_P: 'confirmed',
  RAMP_P: 'confirmed',
};

for (const b of allBlocks) {
  if (b.provenance === undefined) {
    b.provenance = PROVENANCE_OVERRIDE[b.type] ?? CATEGORY_PROVENANCE[b.category];
  }
}

/** type -> definition */
export const registry: Record<string, BlockDefinition> = Object.fromEntries(
  allBlocks.map((b) => [b.type, b]),
);

/** Stable palette category order. */
export const categoryOrder: BlockCategory[] = [
  'I/O',
  'Constants',
  'Signal',
  'Math',
  'Logic',
  'Compare',
  'Selectors',
  'Timers',
  'Counters',
  'Memory',
  'Control',
];

/** Blocks grouped by category, in palette order. */
export function blocksByCategory(): { category: BlockCategory; blocks: BlockDefinition[] }[] {
  return categoryOrder
    .map((category) => ({
      category,
      blocks: allBlocks.filter((b) => b.category === category),
    }))
    .filter((g) => g.blocks.length > 0);
}

export function getBlock(type: string): BlockDefinition | undefined {
  return registry[type];
}
