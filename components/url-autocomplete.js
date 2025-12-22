/**
 * URL Autocomplete Web Component
 * Provides an autocomplete input field for URL selection with text search capabilities
 */
class URLAutocomplete extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.urls = [];
    this.filteredUrls = [];
    this.selectedIndex = -1;
    this.isOpen = false;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || 'Enter URL';
    const value = this.getAttribute('value') || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          width: 100%;
        }

        .autocomplete-container {
          position: relative;
          width: 100%;
        }

        input {
          width: 100%;
          padding: 12px;
          font-size: 16px;
          border: 2px solid #ddd;
          border-radius: 4px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        input:focus {
          outline: none;
          border-color: #4CAF50;
        }

        .suggestions-list {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 300px;
          overflow-y: auto;
          background: white;
          border: 1px solid #ddd;
          border-top: none;
          border-radius: 0 0 4px 4px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          margin-top: -2px;
          display: none;
        }

        .suggestions-list.open {
          display: block;
        }

        .suggestion-item {
          padding: 12px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background-color 0.2s;
          font-size: 14px;
          word-break: break-all;
        }

        .suggestion-item:last-child {
          border-bottom: none;
        }

        .suggestion-item:hover,
        .suggestion-item.selected {
          background-color: #f5f5f5;
        }

        .suggestion-item.selected {
          background-color: #e8f5e9;
        }

        .no-results {
          padding: 12px;
          color: #999;
          font-style: italic;
          font-size: 14px;
        }

        .match-highlight {
          background-color: #fff9c4;
          font-weight: 500;
        }
      </style>

      <div class="autocomplete-container">
        <input
          type="text"
          class="url-input"
          placeholder="${placeholder}"
          value="${value}"
          autocomplete="off"
        />
        <div class="suggestions-list"></div>
      </div>
    `;
  }

  setupEventListeners() {
    const input = this.shadowRoot.querySelector('.url-input');
    const suggestionsList = this.shadowRoot.querySelector('.suggestions-list');

    // Input event for filtering
    input.addEventListener('input', (e) => {
      this.handleInput(e.target.value);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Focus event
    input.addEventListener('focus', () => {
      if (input.value) {
        this.handleInput(input.value);
      }
    });

    input.addEventListener('change', () => {
      this.selectUrl(input.value);
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) {
        this.closeSuggestions();
      }
    });

    // Delegate mousedown events on suggestions (mousedown fires before blur)
    suggestionsList.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent input from losing focus
      const item = e.target.closest('.suggestion-item');
      if (item) {
        const url = item.dataset.url;
        this.selectUrl(url);
      }
    });
  }

  handleInput(value) {
    if (!value || value.length < 2) {
      this.closeSuggestions();
      return;
    }

    // Text search - find URLs that contain the search term (case-insensitive)
    const searchTerm = value.toLowerCase();
    this.filteredUrls = this.urlNames.filter(url =>
      url.toLowerCase().includes(searchTerm)
    )

    this.selectedIndex = -1;
    this.renderSuggestions();
  }

  renderSuggestions() {
    const suggestionsList = this.shadowRoot.querySelector('.suggestions-list');
    const input = this.shadowRoot.querySelector('.url-input');
    const searchTerm = input.value.toLowerCase();

    if (this.filteredUrls.length === 0) {
      suggestionsList.innerHTML = '<div class="no-results">No matching URLs found</div>';
      suggestionsList.classList.add('open');
      this.isOpen = true;
      return;
    }

    const html = this.filteredUrls.map((url, index) => {
      const highlightedUrl = this.highlightMatch(url, searchTerm);
      return `
        <div
          class="suggestion-item ${index === this.selectedIndex ? 'selected' : ''}"
          data-url="${this.escapeHtml(url)}"
          data-index="${index}"
        >
          ${highlightedUrl}
        </div>
      `;
    }).join('');

    suggestionsList.innerHTML = html;
    suggestionsList.classList.add('open');
    this.isOpen = true;
  }

  highlightMatch(url, searchTerm) {
    if (!searchTerm) return this.escapeHtml(url);

    const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
    return this.escapeHtml(url).replace(regex, '<span class="match-highlight">$1</span>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  handleKeyDown(e) {
    if (!this.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredUrls.length - 1);
        this.updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredUrls.length) {
          this.selectUrl(this.filteredUrls[this.selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.closeSuggestions();
        break;
    }
  }

  updateSelection() {
    const items = this.shadowRoot.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  selectUrl(url) {
    const input = this.shadowRoot.querySelector('.url-input');
    input.value = url.split(' (')[0];
    this.closeSuggestions();

    // Dispatch custom event
    this.dispatchEvent(new CustomEvent('url-selected', {
      detail: { url: input.value },
      bubbles: true,
      composed: true
    }));
  }

  closeSuggestions() {
    const suggestionsList = this.shadowRoot.querySelector('.suggestions-list');
    suggestionsList.classList.remove('open');
    this.isOpen = false;
    this.selectedIndex = -1;
  }

  // Public method to set URLs
  async setUrls(urls) {
    if (!this.journeyMapping) {
      const response = await fetch('/forms/journey-mapping.json')
      const urlMapping = await response.json();
      this.journeyMapping = Object.entries(urlMapping).reduce((acc, [key, value]) => {
        acc[value] = acc[value] || [];
        acc[value].push(key);
        return acc;
      }, {});
    }
    this.urlNames = urls.map(url => {
      if (this.journeyMapping[url]) {
        return `${url} (${this.journeyMapping[url]?.join(', ')})`;
      }
      return url;
    });
    this.urls = urls || [];
    // If input has a value and dropdown is open, re-filter with new URLs
    const input = this.shadowRoot.querySelector('.url-input');
    if (input && input.value && this.isOpen) {
      this.handleInput(input.value);
    }
  }

  // Public method to get current value
  getValue() {
    const input = this.shadowRoot.querySelector('.url-input');
    return input ? input.value : '';
  }

  // Public method to set value
  setValue(value) {
    const input = this.shadowRoot.querySelector('.url-input');
    if (input) {
      input.value = value;
    }
  }
}

// Define the custom element
customElements.define('url-autocomplete', URLAutocomplete);

export default URLAutocomplete;

