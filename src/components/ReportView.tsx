import { useEffect, useRef, useState } from 'react';
import {
  emptyReport,
  cleanBullets,
  metaLine,
  SECTION_TITLES,
  type ReportData,
} from '../report/types';
import { importPhoto } from '../report/photos';

const DRAFT_KEY = 'cfc.report.v1';

function loadDraft(): ReportData {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyReport(), ...(JSON.parse(raw) as Partial<ReportData>) };
  } catch {
    /* corrupt draft — start fresh */
  }
  return emptyReport();
}

/** Editable bullet list (one text row per bullet, add/remove). */
function BulletEditor({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="rpt-bullets">
      {items.map((item, i) => (
        <div className="rpt-bullet-row" key={i}>
          <span className="rpt-bullet-dot">•</span>
          <textarea
            rows={2}
            value={item}
            placeholder={placeholder}
            onChange={(e) => onChange(items.map((v, k) => (k === i ? e.target.value : v)))}
          />
          <button
            className="rpt-icon-btn"
            title="Remove this bullet"
            onClick={() => onChange(items.length > 1 ? items.filter((_, k) => k !== i) : [''])}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="rpt-add-btn" onClick={() => onChange([...items, ''])}>
        + Add bullet
      </button>
    </div>
  );
}

/** Report tab: fill-in form on the left, live paper preview on the right,
 *  exports to Word (.docx) or PDF. Draft autosaves to localStorage. */
export function ReportView() {
  const [r, setR] = useState<ReportData>(loadDraft);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autosave the draft (photos included) whenever anything changes.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(r));
    } catch {
      setNote('Draft too large to autosave (photos) — export before leaving this page.');
    }
  }, [r]);

  const set = <K extends keyof ReportData>(key: K, value: ReportData[K]) =>
    setR((prev) => ({ ...prev, [key]: value }));

  const flash = (msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote(''), 4000);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const imported: ReportData['photos'] = [];
      for (const f of Array.from(files)) imported.push(await importPhoto(f));
      setR((prev) => ({ ...prev, photos: [...prev.photos, ...imported] }));
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Photo import failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doExport = async (kind: 'docx' | 'pdf') => {
    setBusy(true);
    try {
      // Export libs are heavy — load them only when actually exporting.
      if (kind === 'docx') {
        const { exportReportDocx } = await import('../report/exportDocx');
        await exportReportDocx(r);
      } else {
        const { exportReportPdf } = await import('../report/exportPdf');
        exportReportPdf(r);
      }
      flash(kind === 'docx' ? 'Word document downloaded.' : 'PDF downloaded.');
    } catch (err) {
      flash(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    if (window.confirm('Clear the whole report? This deletes the saved draft.')) {
      setR(emptyReport());
    }
  };

  const bulletSections: {
    key: 'findings' | 'working' | 'openItems';
    title: string;
    hint: string;
    placeholder: string;
  }[] = [
    {
      key: 'findings',
      title: SECTION_TITLES.findings,
      hint: 'Conditions found, readings, alarms, scope/coordination items.',
      placeholder:
        'AHU-3: return fan VFD in fault. Verified 24V at terminal — needs electrician.',
    },
    {
      key: 'working',
      title: SECTION_TITLES.working,
      hint: 'What you worked on today, troubleshooting steps, what is still in progress.',
      placeholder: 'Point-to-point checkout on VAV boxes 2-01 through 2-14; 12 of 14 verified.',
    },
    {
      key: 'openItems',
      title: SECTION_TITLES.openItems,
      hint: 'Decisions needed, missing info, next steps before checkout / turnover.',
      placeholder: 'Need TAB airflow values for floor 2 before final loop tuning — PM to confirm.',
    },
  ];

  return (
    <div className="tabview rpt-shell">
      <div className="rpt-bar">
        <strong style={{ fontSize: 14 }}>Daily Field Report</strong>
        <span className="rpt-note">{note || 'Draft autosaves in this browser.'}</span>
        <div style={{ flex: 1 }} />
        <button onClick={clearAll} title="Start a fresh report">
          New / Clear
        </button>
        <button disabled={busy} onClick={() => doExport('docx')} title="Download as Word (.docx)">
          ⬇ Word (.docx)
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => doExport('pdf')}
          title="Download as PDF"
        >
          ⬇ PDF
        </button>
      </div>

      <div className="rpt-panes">
        {/* -------- form -------- */}
        <div className="rpt-form">
          <div className="rpt-section">
            <div className="rpt-section-title">Header</div>
            <div className="rpt-grid2">
              <label>
                Brand / company banner
                <input value={r.brand} onChange={(e) => set('brand', e.target.value)} />
              </label>
              <label>
                Report title
                <input value={r.docTitle} onChange={(e) => set('docTitle', e.target.value)} />
              </label>
            </div>
            <label>
              Project / building name
              <input
                value={r.project}
                placeholder="Central Plant Upgrade — Mercy General"
                onChange={(e) => set('project', e.target.value)}
              />
            </label>
            <div className="rpt-grid2">
              <label>
                Job number
                <input
                  value={r.jobNumber}
                  placeholder="44OP-123456"
                  onChange={(e) => set('jobNumber', e.target.value)}
                />
              </label>
              <label>
                Date
                <input type="date" value={r.date} onChange={(e) => set('date', e.target.value)} />
              </label>
            </div>
            <div className="rpt-grid2">
              <label>
                Site address
                <input
                  value={r.siteAddress}
                  placeholder="4001 J St, Sacramento CA"
                  onChange={(e) => set('siteAddress', e.target.value)}
                />
              </label>
              <label>
                Tech / company
                <input
                  value={r.tech}
                  placeholder="S. Henderson — Siemens"
                  onChange={(e) => set('tech', e.target.value)}
                />
              </label>
            </div>
            <label>
              Footer line
              <input value={r.footer} onChange={(e) => set('footer', e.target.value)} />
            </label>
          </div>

          <div className="rpt-section">
            <div className="rpt-section-title">{SECTION_TITLES.summary}</div>
            <div className="rpt-hint">
              Short overview: what was completed, what is still being worked, what needs attention.
            </div>
            <textarea
              rows={4}
              value={r.summary}
              placeholder="Where the project stands today…"
              onChange={(e) => set('summary', e.target.value)}
            />
          </div>

          {bulletSections.map((s) => (
            <div className="rpt-section" key={s.key}>
              <div className="rpt-section-title">{s.title}</div>
              <div className="rpt-hint">{s.hint}</div>
              <BulletEditor
                items={r[s.key]}
                placeholder={s.placeholder}
                onChange={(items) => set(s.key, items)}
              />
            </div>
          ))}

          <div className="rpt-section">
            <div className="rpt-section-title">{SECTION_TITLES.photos}</div>
            <div className="rpt-hint">
              Marked-up drawings, equipment/wiring photos, trend or graphic screenshots. Two per
              row in the export.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => addPhotos(e.target.files)}
            />
            <button className="rpt-add-btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              + Add photos…
            </button>
            <div className="rpt-photos">
              {r.photos.map((p, i) => (
                <div className="rpt-photo-card" key={p.id}>
                  <img src={p.dataUrl} alt={p.caption || `Photo ${i + 1}`} />
                  <input
                    value={p.caption}
                    placeholder="Caption…"
                    onChange={(e) =>
                      set(
                        'photos',
                        r.photos.map((q) => (q.id === p.id ? { ...q, caption: e.target.value } : q)),
                      )
                    }
                  />
                  <div className="rpt-photo-tools">
                    <button
                      className="rpt-icon-btn"
                      title="Move earlier"
                      disabled={i === 0}
                      onClick={() => {
                        const ph = [...r.photos];
                        [ph[i - 1], ph[i]] = [ph[i], ph[i - 1]];
                        set('photos', ph);
                      }}
                    >
                      ↑
                    </button>
                    <button
                      className="rpt-icon-btn"
                      title="Move later"
                      disabled={i === r.photos.length - 1}
                      onClick={() => {
                        const ph = [...r.photos];
                        [ph[i], ph[i + 1]] = [ph[i + 1], ph[i]];
                        set('photos', ph);
                      }}
                    >
                      ↓
                    </button>
                    <button
                      className="rpt-icon-btn"
                      title="Remove photo"
                      onClick={() => set('photos', r.photos.filter((q) => q.id !== p.id))}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* -------- live preview -------- */}
        <div className="rpt-preview-wrap">
          <div className="rpt-paper">
            <div className="rpt-p-banner">
              <span>{r.brand}</span>
              <span>{r.docTitle}</span>
            </div>
            <div className="rpt-p-title">{r.project || 'Project / Building'}</div>
            <div className="rpt-p-meta">{metaLine(r)}</div>

            {r.summary.trim() && (
              <>
                <div className="rpt-p-h">{SECTION_TITLES.summary}</div>
                {r.summary
                  .split(/\n+/)
                  .filter((s) => s.trim())
                  .map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
              </>
            )}
            {bulletSections.map((s) => {
              const items = cleanBullets(r[s.key]);
              if (!items.length) return null;
              return (
                <div key={s.key}>
                  <div className="rpt-p-h">{s.title}</div>
                  <ul>
                    {items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {r.photos.length > 0 && (
              <>
                <div className="rpt-p-h">{SECTION_TITLES.photos}</div>
                <div className="rpt-p-photos">
                  {r.photos.map((p) => (
                    <figure key={p.id}>
                      <img src={p.dataUrl} alt="" />
                      {p.caption && <figcaption>{p.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              </>
            )}
            <div className="rpt-p-footer">
              <span>{r.footer}</span>
              <span>Page 1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
