/**
 * Block registry — the master catalog of all CFC function blocks.
 *
 * Add new blocks by appending a BlockDefinition to one of the category files
 * (or a new one) and importing it here. The registry is keyed by block type.
 */
import type { BlockCategory, BlockDefinition } from '../types';
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
