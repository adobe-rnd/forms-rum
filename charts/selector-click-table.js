/**
 * Selector Click Count Table Web Component
 * Shows click counts per selector, mapped to labels using pre-extracted selector metadata.
 *
 * Requires:
 *   formsJson/index.json
 *   formsJson/by-url/<sha1-8>.selectors.json
 */

class SelectorClickTable extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.bundles = [];
    this.url = '';

    // Instance-scoped caches (avoid shared state across multiple component instances)
    this.selectorIndex = null; // urlKey -> { file, ... }
    this.perUrlCache = new Map(); // urlKey -> payload from formsJson/by-url/...

    this.sortColumn = 'clicks';
    this.sortDirection = 'desc';
    this.searchTerm = '';
    this.limit = 200;

    this.rows = []; // [{label, selector, kind, clicks}]
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; width: 100%; }

        .table-container {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          margin-top: 32px;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
          gap: 12px;
          flex-wrap: wrap;
        }

        .title-wrap { display: flex; flex-direction: column; gap: 2px; }
        .table-title {
          margin: 0;
          color: #1e40af;
          font-size: 1.125rem;
          font-weight: 600;
        }
        .table-subtitle {
          margin: 0;
          color: #6b7280;
          font-size: 0.8rem;
        }

        .controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .search-input, .limit-select {
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          transition: border-color 0.2s;
        }
        .search-input { width: 260px; }
        .search-input:focus, .limit-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .table-wrapper {
          overflow-x: auto;
          max-height: 520px;
          overflow-y: auto;
        }

        table { width: 100%; border-collapse: collapse; }
        thead {
          position: sticky;
          top: 0;
          background: #f9fafb;
          z-index: 10;
        }

        th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        th:hover { background: #f3f4f6; }
        th.sortable::after { content: '⇅'; margin-left: 4px; color: #9ca3af; }
        th.sorted-asc::after { content: '↑'; color: #3b82f6; }
        th.sorted-desc::after { content: '↓'; color: #3b82f6; }

        td {
          padding: 12px 16px;
          font-size: 0.875rem;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: top;
        }
        tbody tr:hover { background: #f9fafb; }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          word-break: break-all;
          max-width: 520px;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          background: #e5e7eb;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #374151;
        }

        .no-data {
          text-align: center;
          padding: 60px 20px;
          color: #9ca3af;
          font-style: italic;
          background: #f9fafb;
        }

        @media (max-width: 768px) {
          .search-input { width: 160px; }
          .mono { max-width: 240px; }
        }
      </style>

      <div class="table-container">
        <div class="table-header">
          <div class="title-wrap">
            <h3 class="table-title">Clicks by Form Selector</h3>
            <p class="table-subtitle" id="subtitle">Loading selector map…</p>
          </div>
          <div class="controls">
            <input id="search" class="search-input" type="text" placeholder="Search label / selector…" />
            <select id="limit" class="limit-select" title="Max rows">
              <option value="50">Top 50</option>
              <option value="100">Top 100</option>
              <option value="200" selected>Top 200</option>
              <option value="500">Top 500</option>
              <option value="999999">All</option>
            </select>
          </div>
        </div>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th class="sortable" data-column="label">Label</th>
                <th class="sortable" data-column="selector">Selector</th>
                <th class="sortable" data-column="kind">Type</th>
                <th class="sortable" data-column="clicks">Click Count</th>
              </tr>
            </thead>
            <tbody id="tbody">
              <tr><td colspan="4" class="no-data">No selector click data yet</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const search = this.shadowRoot.getElementById('search');
    search.addEventListener('input', (e) => {
      this.searchTerm = String(e.target.value || '').toLowerCase();
      this.updateTable();
    });

    const limit = this.shadowRoot.getElementById('limit');
    limit.addEventListener('change', (e) => {
      this.limit = Number(e.target.value);
      this.updateTable();
    });

    const headers = this.shadowRoot.querySelectorAll('th.sortable');
    headers.forEach((h) => {
      h.addEventListener('click', () => {
        const col = h.dataset.column;
        if (this.sortColumn === col) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = col;
          this.sortDirection = col === 'clicks' ? 'desc' : 'asc';
        }
        this.updateTable();
      });
    });
  }

  static normalizeUrlKey(url) {
    try {
      const u = new URL(String(url));
      const pathname = (u.pathname || '/').replace(/\/+$/, '');
      return `${u.origin}${pathname}`;
    } catch (e) {
      return String(url || '').replace(/[#?].*$/, '').replace(/\/+$/, '');
    }
  }

  static normalizeSelector(s) {
    const v = String(s || '').trim();
    if (!v) return '';
    // Many extracted selectors include a leading form selector; click targets often don't.
    let out = v.replace(/^form#[^\s]+\s+/, '').trim();

    // Sometimes targets come through as raw element IDs (no leading '#').
    // If it looks like an ID and not a complex selector, prefix '#'.
    if (!out.includes(' ') && !out.includes('>') && !out.includes('[') && !out.startsWith('#')) {
      if (/^[A-Za-z_][\w\-\:\.]*$/.test(out)) {
        out = `#${out}`;
      }
    }
    return out;
  }

  static extractGuideTail(s) {
    const v = String(s || '');
    const idx = v.indexOf('#guideContainer-');
    if (idx >= 0) return v.slice(idx).trim();
    const idx2 = v.indexOf('guideContainer-');
    if (idx2 >= 0) return `#${v.slice(idx2).trim()}`;
    return '';
  }

  static addGuideTailVariants(keys, raw) {
    const tail = SelectorClickTable.extractGuideTail(raw);
    if (!tail) return;
    keys.add(tail);
    if (tail.startsWith('#')) keys.add(tail.slice(1));
    const tailBase = tail.replace(/___(widget|label)$/, '');
    if (tailBase && tailBase !== tail) {
      keys.add(tailBase);
      if (tailBase.startsWith('#')) keys.add(tailBase.slice(1));
    }
  }

  static selectorKeysForRow(rawSelector) {
    const keys = new Set();
    const norm = SelectorClickTable.normalizeSelector(rawSelector);
    if (norm) keys.add(norm);
    if (norm.startsWith('#')) keys.add(norm.slice(1));
    // Also add "id without suffix" variant for common AF widgets
    const base = norm.replace(/___(widget|label)$/, '');
    if (base && base !== norm) {
      keys.add(base);
      if (base.startsWith('#')) keys.add(base.slice(1));
    }

    // Also index by the "#guideContainer-..." tail so RUM selectors that include extra prefixes
    // like "form#... input[type=...]#guideContainer-..." can be matched reliably.
    SelectorClickTable.addGuideTailVariants(keys, rawSelector);
    return Array.from(keys);
  }

  static selectorKeysForClickTarget(rawTarget) {
    const keys = new Set();
    const t = String(rawTarget || '').trim();
    if (!t) return [];
    keys.add(t);
    keys.add(SelectorClickTable.normalizeSelector(t));
    SelectorClickTable.addGuideTailVariants(keys, t);
    // If they give an id without '#', also try '#id'
    if (!t.startsWith('#') && /^[A-Za-z_][\w\-\:\.]*$/.test(t)) keys.add(`#${t}`);
    const norm = SelectorClickTable.normalizeSelector(t);
    if (norm && !norm.startsWith('#') && /^[A-Za-z_][\w\-\:\.]*$/.test(norm)) keys.add(`#${norm}`);
    return Array.from(keys).map((k) => String(k || '').trim()).filter(Boolean);
  }

  static toPlainTextLabel(label) {
    const v = String(label ?? '').trim();
    if (!v) return '';
    // Fast path for plain text
    if (!v.includes('<') && !v.includes('>') && !v.includes('&nbsp;')) return v;
    try {
      const doc = new DOMParser().parseFromString(v, 'text/html');
      return String(doc?.body?.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
      // Fallback: best-effort strip tags/entities
      return v
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  async loadSelectorIndex() {
    if (this.selectorIndex) return this.selectorIndex;
    const resp = await fetch('/formsJson/index.json');
    const json = await resp.json();
    this.selectorIndex = json || {};
    return this.selectorIndex;
  }

  async loadSelectorsForUrl(urlKey) {
    if (this.perUrlCache.has(urlKey)) return this.perUrlCache.get(urlKey);
    const idx = await this.loadSelectorIndex();
    const entry = idx[urlKey];
    if (!entry || !entry.file) return null;
    const resp = await fetch(`/formsJson/${entry.file}`);
    const json = await resp.json();
    this.perUrlCache.set(urlKey, json);
    return json;
  }

  setData(bundles, url) {
    this.bundles = Array.isArray(bundles) ? bundles : [];
    this.url = url || '';
    this.recompute().catch((e) => {
      const subtitle = this.shadowRoot.getElementById('subtitle');
      subtitle.textContent = `Error: ${String(e && e.message ? e.message : e)}`;
    });
  }

  computeClickCountsWeighted(knownSelectorKeySet) {
    const counts = new Map(); // matchedSelectorKey -> weighted clicks

    this.bundles.forEach((b) => {
      const events = Array.isArray(b?.events) ? b.events : [];
      const w = Number.isFinite(b?.weight) ? Number(b.weight) : 1;
      events.forEach((e) => {
        if (e?.checkpoint !== 'click') return;
        const raw = e?.target || e?.source || '';
        const candidates = SelectorClickTable.selectorKeysForClickTarget(raw);
        const match = candidates.find((c) => knownSelectorKeySet.has(c));
        if (match) {
          counts.set(match, (counts.get(match) || 0) + w);
        }
      });
    });

    return { counts };
  }

  async recompute() {
    const subtitle = this.shadowRoot.getElementById('subtitle');
    const urlKey = SelectorClickTable.normalizeUrlKey(this.url);

    // Keep subtitle concise. Never dump long extraction errors into the UI.
    subtitle.textContent = `URL: ${urlKey}`;

    const selectorPayload = await this.loadSelectorsForUrl(urlKey);
    if (!selectorPayload || !selectorPayload.ok) {
      // Still keep UI clean; log details for debugging.
      console.warn('Selector map unavailable for URL', { urlKey, error: selectorPayload?.error || null });
      subtitle.textContent = `URL: ${urlKey} — selector map unavailable`;
      this.rows = [];
      this.updateTable();
      return;
    }

    const selectorRows = Array.isArray(selectorPayload.rows) ? selectorPayload.rows : [];
    // Build a mapping from normalized selector keys -> display row
    const keyToRow = new Map(); // selectorKey -> {label, selector, kind}
    const knownKeySet = new Set();
    selectorRows.forEach((r) => {
      const keys = SelectorClickTable.selectorKeysForRow(r.selector);
      keys.forEach((k) => {
        knownKeySet.add(k);
        const existingRow = keyToRow.get(k);
        const existingLabel = SelectorClickTable.toPlainTextLabel(existingRow?.label);
        const nextLabel = SelectorClickTable.toPlainTextLabel(r?.label);

        // Prefer rows with labels over those without (review comment).
        // If both have labels, prefer kind=label as a tiebreaker.
        if (!existingRow
          || (!existingLabel && nextLabel)
          || (existingLabel && nextLabel && existingRow?.kind !== 'label' && r?.kind === 'label')) {
          keyToRow.set(k, r);
        }
      });
    });

    const { counts } = this.computeClickCountsWeighted(knownKeySet);

    // Build output ONLY for matched selectors (as requested)
    const out = Array.from(counts.entries()).map(([selectorKey, clicks]) => {
      const r = keyToRow.get(selectorKey);
      const label = SelectorClickTable.toPlainTextLabel(r?.label) || '(no label)';
      const selector = r?.selector || selectorKey;
      const kind = r?.kind || 'unknown';
      return { label, selector, kind, clicks };
    });

    out.sort((a, b) => (b.clicks - a.clicks) || a.label.localeCompare(b.label));
    this.rows = out;
    this.updateTable();
  }

  updateTable() {
    const tbody = this.shadowRoot.getElementById('tbody');
    if (!tbody) return;

    let data = Array.isArray(this.rows) ? [...this.rows] : [];

    if (this.searchTerm) {
      const q = this.searchTerm;
      data = data.filter((r) =>
        String(r.label || '').toLowerCase().includes(q) ||
        String(r.selector || '').toLowerCase().includes(q) ||
        String(r.kind || '').toLowerCase().includes(q)
      );
    }

    // Sort
    data.sort((a, b) => {
      const col = this.sortColumn;
      const dir = this.sortDirection === 'asc' ? 1 : -1;
      const av = a[col];
      const bv = b[col];
      if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv);
      return dir * String(av || '').localeCompare(String(bv || ''));
    });

    // Apply limit
    if (Number.isFinite(this.limit) && this.limit > 0 && this.limit !== 999999) {
      data = data.slice(0, this.limit);
    }

    // Update sort indicators
    const headers = this.shadowRoot.querySelectorAll('th.sortable');
    headers.forEach((h) => {
      h.classList.remove('sorted-asc', 'sorted-desc');
      if (h.dataset.column === this.sortColumn) {
        h.classList.add(this.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-data">No matching selectors</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((r) => `
      <tr>
        <td>${SelectorClickTable.escapeHtml(r.label)}</td>
        <td class="mono">${SelectorClickTable.escapeHtml(r.selector)}</td>
        <td><span class="badge">${SelectorClickTable.escapeHtml(r.kind)}</span></td>
        <td><span class="badge">${Number(r.clicks || 0).toLocaleString()}</span></td>
      </tr>
    `).join('');
  }

  reset() {
    this.bundles = [];
    this.url = '';
    this.rows = [];
    this.searchTerm = '';
    this.updateTable();
  }
}

customElements.define('selector-click-table', SelectorClickTable);

export default SelectorClickTable;


