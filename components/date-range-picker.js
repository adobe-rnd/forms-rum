/**
 * Date Range Picker Web Component
 * Allows users to select a start and end date with validation
 * Ensures dates are not more than 1 week apart
 */
class DateRangePicker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isInitialized = false;
  }

  static get observedAttributes() {
    return ['placeholder', 'start', 'end'];
  }

  connectedCallback() {
    this.render();
    this.initializeLastValidDifference();
    this.setupEventListeners();
    // Mark as initialized after a short delay to prevent initial event emission
    setTimeout(() => {
      this.isInitialized = true;
    }, 100);
  }

  initializeLastValidDifference() {
    const startDate = this.getAttribute('start');
    const endDate = this.getAttribute('end');

    if (startDate && endDate) {
      const diff = this.calculateDaysDifference(startDate, endDate);
      if (diff >= 1 && diff <= 7) {
        this.lastValidDifference = diff;
      }
    }
  }

  calculateDaysDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Guard: shadowRoot may not be rendered yet
    if (!this.shadowRoot) return;

    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');

    // Guard: elements may not exist yet if called before render()
    if (!startDateInput || !endDateInput) return;

    if (name === 'start' || name === 'end') {
      if (name === 'start') {
        startDateInput.value = newValue || '';
      } else if (name === 'end') {
        endDateInput.value = newValue || '';
      }
    }
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || 'Select date range';
    const startDate = this.getAttribute('start') || '';
    const endDate = this.getAttribute('end') || '';
    const now = new Date();
    const today = this.format(now);
    const maxStartDate = today;
    const maxEndDate = this.addDays(today, 1);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .date-range-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }

        .date-range-inputs {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .date-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 150px;
        }

        label {
          font-size: 0.875rem;
          color: #374151;
          font-weight: 500;
        }

        input[type="date"] {
          padding: 10px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: inherit;
          transition: all 0.2s;
          background: white;
          width: 100%;
        }

        input[type="date"]:hover {
          border-color: #d1d5db;
        }

        input[type="date"]:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        input[type="date"].error {
          border-color: #ef4444;
        }

        input[type="date"].error:focus {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }

        .error-message {
          color: #ef4444;
          font-size: 0.75rem;
          margin-top: 4px;
          display: none;
        }

        .error-message.visible {
          display: block;
        }

        .date-info {
          font-size: 0.75rem;
          color: #6b7280;
          font-style: italic;
        }

        .presets {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 6px;
        }

        .preset-btn {
          appearance: none;
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #111827;
          border-radius: 9999px;
          padding: 6px 12px;
          font-size: 0.8125rem;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
        }

        .preset-btn:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .preset-btn:active {
          transform: translateY(1px);
        }

        .preset-btn.active {
          background: #2563eb; /* blue-600 */
          border-color: #2563eb;
          color: #ffffff;
        }

        .preset-btn[disabled] {
          opacity: 0.6;
          cursor: default;
        }

        .preset-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .preset-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #374151;
        }

        .selection-summary {
          font-size: 0.8125rem;
          color: #374151;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 4px 8px;
          border-radius: 9999px;
          white-space: nowrap;
        }

        .separator {
          color: #9ca3af;
          font-weight: 500;
          padding-top: 20px;
        }

        @media (max-width: 640px) {
          .date-range-inputs {
            flex-direction: column;
            align-items: stretch;
          }

          .separator {
            padding-top: 0;
            text-align: center;
          }
        }
      </style>

      <div class="date-range-container">
        <div class="preset-bar">
          <span class="preset-label">Choose a Date Range (1-7 Days)</span>
          <span id="selection-summary" class="selection-summary" aria-live="polite"></span>
        </div>
        <div class="presets" aria-label="Quick date ranges">
          <button type="button" class="preset-btn" data-preset="today" title="Select today" aria-pressed="false">Today</button>
          <button type="button" class="preset-btn" data-preset="yesterday" title="Select yesterday" aria-pressed="false">Yesterday</button>
          <button type="button" class="preset-btn" data-preset="last7" title="Last 7 days including today" aria-pressed="false">Last 7 days</button>
          <button type="button" class="preset-btn" data-preset="custom" title="Pick a custom range" aria-pressed="false">Custom</button>
        </div>
        <div class="date-range-inputs">
          <div class="date-input-group">
            <label for="start-date">Start Date</label>
            <input
              type="date"
              id="start-date"
              value="${startDate}"
              max="${maxStartDate}"
              required
            />
          </div>
          <span class="separator">to</span>
          <div class="date-input-group">
            <label for="end-date">End Date</label>
            <input
              type="date"
              id="end-date"
              value="${endDate}"
              max="${maxEndDate}"
              required
            />
          </div>
        </div>
        <div class="error-message" id="error-message"></div>
        <div class="date-info">End date must be at least 1 day after start date (Max: 7 days)</div>
      </div>
    `;
  }

  setupEventListeners() {
    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');
    const now = new Date();
    const todayISO = this.format(now);
    endDateInput.max = this.addDays(todayISO, 1);

    // Handle start date changes with smart adjustment
    startDateInput.addEventListener('change', () => {
      if (!startDateInput.value) return;

      // Clamp to today if future selected
      if (startDateInput.value > todayISO) {
        startDateInput.value = todayISO;
      }

      endDateInput.min = startDateInput.value;

      if (endDateInput.value) {
        const currentDiff = this.calculateDaysDifference(startDateInput.value, endDateInput.value);

        // If range exceeds 7 days or end date is not after start date, clamp to max 7 days
        if (currentDiff > 7 || currentDiff < 1) {
          const daysUntilToday = Math.max(1, Math.ceil((new Date(todayISO) - new Date(startDateInput.value)) / (1000 * 60 * 60 * 24)));
          const clamped = Math.min(7, daysUntilToday);
          const newEndDate = this.addDays(startDateInput.value, clamped);
          endDateInput.value = newEndDate;
        }
      } else {
        // If no end date, default to 1 day after start
        const daysUntilToday = Math.ceil((new Date(todayISO) - new Date(startDateInput.value)) / (1000 * 60 * 60 * 24));
        const offset = Math.min(1, Math.max(0, daysUntilToday));
        endDateInput.value = this.addDays(startDateInput.value, offset === 0 ? 1 : 1);
      }

      this.validateAndStoreDifference();
      this.updateActivePresetFromInputs();
      this.updateSelectionSummary();
    });

    // Handle end date changes with smart adjustment
    endDateInput.addEventListener('change', () => {
      if (!endDateInput.value) return;

      // Clamp to today if future selected
      if (endDateInput.value > todayISO) {
        endDateInput.value = todayISO;
      }

      startDateInput.max = endDateInput.value;

      if (startDateInput.value) {
        const currentDiff = this.calculateDaysDifference(startDateInput.value, endDateInput.value);

        // If range exceeds 7 days or end date is not after start date, clamp to max 7 days
        if (currentDiff > 7 || currentDiff < 1) {
          const newStartDate = this.subtractDays(endDateInput.value, 7);
          startDateInput.value = newStartDate;
        }
      } else {
        // If no start date, default to 1 day before end
        startDateInput.value = this.subtractDays(endDateInput.value, 1);
      }

      this.validateAndStoreDifference();
      this.updateActivePresetFromInputs();
      this.updateSelectionSummary();
    });

    // Preset selection
    const presets = this.shadowRoot.querySelector('.presets');
    presets.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-preset]');
      if (!btn) return;
      const presetKey = btn.getAttribute('data-preset');
      // Special handling for 'Custom': do not change dates, just enable free selection
      if (presetKey === 'custom') {
        this.setActivePreset('custom');
        this.clearDynamicBounds();
        const startDateInput = this.shadowRoot.getElementById('start-date');
        startDateInput?.focus();
        this.updateSelectionSummary();
        return;
      }
      const { start, end } = this.getPresetDates(presetKey);
      if (!start || !end) return;
      this.setDates(start, end);
      // Maintain last valid difference and emit change
      this.lastValidDifference = this.calculateDaysDifference(start, end);
      // Relax dynamic bounds so the user can freely choose a new custom range next
      this.clearDynamicBounds();
      this.emitDateRangeChanged(start, end);
      this.setActivePreset(presetKey);
      this.updateSelectionSummary();
    });
  }

  addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  subtractDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  validateAndStoreDifference() {
    const validation = this.validateDates();

    // If valid, store the current difference for future use
    if (validation.valid) {
      const startDateInput = this.shadowRoot.getElementById('start-date');
      const endDateInput = this.shadowRoot.getElementById('end-date');

      if (startDateInput.value && endDateInput.value) {
        this.lastValidDifference = this.calculateDaysDifference(
          startDateInput.value,
          endDateInput.value
        );

        // Emit event when date range changes
        this.emitDateRangeChanged(startDateInput.value, endDateInput.value);
        this.updateActivePresetFromInputs();
      }
    }
  }

  emitDateRangeChanged(startDate, endDate) {
    // Only emit event after component is fully initialized
    if (!this.isInitialized) return;

    const event = new CustomEvent('date-range-changed', {
      detail: {
        startDate,
        endDate
      },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  validateDates() {
    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');
    const errorMessage = this.shadowRoot.getElementById('error-message');

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    // Clear previous errors
    startDateInput.classList.remove('error');
    endDateInput.classList.remove('error');
    errorMessage.classList.remove('visible');
    errorMessage.textContent = '';

    if (!startDate || !endDate) {
      return { valid: false, message: 'Both dates are required' };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check if end date is before or equal to start date
    if (end <= start) {
      startDateInput.classList.add('error');
      endDateInput.classList.add('error');
      errorMessage.textContent = 'End date must be at least 1 day after start date';
      errorMessage.classList.add('visible');
      return { valid: false, message: 'End date must be at least 1 day after start date' };
    }

    // Check if dates are more than 7 days apart
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      startDateInput.classList.add('error');
      endDateInput.classList.add('error');
      errorMessage.textContent = `Date range too large: ${diffDays} days. Maximum allowed is 7 days.`;
      errorMessage.classList.add('visible');
      return { valid: false, message: `Date range cannot exceed 7 days (selected: ${diffDays} days)` };
    }

    // Additional check: ensure minimum 1 day difference
    if (diffDays < 1) {
      startDateInput.classList.add('error');
      endDateInput.classList.add('error');
      errorMessage.textContent = 'End date must be at least 1 day after start date';
      errorMessage.classList.add('visible');
      return { valid: false, message: 'End date must be at least 1 day after start date' };
    }

    return { valid: true, message: '' };
  }

  getValue() {
    const validation = this.validateDates();

    if (!validation.valid) {
      return null;
    }

    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');

    return {
      startDate: startDateInput.value,
      endDate: endDateInput.value,
      valid: true
    };
  }

  setDates(startDate, endDate) {
    const now = new Date();
    const todayISO = this.format(now);
    const tomorrowISO = this.addDays(todayISO, 1);
    const safeStart = startDate && startDate > todayISO ? todayISO : startDate;
    const safeEnd = endDate && endDate > tomorrowISO ? tomorrowISO : endDate;
    this.setAttribute('start', safeStart);
    this.setAttribute('end', safeEnd);
    this.validateDates();
    this.updateActivePresetFromInputs();
    this.updateSelectionSummary();
  }

  getStartDate() {
    const startDateInput = this.shadowRoot.getElementById('start-date');
    return startDateInput?.value || '';
  }

  getEndDate() {
    const endDateInput = this.shadowRoot.getElementById('end-date');
    return endDateInput?.value || '';
  }

  isValid() {
    const validation = this.validateDates();
    return validation.valid;
  }

  // Helpers for presets
  format(date) {
    return date.toISOString().split('T')[0];
  }

  clearDynamicBounds() {
    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');
    const now = new Date();
    const todayISO = this.format(now);
    const tomorrowISO = this.addDays(todayISO, 1);
    // Allow picking either side first; invalid combos will be corrected by validation
    startDateInput.min = '';
    startDateInput.max = todayISO;
    endDateInput.min = '';
    endDateInput.max = tomorrowISO;
  }

  getPresetDates(preset) {
    const now = new Date();
    // Ensure we operate on local midnight boundaries

    if (preset === 'today') {
      const end = this.addDays(this.format(now), 1);
      const start = this.format(now);
      return { start, end };
    }
    if (preset === 'yesterday') {
      const end = this.subtractDays(this.format(now));
      const start = this.subtractDays(this.format(now), 1);
      return { start, end };
    }
    if (preset === 'last7') {
      const end = this.format(now);
      const start = this.subtractDays(this.format(now), 7);
      return { start, end };
    }
    return { start: null, end: null };
  }

  setActivePreset(preset) {
    const buttons = this.shadowRoot.querySelectorAll('.preset-btn');
    buttons.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const match = this.shadowRoot.querySelector(`.preset-btn[data-preset="${preset}"]`);
    if (match) {
      match.classList.add('active');
      match.setAttribute('aria-pressed', 'true');
    }
  }

  updateActivePresetFromInputs() {
    const start = this.getStartDate();
    const end = this.getEndDate();
    if (!start || !end) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = this.format(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.format(yesterday);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const twoDaysAgoStr = this.format(twoDaysAgo);
    const last7Start = new Date(today);
    last7Start.setDate(last7Start.getDate() - 7);
    const last7StartStr = this.format(last7Start);

    if (start === yesterdayStr && end === todayStr) {
      this.setActivePreset('today');
    } else if (start === twoDaysAgoStr && end === yesterdayStr) {
      this.setActivePreset('yesterday');
    } else if (start === last7StartStr && end === todayStr) {
      this.setActivePreset('last7');
    } else {
      this.setActivePreset('custom');
    }
  }

  // UX helpers
  formatHuman(dateString) {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateString;
    }
  }

  updateSelectionSummary() {
    const el = this.shadowRoot.getElementById('selection-summary');
    if (!el) return;
    const start = this.getStartDate();
    const end = this.getEndDate();
    if (!start || !end) {
      el.textContent = '';
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    const dayMs = 1000 * 60 * 60 * 24;
    const diffDays = Math.ceil((endDate - startDate) / dayMs);
    const daysText = diffDays === 1 ? '1 day' : `${diffDays} days`;
    el.textContent = `Selected: ${this.formatHuman(start)} → ${this.formatHuman(end)} (${daysText})`;
  }
}

// Define the custom element
customElements.define('date-range-picker', DateRangePicker);

export default DateRangePicker;
