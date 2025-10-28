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
      if (diff >= 0 && diff <= 7) {
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
    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');
    if (name === 'start' && startDateInput) {
      startDateInput.value = newValue || '';
    } else if (name === 'end' && endDateInput) {
      endDateInput.value = newValue || '';
    }
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || 'Select date range';
    const startDate = this.getAttribute('start') || '';
    const endDate = this.getAttribute('end') || '';

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
        <div class="date-range-inputs">
          <div class="date-input-group">
            <label for="start-date">Start Date</label>
            <input
              type="date"
              id="start-date"
              value="${startDate}"
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
              required
            />
          </div>
        </div>
        <div class="error-message" id="error-message"></div>
        <div class="date-info">Maximum 7 days between dates</div>
      </div>
    `;
  }

  setupEventListeners() {
    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');

    // Handle start date changes with smart adjustment
    startDateInput.addEventListener('change', () => {
      if (!startDateInput.value) return;

      endDateInput.min = startDateInput.value;

      if (endDateInput.value) {
        const currentDiff = this.calculateDaysDifference(startDateInput.value, endDateInput.value);

        // If range exceeds 7 days or end date is before start date, auto-adjust
        if (currentDiff > 7 || currentDiff < 0) {
          // Use last valid difference, but cap at 7 days
          const adjustmentDays = Math.min(this.lastValidDifference, 7);
          const newEndDate = this.addDays(startDateInput.value, adjustmentDays);
          endDateInput.value = newEndDate;
        }
      } else {
        // If no end date, set it to start date + last valid difference
        const adjustmentDays = Math.min(this.lastValidDifference, 7);
        endDateInput.value = this.addDays(startDateInput.value, adjustmentDays);
      }

      this.validateAndStoreDifference();
    });

    // Handle end date changes with smart adjustment
    endDateInput.addEventListener('change', () => {
      if (!endDateInput.value) return;

      startDateInput.max = endDateInput.value;

      if (startDateInput.value) {
        const currentDiff = this.calculateDaysDifference(startDateInput.value, endDateInput.value);

        // If range exceeds 7 days or end date is before start date, auto-adjust
        if (currentDiff > 7 || currentDiff < 0) {
          // Use last valid difference, but cap at 7 days
          const adjustmentDays = Math.min(this.lastValidDifference, 7);
          const newStartDate = this.subtractDays(endDateInput.value, adjustmentDays);
          startDateInput.value = newStartDate;
        }
      } else {
        // If no start date, set it to end date - last valid difference
        const adjustmentDays = Math.min(this.lastValidDifference, 7);
        startDateInput.value = this.subtractDays(endDateInput.value, adjustmentDays);
      }

      this.validateAndStoreDifference();
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

    // Check if end date is before start date
    if (end < start) {
      startDateInput.classList.add('error');
      endDateInput.classList.add('error');
      errorMessage.textContent = 'End date must be after start date';
      errorMessage.classList.add('visible');
      return { valid: false, message: 'End date must be after start date' };
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
    this.setAttribute('start', startDate);
    this.setAttribute('end', endDate);
    this.validateDates();
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
}

// Define the custom element
customElements.define('date-range-picker', DateRangePicker);

export default DateRangePicker;

