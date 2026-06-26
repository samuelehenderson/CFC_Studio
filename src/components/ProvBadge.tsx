import type { Provenance } from '../engine/types';

const LABEL: Record<Provenance, string> = {
  confirmed: 'Confirmed',
  inferred: 'Inferred',
  gap: 'Non-Siemens',
};

const TIP: Record<Provenance, string> = {
  confirmed: 'Pins/semantics verified against Siemens or IEC documentation.',
  inferred: 'Modelled from the documented equivalent; exact Desigo spec not public.',
  gap: 'Simulator convenience or unknown spec — not a real Siemens block.',
};

/** Provenance pill — the honesty marker shown wherever a block appears. */
export function ProvBadge({ provenance }: { provenance: Provenance }) {
  return (
    <span className={`prov ${provenance}`} title={TIP[provenance]}>
      {LABEL[provenance]}
    </span>
  );
}

/** Compact dot variant for dense lists. */
export function ProvDot({ provenance }: { provenance: Provenance }) {
  return <span className={`prov-dot ${provenance}`} title={`${LABEL[provenance]} — ${TIP[provenance]}`} />;
}
