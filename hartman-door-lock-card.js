class HartmanDoorLockCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._expanded = false;
    this._lastRenderState = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity (door identifier like "panel_2_door_5")');
    }
    this.config = config;
    this._entity = config.entity;
    this._advanced = config.advanced || false;
    this._pulseOnly = config.pulse_only || false;
    this._pulseGrid = config.pulse_grid || false;
    this._gridColumns = config.columns || 4;
    this._customName = config.name || '';
    this._nameTextCase = config.name_text_case || 'uppercase'; // uppercase, capitalize, none
    this._textCase = config.text_case || 'uppercase'; // uppercase, capitalize, none
    this._showLog = config.show_log !== false; // Default to true for backward compatibility
    this._purpleOutline = config.purple_outline !== false; // Default to true
    this._showDoubleClickNote = config.show_double_click_note !== false; // Default to true
    this._colorTheme = config.color_theme || 'purple'; // purple, blue, green - DEFAULT PURPLE
    this._ooStyle = config.oo_style || false; // Default to false - OnOff Style with blue outlines only
    this._transparentBg = config.transparent_bg || false; // Default to false - solid background
    this._filledButtons = config.filled_buttons || false; // Default to false - outlined buttons
  }

  getThemeColors() {
    const themes = {
      purple: {
        primary: '#9b59b6',
        primaryDark: '#8e44ad',
        primaryLight: 'rgba(155, 89, 182, 0.1)',
        primaryShadow: 'rgba(155, 89, 182, 0.4)',
        primaryBorder: 'rgba(155, 89, 182, 0.25)'
      },
      blue: {
        primary: '#3498db',
        primaryDark: '#2980b9',
        primaryLight: 'rgba(52, 152, 219, 0.1)',
        primaryShadow: 'rgba(52, 152, 219, 0.4)',
        primaryBorder: 'rgba(52, 152, 219, 0.25)'
      },
      green: {
        primary: '#2ecc71',
        primaryDark: '#27ae60',
        primaryLight: 'rgba(46, 204, 113, 0.1)',
        primaryShadow: 'rgba(46, 204, 113, 0.4)',
        primaryBorder: 'rgba(46, 204, 113, 0.25)'
      }
    };
    // When OO style is enabled, always use blue theme
    if (this._ooStyle) {
      return themes.blue;
    }
    return themes[this._colorTheme] || themes.purple;
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    // Only re-render if relevant entities have changed or if entity not configured yet
    if (!this._entity || !oldHass || this._hasStateChanged(oldHass, hass)) {
      this.render();
    }
  }

  _hasStateChanged(oldHass, newHass) {
    if (!this._entity) return true;

    const entities = [
      `sensor.${this._entity}_lock_state`,
      `switch.${this._entity}_override`,
      `sensor.${this._entity}_overridden`,
      `select.${this._entity}_override_mode`,
      `select.${this._entity}_override_type`,
      `number.${this._entity}_override_minutes`,
      `sensor.${this._entity}_reader_mode`,
      `sensor.${this._entity}_last_door_log_by`
    ];

    return entities.some(entity => {
      const oldState = oldHass.states[entity];
      const newState = newHass.states[entity];

      if (!oldState && !newState) return false;
      if (!oldState || !newState) return true;

      // Check if state or attributes changed
      if (oldState.state !== newState.state) return true;

      // For last_door_log_by, also check the timestamp attribute
      if (entity.includes('last_door_log_by')) {
        const oldTime = oldState.attributes?.['Reader Message Time'] || oldState.attributes?.reader_message_time;
        const newTime = newState.attributes?.['Reader Message Time'] || newState.attributes?.reader_message_time;
        if (oldTime !== newTime) return true;
      }

      return false;
    });
  }

  getCardSize() {
    if (this._pulseOnly || this._pulseGrid) return 1;
    return this._advanced && this._expanded ? 4 : 2;
  }

  formatText(text, useNameCase = false) {
    if (!text) return '';
    const textCase = useNameCase ? this._nameTextCase : this._textCase;
    switch (textCase) {
      case 'uppercase':
        return text.toUpperCase();
      case 'capitalize':
        return text.replace(/\b\w/g, l => l.toUpperCase());
      case 'none':
      default:
        return text;
    }
  }

  formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';

    try {
      const date = new Date(dateTimeString);

      // Check if date is valid
      if (isNaN(date.getTime())) return dateTimeString;

      // Format: Dec 12, 2025 at 12:43:40 AM
      const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };

      const formatted = new Intl.DateTimeFormat('en-US', options).format(date);
      // Replace comma with " at" for better readability
      return formatted.replace(',', ' at');
    } catch (e) {
      // If parsing fails, return original string
      return dateTimeString;
    }
  }

  getTextCaseStyle(useNameCase = false) {
    const textCase = useNameCase ? this._nameTextCase : this._textCase;
    switch (textCase) {
      case 'uppercase':
        return 'text-transform: uppercase; letter-spacing: 0.5px;';
      case 'capitalize':
        return 'text-transform: capitalize;';
      case 'none':
      default:
        return '';
    }
  }

  render() {
    if (!this._hass) return;

    const lockState = this._hass.states[`sensor.${this._entity}_lock_state`];
    const overrideSwitch = this._hass.states[`switch.${this._entity}_override`];
    const overriddenSensor = this._hass.states[`sensor.${this._entity}_overridden`];
    const overrideMode = this._hass.states[`select.${this._entity}_override_mode`];
    const overrideType = this._hass.states[`select.${this._entity}_override_type`];
    const overrideMinutes = this._hass.states[`number.${this._entity}_override_minutes`];
    const readerMode = this._hass.states[`sensor.${this._entity}_reader_mode`];
    const lastDoorLog = this._hass.states[`sensor.${this._entity}_last_door_log_by`];

    const isLocked = lockState?.state === 'locked';
    const isOverrideOn = overrideSwitch?.state === 'on';
    const isOverridden = overriddenSensor?.state === 'on';
    const currentMode = overrideMode?.state;

    // Get last door log time from attributes
    const lastDoorLogTime = lastDoorLog?.attributes?.['Reader Message Time'] || lastDoorLog?.attributes?.reader_message_time || '';

    // Determine status based on control mode
    let statusColor, statusText, controlledBy;

    if (!isOverrideOn) {
      controlledBy = 'Hartman';
      statusText = lockState?.state || 'Unknown';
      statusColor = isLocked ? '#e74c3c' : '#2ecc71';
    } else {
      controlledBy = 'Home Assistant';
      const overrideTypeState = this._hass.states[`select.${this._entity}_override_type`];
      statusText = `${currentMode || 'Override'}`;
      
      if (currentMode === 'Lockdown') {
        statusColor = '#f39c12';
      } else if (currentMode === 'Unlock') {
        statusColor = '#2ecc71';
      } else {
        statusColor = '#3498db';
      }
    }

    const doorName = this._customName || this._entity.replace(/_/g, ' ').replace(/panel (\d+) door (\d+)/i, 'Door $2');
    const nameTextCaseStyle = this.getTextCaseStyle(true);
    const textCaseStyle = this.getTextCaseStyle();
    const theme = this.getThemeColors();

    // Pulse Grid mode (small clean button)
    if (this._pulseGrid) {
      this.shadowRoot.innerHTML = `
        <style>
          @import url('https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :host {
            display: block;
            position: relative;
            z-index: 1;
          }

          :host(.dialog-open) {
            z-index: 99999999 !important;
          }

          .pulse-grid-card {
            background: ${this._transparentBg ? theme.primaryLight : 'var(--ha-card-background, #fff)'};
            border-radius: 16px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            cursor: pointer;
            transition: all 0.15s ease;
            position: relative;
            min-height: 80px;
            overflow: visible;
            ${this._ooStyle ? 'border: 2.5px solid #3498db;' : (this._purpleOutline ? `border: 2.5px solid ${theme.primary};` : '')}
          }

          .pulse-grid-card.advanced-mode {
            box-shadow: 0 2px 8px ${theme.primaryBorder}, 0 0 0 1px ${theme.primaryLight};
          }

          .pulse-grid-card:hover {
            background: var(--secondary-background-color, #f5f5f5);
          }

          .pulse-grid-card:active {
            transform: scale(0.97);
          }

          .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${statusColor};
            box-shadow: 0 0 6px ${statusColor}80;
            position: absolute;
            top: 10px;
            right: 10px;
          }

          .advanced-indicator {
            position: absolute;
            top: 8px;
            left: 8px;
            font-size: 16px;
            color: ${theme.primary};
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .pulse-grid-name {
            font-size: 11px;
            font-weight: 600;
            color: ${theme.primary};
            text-align: center;
            line-height: 1.2;
            ${nameTextCaseStyle}
          }

          .pulse-grid-btn {
            background: transparent;
            border: 2px solid ${theme.primary};
            border-radius: 10px;
            padding: 6px 14px;
            color: ${theme.primary};
            font-size: 10px;
            font-weight: 600;
            ${textCaseStyle}
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .pulse-grid-btn:hover {
            background: ${theme.primary};
            color: white;
          }

          .dialog-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.6);
            z-index: 2147483647;
            backdrop-filter: blur(3px);
            -webkit-backdrop-filter: blur(3px);
          }

          .dialog-overlay.open {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .dialog-content {
            background: var(--ha-card-background, #fff);
            border-radius: 16px;
            padding: 0;
            width: 400px;
            max-width: 90vw;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 12px 48px rgba(0,0,0,0.4);
            position: relative;
            animation: slideIn 0.2s ease-out;
            z-index: 2147483647;
          }

          .dialog-content.dragging {
            cursor: grabbing;
            user-select: none;
            position: fixed;
          }

          .dialog-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: ${theme.primaryLight};
            overflow: hidden;
            border-radius: 0 0 16px 16px;
          }

          .dialog-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, ${theme.primary}, ${theme.primaryDark});
            width: 100%;
            transform-origin: left;
            animation: countdown 10s linear forwards;
          }

          @keyframes countdown {
            from {
              transform: scaleX(1);
            }
            to {
              transform: scaleX(0);
            }
          }

          @keyframes slideIn {
            from {
              transform: scale(0.95);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          .dialog-header {
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--divider-color, #eee);
            position: sticky;
            top: 0;
            background: var(--ha-card-background, #fff);
            z-index: 10;
            cursor: grab;
            user-select: none;
          }

          .dialog-header:active {
            cursor: grabbing;
          }

          .dialog-title {
            font-size: 16px;
            font-weight: 600;
            color: ${theme.primary};
            ${nameTextCaseStyle}
          }

          .close-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--secondary-text-color, #999);
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
          }

          .close-btn:hover {
            background: var(--secondary-background-color, #f5f5f5);
            color: var(--primary-text-color, #333);
          }

          .dialog-body {
            padding: 16px;
            max-height: calc(80vh - 73px - 3px);
            overflow-y: auto;
          }

          .dialog-status {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: var(--secondary-background-color, #fafafa);
            border-radius: 8px;
            margin-bottom: 16px;
          }

          .dialog-status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: ${statusColor};
            box-shadow: 0 0 8px ${statusColor}80;
          }

          .dialog-status-text {
            font-size: 12px;
            color: ${theme.primary};
            ${textCaseStyle}
          }

          .dialog-note {
            font-size: 10px;
            color: var(--secondary-text-color, #999);
            font-style: italic;
            margin-top: 8px;
            margin-bottom: 8px;
            text-align: center;
            ${textCaseStyle}
          }

          .dialog-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .dialog-action-btn {
            border: 2px solid;
            border-radius: 12px;
            padding: 14px 12px;
            font-size: 11px;
            font-weight: 600;
            ${textCaseStyle}
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            background: transparent;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .dialog-action-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.15);
          }

          .dialog-action-btn:active:not(:disabled) {
            transform: translateY(0) scale(0.98);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .dialog-action-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .dialog-action-btn.pulse {
            border-color: ${this._ooStyle ? '#3498db' : theme.primary};
            color: ${this._filledButtons ? 'white' : theme.primary};
            background: ${this._filledButtons ? theme.primary : 'transparent'};
          }
          .dialog-action-btn.pulse:hover:not(:disabled) {
            background: ${theme.primary};
            color: white;
            box-shadow: 0 6px 16px ${theme.primaryShadow};
          }

          .dialog-action-btn.lockdown {
            border-color: ${this._ooStyle ? '#3498db' : '#e74c3c'};
            color: ${this._filledButtons ? 'white' : '#e74c3c'};
            background: ${this._filledButtons ? '#e74c3c' : 'transparent'};
          }
          .dialog-action-btn.lockdown:hover:not(:disabled) {
            background: #e74c3c;
            color: white;
            box-shadow: 0 6px 16px rgba(231, 76, 60, 0.4);
          }

          .dialog-action-btn.unlock {
            border-color: ${this._ooStyle ? '#3498db' : '#2ecc71'};
            color: ${this._filledButtons ? 'white' : '#2ecc71'};
            background: ${this._filledButtons ? '#2ecc71' : 'transparent'};
          }
          .dialog-action-btn.unlock:hover:not(:disabled) {
            background: #2ecc71;
            color: white;
            box-shadow: 0 6px 16px rgba(46, 204, 113, 0.4);
          }

          .dialog-action-btn.resume {
            border-color: ${this._ooStyle ? '#3498db' : theme.primary};
            color: ${this._filledButtons ? 'white' : theme.primary};
            background: ${this._filledButtons ? theme.primary : 'transparent'};
          }
          .dialog-action-btn.resume:hover:not(:disabled) {
            background: ${theme.primary};
            color: white;
            box-shadow: 0 6px 16px ${theme.primaryShadow};
          }

          .dialog-btn-icon {
            width: 20px;
            height: 20px;
            display: inline-block;
          }
        </style>

        <div class="pulse-grid-card ${this._advanced ? 'advanced-mode' : ''}" id="cardClick">
          ${this._advanced ? '<div class="advanced-indicator"><svg viewBox="0 0 24 24" style="width: 16px; height: 16px;"><path fill="currentColor" d="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z"/></svg></div>' : ''}
          <div class="status-indicator"></div>
          <div class="pulse-grid-name">${this.formatText(doorName, true)}</div>
          <button class="pulse-grid-btn" id="pulseBtn">${this.formatText('Pulse')}</button>
        </div>

        ${this._advanced ? `
          <div class="dialog-overlay" id="dialogOverlay">
            <div class="dialog-content" id="dialogContent">
              <div class="dialog-header">
                <div class="dialog-title">${this.formatText(doorName, true)}</div>
                <button class="close-btn" id="closeBtn">×</button>
              </div>
              <div class="dialog-body">
                <div class="dialog-status">
                  <div class="dialog-status-dot"></div>
                  <div class="dialog-status-text">${this.formatText(statusText)}${readerMode ? ` · ${this.formatText(readerMode.state)}` : ''} · Controlled by ${this.formatText(controlledBy)}</div>
                </div>
                ${this._showDoubleClickNote ? `<div class="dialog-note">${this.formatText('Note: Override buttons require double-click to activate')}</div>` : ''}
                <div class="dialog-actions">
                  <button class="dialog-action-btn pulse" id="dialogPulseBtn">
                    <svg class="dialog-btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,10.5A1.5,1.5 0 0,0 10.5,12A1.5,1.5 0 0,0 12,13.5A1.5,1.5 0 0,0 13.5,12A1.5,1.5 0 0,0 12,10.5Z"/></svg>
                    ${this.formatText('Pulse')}
                  </button>
                  <button class="dialog-action-btn lockdown" id="dialogLockdownBtn">
                    <svg class="dialog-btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/></svg>
                    ${this.formatText('Lockdown')}
                  </button>
                  <button class="dialog-action-btn unlock" id="dialogUnlockBtn">
                    <svg class="dialog-btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10A2,2 0 0,1 6,8H15V6A3,3 0 0,0 12,3A3,3 0 0,0 9,6H7A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,17A2,2 0 0,0 14,15A2,2 0 0,0 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17Z"/></svg>
                    ${this.formatText('Unlock')}
                  </button>
                  <button class="dialog-action-btn resume" id="dialogResumeBtn" ${!isOverrideOn ? 'disabled' : ''}>
                    <svg class="dialog-btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z"/></svg>
                    ${this.formatText('Resume')}
                  </button>
                </div>
              </div>
              <div class="dialog-progress">
                <div class="dialog-progress-bar" id="dialogProgressBar"></div>
              </div>
            </div>
          </div>
        ` : ''}
      `;

      const cardClick = this.shadowRoot.getElementById('cardClick');
      const pulseBtn = this.shadowRoot.getElementById('pulseBtn');

      // Pulse button - just pulse
      pulseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pulseUnlock();
      });

      // Only set up dialog if advanced mode is enabled
      if (this._advanced) {
        const dialogOverlay = this.shadowRoot.getElementById('dialogOverlay');
        const dialogContent = this.shadowRoot.getElementById('dialogContent');
        const dialogHeader = this.shadowRoot.querySelector('.dialog-header');
        const closeBtn = this.shadowRoot.getElementById('closeBtn');
        const dialogPulseBtn = this.shadowRoot.getElementById('dialogPulseBtn');
        const dialogLockdownBtn = this.shadowRoot.getElementById('dialogLockdownBtn');
        const dialogUnlockBtn = this.shadowRoot.getElementById('dialogUnlockBtn');
        const dialogResumeBtn = this.shadowRoot.getElementById('dialogResumeBtn');
        const dialogProgressBar = this.shadowRoot.getElementById('dialogProgressBar');

        let autoCloseTimer = null;

        // Card click - open dialog
        cardClick.addEventListener('click', (e) => {
          if (e.target.id !== 'pulseBtn') {
            // Add dialog-open class to host to increase z-index
            this.classList.add('dialog-open');

            dialogOverlay.classList.add('open');
            // Reset position when opening
            dialogContent.style.position = 'relative';
            dialogContent.style.left = '';
            dialogContent.style.top = '';
            dialogContent.style.transform = '';

            // Restart progress bar animation
            if (dialogProgressBar) {
              dialogProgressBar.style.animation = 'none';
              setTimeout(() => {
                dialogProgressBar.style.animation = 'countdown 10s linear forwards';
              }, 10);
            }

            // Clear any existing timer
            if (autoCloseTimer) {
              clearTimeout(autoCloseTimer);
            }

            // Set 10-second auto-close timer
            autoCloseTimer = setTimeout(() => {
              closeDialog();
            }, 10000);
          }
        });

        // Close dialog
        const closeDialog = () => {
          // Remove dialog-open class from host to reset z-index
          this.classList.remove('dialog-open');

          dialogOverlay.classList.remove('open');
          // Clear the auto-close timer
          if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
          }
        };

        closeBtn.addEventListener('click', closeDialog);

        dialogOverlay.addEventListener('click', (e) => {
          if (e.target === dialogOverlay) {
            closeDialog();
          }
        });

        dialogContent.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        // Make dialog draggable
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        dialogHeader.addEventListener('mousedown', (e) => {
          if (e.target.id === 'closeBtn' || e.target.closest('#closeBtn')) return;

          isDragging = true;
          dialogContent.classList.add('dragging');

          const rect = dialogContent.getBoundingClientRect();
          initialX = e.clientX - rect.left;
          initialY = e.clientY - rect.top;

          // Convert from flexbox centered to fixed positioning
          dialogContent.style.position = 'fixed';
          dialogContent.style.left = rect.left + 'px';
          dialogContent.style.top = rect.top + 'px';
          dialogContent.style.transform = 'none';

          // Pause auto-close timer while dragging
          if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
          }

          // Pause progress bar animation
          if (dialogProgressBar) {
            dialogProgressBar.style.animationPlayState = 'paused';
          }

          e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return;

          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;

          dialogContent.style.left = currentX + 'px';
          dialogContent.style.top = currentY + 'px';
        });

        document.addEventListener('mouseup', () => {
          if (isDragging) {
            isDragging = false;
            dialogContent.classList.remove('dragging');

            // Restart auto-close timer (full 10 seconds)
            if (autoCloseTimer) {
              clearTimeout(autoCloseTimer);
            }
            autoCloseTimer = setTimeout(() => {
              closeDialog();
            }, 10000);

            // Restart progress bar animation
            if (dialogProgressBar) {
              dialogProgressBar.style.animation = 'none';
              setTimeout(() => {
                dialogProgressBar.style.animation = 'countdown 10s linear forwards';
              }, 10);
            }
          }
        });

        // Touch support for mobile
        dialogHeader.addEventListener('touchstart', (e) => {
          if (e.target.id === 'closeBtn' || e.target.closest('#closeBtn')) return;

          isDragging = true;
          dialogContent.classList.add('dragging');

          const rect = dialogContent.getBoundingClientRect();
          const touch = e.touches[0];
          initialX = touch.clientX - rect.left;
          initialY = touch.clientY - rect.top;

          // Convert from flexbox centered to fixed positioning
          dialogContent.style.position = 'fixed';
          dialogContent.style.left = rect.left + 'px';
          dialogContent.style.top = rect.top + 'px';
          dialogContent.style.transform = 'none';

          // Pause auto-close timer while dragging
          if (autoCloseTimer) {
            clearTimeout(autoCloseTimer);
            autoCloseTimer = null;
          }

          // Pause progress bar animation
          if (dialogProgressBar) {
            dialogProgressBar.style.animationPlayState = 'paused';
          }

          e.preventDefault();
        });

        document.addEventListener('touchmove', (e) => {
          if (!isDragging) return;

          e.preventDefault();
          const touch = e.touches[0];
          currentX = touch.clientX - initialX;
          currentY = touch.clientY - initialY;

          dialogContent.style.left = currentX + 'px';
          dialogContent.style.top = currentY + 'px';
        }, { passive: false });

        document.addEventListener('touchend', () => {
          if (isDragging) {
            isDragging = false;
            dialogContent.classList.remove('dragging');

            // Restart auto-close timer (full 10 seconds)
            if (autoCloseTimer) {
              clearTimeout(autoCloseTimer);
            }
            autoCloseTimer = setTimeout(() => {
              closeDialog();
            }, 10000);

            // Restart progress bar animation
            if (dialogProgressBar) {
              dialogProgressBar.style.animation = 'none';
              setTimeout(() => {
                dialogProgressBar.style.animation = 'countdown 10s linear forwards';
              }, 10);
            }
          }
        });

        // Dialog action buttons
        dialogPulseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.pulseUnlock();
        });

        dialogLockdownBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.lockdownDoor();
        });

        dialogUnlockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.unlockDoor();
        });

        dialogResumeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.resumeDoor();
        });
      } else {
        // If not in advanced mode, clicking the card (outside pulse button) should pulse
        cardClick.addEventListener('click', (e) => {
          if (e.target.id !== 'pulseBtn' && !e.target.closest('#pulseBtn')) {
            this.pulseUnlock();
          }
        });
      }

      return;
    }

    // Pulse-only compact mode (single row)
    if (this._pulseOnly) {
      this.shadowRoot.innerHTML = `
        <style>
          @import url('https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :host {
            display: block;
            position: relative;
            z-index: 1;
          }
          
          .pulse-card {
            background: ${this._transparentBg ? theme.primaryLight : 'var(--ha-card-background, #fff)'};
            border-radius: 16px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            ${this._ooStyle ? 'border: 2.5px solid #3498db;' : ''}
          }
          
          .pulse-info {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }
          
          .pulse-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${statusColor};
            flex-shrink: 0;
          }
          
          .pulse-name {
            font-size: 13px;
            font-weight: 600;
            color: ${theme.primary};
            ${nameTextCaseStyle}
          }
          
          .pulse-status {
            font-size: 10px;
            color: var(--secondary-text-color, #666);
            text-transform: capitalize;
          }
          
          .pulse-btn {
            background: transparent;
            border: 2px solid ${theme.primary};
            border-radius: 10px;
            padding: 8px 14px;
            color: ${theme.primary};
            font-size: 11px;
            font-weight: 600;
            ${textCaseStyle}
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .pulse-btn:hover {
            background: ${theme.primary};
            color: white;
          }
          
          .pulse-btn:active {
            transform: scale(0.96);
          }
        </style>
        
        <div class="pulse-card">
          <div class="pulse-info">
            <div class="pulse-indicator"></div>
            <div>
              <div class="pulse-name">${this.formatText(doorName, true)}</div>
              <div class="pulse-status">${statusText}</div>
            </div>
          </div>
          <button class="pulse-btn" id="pulseBtn">${this.formatText('Pulse')}</button>
        </div>
      `;
      
      this.shadowRoot.getElementById('pulseBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.pulseUnlock();
      });
      return;
    }

    // Full card mode
    this.shadowRoot.innerHTML = `
      <style>
        @import url('https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :host {
          display: block;
          position: relative;
          z-index: 1;
        }

        .card {
          background: ${this._transparentBg ? theme.primaryLight : 'var(--ha-card-background, #fff)'};
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          position: relative;
          ${this._ooStyle ? 'border: 2.5px solid #3498db;' : ''}
        }

        .header {
          padding: 16px 16px 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--divider-color, #eee);
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${statusColor};
          box-shadow: 0 0 8px ${statusColor}80;
          flex-shrink: 0;
        }

        .door-name {
          font-size: 15px;
          font-weight: 600;
          color: ${theme.primary};
          ${nameTextCaseStyle}
        }

        .door-status {
          font-size: 11px;
          color: ${theme.primary};
          margin-top: 2px;
          ${textCaseStyle}
        }

        .override-note {
          font-size: 9px;
          color: var(--secondary-text-color, #999);
          font-style: italic;
          margin-top: 4px;
          ${textCaseStyle}
        }

        .actions {
          padding: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 8px;
        }

        .action-btn {
          border: 2px solid;
          border-radius: 12px;
          padding: 12px 8px;
          font-size: 10px;
          font-weight: 600;
          ${textCaseStyle}
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: transparent;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.15);
        }

        .action-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.98);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .action-btn.pulse {
          border-color: ${this._ooStyle ? '#3498db' : theme.primary};
          color: ${this._filledButtons ? 'white' : theme.primary};
          background: ${this._filledButtons ? theme.primary : 'transparent'};
        }
        .action-btn.pulse:hover:not(:disabled) {
          background: ${theme.primary};
          color: white;
          box-shadow: 0 6px 16px ${theme.primaryShadow};
        }

        .action-btn.lockdown {
          border-color: ${this._ooStyle ? '#3498db' : '#e74c3c'};
          color: ${this._filledButtons ? 'white' : '#e74c3c'};
          background: ${this._filledButtons ? '#e74c3c' : 'transparent'};
        }
        .action-btn.lockdown:hover:not(:disabled) {
          background: #e74c3c;
          color: white;
          box-shadow: 0 6px 16px rgba(231, 76, 60, 0.4);
        }

        .action-btn.unlock {
          border-color: ${this._ooStyle ? '#3498db' : '#2ecc71'};
          color: ${this._filledButtons ? 'white' : '#2ecc71'};
          background: ${this._filledButtons ? '#2ecc71' : 'transparent'};
        }
        .action-btn.unlock:hover:not(:disabled) {
          background: #2ecc71;
          color: white;
          box-shadow: 0 6px 16px rgba(46, 204, 113, 0.4);
        }

        .action-btn.resume {
          border-color: ${this._ooStyle ? '#3498db' : theme.primary};
          color: ${this._filledButtons ? 'white' : theme.primary};
          background: ${this._filledButtons ? theme.primary : 'transparent'};
        }
        .action-btn.resume:hover:not(:disabled) {
          background: ${theme.primary};
          color: white;
          box-shadow: 0 6px 16px ${theme.primaryShadow};
        }

        .btn-icon {
          width: 20px;
          height: 20px;
          display: inline-block;
        }

        .advanced {
          border-top: 1px solid var(--divider-color, #eee);
          position: relative;
          z-index: 2;
        }

        .advanced-header {
          padding: 10px 16px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--secondary-background-color, #fafafa);
          transition: background 0.2s;
          position: relative;
        }

        .advanced-header:hover {
          background: var(--divider-color, #f0f0f0);
        }

        .advanced-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--secondary-text-color, #666);
          ${textCaseStyle}
        }

        .expand-icon {
          color: var(--secondary-text-color, #999);
          transition: transform 0.2s;
          font-size: 10px;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        .advanced-content {
          padding: 16px;
          background: var(--secondary-background-color, #fafafa);
          border-radius: 0 0 16px 16px;
        }

        .override-section {
          background: ${isOverrideOn ? 'rgba(230, 126, 34, 0.08)' : 'rgba(0,0,0,0.02)'};
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .override-hint {
          padding: 8px 0 12px 0;
          text-align: center;
        }

        .override-controls {
          display: grid;
          gap: 10px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .field-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--secondary-text-color, #666);
          ${textCaseStyle}
        }

        .field.disabled .field-label {
          opacity: 0.5;
        }

        input[type="number"],
        select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 10px;
          font-size: 13px;
          background: white;
          font-family: inherit;
          color: var(--primary-text-color, #333);
          transition: border-color 0.2s, opacity 0.2s;
          position: relative;
          z-index: 3;
        }

        input[type="number"]:focus,
        select:focus {
          outline: none;
          border-color: var(--primary-color, #3498db);
        }

        input[type="number"]:disabled,
        select:disabled {
          background: #f5f5f5;
          color: #999;
          cursor: not-allowed;
          opacity: 0.5;
        }

        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .apply-btn {
          width: 100%;
          background: #e67e22;
          border: none;
          border-radius: 10px;
          padding: 10px;
          color: white;
          font-size: 11px;
          font-weight: 600;
          ${textCaseStyle}
          cursor: pointer;
          transition: all 0.15s ease;
          margin-top: 10px;
        }

        .apply-btn:hover {
          background: ${this._ooStyle ? '#3498db' : '#d35400'};
        }

        .apply-btn:active {
          transform: scale(0.98);
        }

        .apply-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .info-section {
          margin-top: 12px;
        }

        .info-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .info-box {
          flex: 1;
          padding: 10px;
          background: rgba(52, 152, 219, 0.08);
          border-radius: 10px;
          text-align: center;
        }

        .info-box.log {
          background: ${theme.primaryLight};
          text-align: left;
        }

        .info-label {
          font-size: 9px;
          color: var(--secondary-text-color, #999);
          ${textCaseStyle}
          margin-bottom: 2px;
        }

        .info-value {
          font-size: 12px;
          font-weight: 600;
          color: var(--primary-text-color, #333);
        }

        .info-box.log .info-value {
          font-size: 11px;
          font-weight: 500;
          word-break: break-word;
        }

        .info-time {
          font-size: 9px;
          color: var(--secondary-text-color, #888);
          margin-top: 4px;
        }
      </style>

      <div class="card">
        <div class="header">
          <div class="status-dot"></div>
          <div>
            <div class="door-name">${this.formatText(doorName, true)}</div>
            <div class="door-status">${this.formatText(statusText)}${readerMode ? ` · ${this.formatText(readerMode.state)}` : ''} · Controlled by ${this.formatText(controlledBy)}</div>
            ${this._advanced && this._showDoubleClickNote ? `<div class="override-note">${this.formatText('Note: Override buttons require double-click to activate')}</div>` : ''}
          </div>
        </div>

        <div class="actions">
          <button class="action-btn pulse" id="pulseBtn">
            <svg class="btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,10.5A1.5,1.5 0 0,0 10.5,12A1.5,1.5 0 0,0 12,13.5A1.5,1.5 0 0,0 13.5,12A1.5,1.5 0 0,0 12,10.5Z"/></svg>
            ${this.formatText('Pulse')}
          </button>
          <button class="action-btn lockdown" id="lockdownBtn">
            <svg class="btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/></svg>
            ${this.formatText('Lockdown')}
          </button>
          <button class="action-btn unlock" id="unlockBtn">
            <svg class="btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10A2,2 0 0,1 6,8H15V6A3,3 0 0,0 12,3A3,3 0 0,0 9,6H7A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,17A2,2 0 0,0 14,15A2,2 0 0,0 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17Z"/></svg>
            ${this.formatText('Unlock')}
          </button>
          <button class="action-btn resume" id="resumeBtn" ${!isOverrideOn ? 'disabled' : ''}>
            <svg class="btn-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z"/></svg>
            ${this.formatText('Resume')}
          </button>
        </div>

        ${this._advanced ? `
          <div class="advanced">
            <div class="advanced-header" id="advancedToggle">
              <span class="advanced-title">${this.formatText('Advanced Settings')}</span>
              <span class="expand-icon ${this._expanded ? 'expanded' : ''}">▼</span>
            </div>
            ${this._expanded ? `
              <div class="advanced-content">
                <div class="override-section">
                  <div class="override-controls">
                    <div class="field">
                      <div class="field-label">${this.formatText('Duration (Minutes)')}</div>
                      <input
                        type="number"
                        id="minutes"
                        value="${overrideMinutes?.state || 0}"
                        min="0"
                        step="1"
                      />
                    </div>

                    <div class="field-row">
                      <div class="field">
                        <div class="field-label">${this.formatText('Override Mode')}</div>
                        <select id="mode">
                          ${this.getOptions(overrideMode)}
                        </select>
                      </div>

                      <div class="field">
                        <div class="field-label">${this.formatText('Override Type')}</div>
                        <select id="type">
                          ${this.getOptions(overrideType)}
                        </select>
                      </div>
                    </div>

                    <button class="apply-btn" id="applyOverrideBtn">
                      ${this.formatText('Apply Override')}
                    </button>
                  </div>
                </div>

                <div class="info-section">
                  ${readerMode ? `
                    <div class="info-row">
                      <div class="info-box">
                        <div class="info-label">${this.formatText('Reader Mode')}</div>
                        <div class="info-value">${readerMode.state}</div>
                      </div>
                    </div>
                  ` : ''}

                  ${this._showLog && lastDoorLog ? `
                    <div class="info-row">
                      <div class="info-box log">
                        <div class="info-label">${this.formatText('Last Door Log')}</div>
                        <div class="info-value">${lastDoorLog.state}</div>
                        ${lastDoorLogTime ? `<div class="info-time">${this.formatDateTime(lastDoorLogTime)}</div>` : ''}
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  getOptions(entity) {
    if (!entity?.attributes?.options) {
      return '<option>Loading...</option>';
    }
    return entity.attributes.options
      .map(opt => `<option value="${opt}" ${entity.state === opt ? 'selected' : ''}>${opt}</option>`)
      .join('');
  }

  attachEventListeners() {
    const lockdownBtn = this.shadowRoot.getElementById('lockdownBtn');
    const unlockBtn = this.shadowRoot.getElementById('unlockBtn');
    const resumeBtn = this.shadowRoot.getElementById('resumeBtn');
    const pulseBtn = this.shadowRoot.getElementById('pulseBtn');
    const advancedToggle = this.shadowRoot.getElementById('advancedToggle');
    const applyOverrideBtn = this.shadowRoot.getElementById('applyOverrideBtn');

    if (lockdownBtn) {
      lockdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.lockdownDoor();
      });
    }

    if (unlockBtn) {
      unlockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.unlockDoor();
      });
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resumeDoor();
      });
    }

    if (pulseBtn) {
      pulseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pulseUnlock();
      });
    }

    if (advancedToggle) {
      advancedToggle.addEventListener('click', () => {
        this._expanded = !this._expanded;
        this.render();
      });
    }

    if (applyOverrideBtn) {
      applyOverrideBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyOverride();
      });
    }
  }

  async applyOverride() {
    const minutes = this.shadowRoot.getElementById('minutes');
    const mode = this.shadowRoot.getElementById('mode');
    const type = this.shadowRoot.getElementById('type');

    // Turn on override first
    await this._hass.callService('switch', 'turn_on', {
      entity_id: `switch.${this._entity}_override`
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    // Set duration
    if (minutes) {
      await this._hass.callService('number', 'set_value', {
        entity_id: `number.${this._entity}_override_minutes`,
        value: parseFloat(minutes.value)
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Set mode
    if (mode) {
      await this._hass.callService('select', 'select_option', {
        entity_id: `select.${this._entity}_override_mode`,
        option: mode.value
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Set type
    if (type) {
      await this._hass.callService('select', 'select_option', {
        entity_id: `select.${this._entity}_override_type`,
        option: type.value
      });
    }
  }

  async unlockDoor() {
    await this._hass.callService('switch', 'turn_on', {
      entity_id: `switch.${this._entity}_override`
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    await this._hass.callService('select', 'select_option', {
      entity_id: `select.${this._entity}_override_mode`,
      option: 'Unlock'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    await this._hass.callService('select', 'select_option', {
      entity_id: `select.${this._entity}_override_type`,
      option: 'Until Resumed'
    });
  }

  async lockdownDoor() {
    await this._hass.callService('switch', 'turn_on', {
      entity_id: `switch.${this._entity}_override`
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    await this._hass.callService('select', 'select_option', {
      entity_id: `select.${this._entity}_override_mode`,
      option: 'Lockdown'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    await this._hass.callService('select', 'select_option', {
      entity_id: `select.${this._entity}_override_type`,
      option: 'Until Resumed'
    });
  }

  resumeDoor() {
    this._hass.callService('switch', 'turn_off', {
      entity_id: `switch.${this._entity}_override`
    });
  }

  pulseUnlock() {
    this._hass.callService('button', 'press', {
      entity_id: `button.${this._entity}_pulse_unlock`
    });
  }

  static getConfigElement() {
    return document.createElement("hartman-door-lock-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "",
      name: "",
      advanced: false,
      pulse_only: false,
      pulse_grid: false,
      columns: 4,
      name_text_case: "uppercase",
      text_case: "uppercase",
      color_theme: "purple",
      show_log: true,
      purple_outline: true,
      show_double_click_note: true,
      oo_style: false,
      transparent_bg: false,
      filled_buttons: false
    };
  }
}

// Config editor
class HartmanDoorLockCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    // Only render if we haven't initialized yet
    if (!this._initialized && this._hass) {
      this.render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (this._config && !this._initialized) {
      this.render();
    }
  }

  getDoorEntities() {
    if (!this._hass) return [];

    const entities = Object.keys(this._hass.states);
    const doorEntities = new Set();

    entities.forEach(entity => {
      if (entity.includes('_lock_state') && entity.startsWith('sensor.')) {
        const doorEntity = entity.replace('sensor.', '').replace('_lock_state', '');
        doorEntities.add(doorEntity);
      }
    });

    return Array.from(doorEntities).sort();
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    const doors = this.getDoorEntities();
    this._initialized = true;

    this.shadowRoot.innerHTML = `
      <style>
        .config-row {
          margin-bottom: 16px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 12px;
          color: var(--primary-text-color, #333);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        input[type="text"],
        input[type="number"],
        select {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 10px;
          box-sizing: border-box;
          font-size: 14px;
          font-family: inherit;
          background: white;
        }

        input[type="text"]:focus,
        input[type="number"]:focus,
        select:focus {
          outline: none;
          border-color: var(--primary-color, #3498db);
        }

        #entitySearch {
          border-width: 2px;
        }

        #entitySearch:focus {
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        #entitySearch::placeholder {
          color: #999;
          font-style: italic;
        }

        #entity {
          max-height: 240px;
          overflow-y: auto;
        }

        #entity option {
          padding: 8px;
          cursor: pointer;
        }

        #entity option:hover {
          background: rgba(52, 152, 219, 0.1);
        }

        input[type="checkbox"] {
          margin-right: 8px;
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 8px;
          border-radius: 10px;
          transition: background 0.2s;
          text-transform: none;
          letter-spacing: normal;
        }

        .checkbox-label:hover {
          background: var(--secondary-background-color, #f5f5f5);
        }

        .hint {
          font-size: 10px;
          color: var(--secondary-text-color, #999);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--secondary-text-color, #666);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
      </style>

      <div class="config-row">
        <label>Door Selection</label>
        <input
          type="text"
          id="entitySearch"
          placeholder="Search for a door..."
          value=""
        />
        <select id="entity" size="8" style="margin-top: 8px;">
          <option value="">Select a door...</option>
          ${doors.map(door => `
            <option value="${door}" ${this._config?.entity === door ? 'selected' : ''}>
              ${door.replace(/_/g, ' ').replace(/panel (\d+) door (\d+)/i, 'Panel $1 - Door $2')}
            </option>
          `).join('')}
        </select>
        <div class="hint">Search and choose which door this card controls</div>
      </div>

      <div class="config-row">
        <label>Card Name (Optional)</label>
        <input
          type="text"
          id="name"
          value="${this._config?.name || ''}"
          placeholder="e.g., Front Door, Main Entrance"
        />
      </div>

      <div class="config-row">
        <div class="field-row">
          <div>
            <label>Card Name Style</label>
            <select id="name_text_case">
              <option value="uppercase" ${this._config?.name_text_case === 'uppercase' || !this._config?.name_text_case ? 'selected' : ''}>UPPERCASE</option>
              <option value="capitalize" ${this._config?.name_text_case === 'capitalize' ? 'selected' : ''}>Capitalize First</option>
              <option value="none" ${this._config?.name_text_case === 'none' ? 'selected' : ''}>Normal</option>
            </select>
          </div>
          <div>
            <label>Other Text Style</label>
            <select id="text_case">
              <option value="uppercase" ${this._config?.text_case === 'uppercase' || !this._config?.text_case ? 'selected' : ''}>UPPERCASE</option>
              <option value="capitalize" ${this._config?.text_case === 'capitalize' ? 'selected' : ''}>Capitalize First</option>
              <option value="none" ${this._config?.text_case === 'none' ? 'selected' : ''}>Normal</option>
            </select>
          </div>
        </div>
      </div>

      <div class="config-row">
        <label>Color Theme</label>
        <select id="color_theme">
          <option value="purple" ${this._config?.color_theme === 'purple' || !this._config?.color_theme ? 'selected' : ''}>Purple (Default)</option>
          <option value="blue" ${this._config?.color_theme === 'blue' ? 'selected' : ''}>Blue</option>
          <option value="green" ${this._config?.color_theme === 'green' ? 'selected' : ''}>Green</option>
        </select>
        <div class="hint">Choose the primary color theme for buttons and accents</div>
      </div>

      <div class="config-row">
        <div class="section-title">Display Mode</div>
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="pulse_only"
            ${this._config?.pulse_only ? 'checked' : ''}
          />
          Pulse Only (Compact Row)
        </label>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="pulse_grid"
            ${this._config?.pulse_grid ? 'checked' : ''}
          />
          Pulse Grid (Square Tile)
        </label>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="advanced"
            ${this._config?.advanced ? 'checked' : ''}
          />
          Enable Advanced Options
        </label>
        <div class="hint" style="margin-left: 26px;">Override toggle, duration, mode & type controls</div>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="show_log"
            ${this._config?.show_log !== false ? 'checked' : ''}
          />
          Show Last Door Log
        </label>
        <div class="hint" style="margin-left: 26px;">Display the last door access log in advanced mode</div>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="purple_outline"
            ${this._config?.purple_outline !== false ? 'checked' : ''}
          />
          Purple Outline on Grid Cards
        </label>
        <div class="hint" style="margin-left: 26px;">Add a purple border around pulse grid cards</div>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="show_double_click_note"
            ${this._config?.show_double_click_note !== false ? 'checked' : ''}
          />
          Show Double-Click Note
        </label>
        <div class="hint" style="margin-left: 26px;">Display note about double-clicking override buttons</div>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="oo_style"
            ${this._config?.oo_style ? 'checked' : ''}
          />
          OO Style (Blue Outlines)
        </label>
        <div class="hint" style="margin-left: 26px;">All buttons have blue outline, icons/text keep original colors</div>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="transparent_bg"
            ${this._config?.transparent_bg ? 'checked' : ''}
          />
          Transparent Background
        </label>
        <div class="hint" style="margin-left: 26px;">Use transparent theme color background instead of solid card background</div>
      </div>

      <div class="config-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            id="filled_buttons"
            ${this._config?.filled_buttons ? 'checked' : ''}
          />
          Filled Buttons
        </label>
        <div class="hint" style="margin-left: 26px;">Fill button backgrounds with their respective colors</div>
      </div>

      <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--divider-color, #eee);">
        <div style="font-size: 10px; color: var(--secondary-text-color, #999); text-transform: uppercase; letter-spacing: 0.5px;">
          Hartman Door Lock Card v2.0.0
        </div>
      </div>
    `;

    const entitySelect = this.shadowRoot.getElementById('entity');
    const entitySearch = this.shadowRoot.getElementById('entitySearch');
    const nameInput = this.shadowRoot.getElementById('name');
    const advancedInput = this.shadowRoot.getElementById('advanced');
    const pulseOnlyInput = this.shadowRoot.getElementById('pulse_only');
    const pulseGridInput = this.shadowRoot.getElementById('pulse_grid');
    const nameTextCaseSelect = this.shadowRoot.getElementById('name_text_case');
    const textCaseSelect = this.shadowRoot.getElementById('text_case');
    const colorThemeSelect = this.shadowRoot.getElementById('color_theme');
    const showLogInput = this.shadowRoot.getElementById('show_log');
    const purpleOutlineInput = this.shadowRoot.getElementById('purple_outline');
    const showDoubleClickNoteInput = this.shadowRoot.getElementById('show_double_click_note');
    const ooStyleInput = this.shadowRoot.getElementById('oo_style');
    const transparentBgInput = this.shadowRoot.getElementById('transparent_bg');
    const filledButtonsInput = this.shadowRoot.getElementById('filled_buttons');

    // Search/filter functionality for door entities
    entitySearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const options = entitySelect.querySelectorAll('option');

      options.forEach((option, index) => {
        if (index === 0) return; // Skip the "Select a door..." option

        const text = option.textContent.toLowerCase();
        const value = option.value.toLowerCase();

        if (text.includes(searchTerm) || value.includes(searchTerm)) {
          option.style.display = '';
        } else {
          option.style.display = 'none';
        }
      });
    });

    entitySelect.addEventListener('change', (e) => {
      this._config = { ...this._config, entity: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    nameInput.addEventListener('input', (e) => {
      this._config = { ...this._config, name: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    advancedInput.addEventListener('change', (e) => {
      this._config = { ...this._config, advanced: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    pulseOnlyInput.addEventListener('change', (e) => {
      if (e.target.checked) {
        this._config = { ...this._config, pulse_only: true, pulse_grid: false };
        pulseGridInput.checked = false;
      } else {
        this._config = { ...this._config, pulse_only: false };
      }
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    pulseGridInput.addEventListener('change', (e) => {
      if (e.target.checked) {
        this._config = { ...this._config, pulse_grid: true, pulse_only: false };
        pulseOnlyInput.checked = false;
      } else {
        this._config = { ...this._config, pulse_grid: false };
      }
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    nameTextCaseSelect.addEventListener('change', (e) => {
      this._config = { ...this._config, name_text_case: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    textCaseSelect.addEventListener('change', (e) => {
      this._config = { ...this._config, text_case: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    colorThemeSelect.addEventListener('change', (e) => {
      this._config = { ...this._config, color_theme: e.target.value };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    showLogInput.addEventListener('change', (e) => {
      this._config = { ...this._config, show_log: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    purpleOutlineInput.addEventListener('change', (e) => {
      this._config = { ...this._config, purple_outline: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    showDoubleClickNoteInput.addEventListener('change', (e) => {
      this._config = { ...this._config, show_double_click_note: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    ooStyleInput.addEventListener('change', (e) => {
      this._config = { ...this._config, oo_style: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    transparentBgInput.addEventListener('change', (e) => {
      this._config = { ...this._config, transparent_bg: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });

    filledButtonsInput.addEventListener('change', (e) => {
      this._config = { ...this._config, filled_buttons: e.target.checked };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    });
  }
}

customElements.define('hartman-door-lock-card', HartmanDoorLockCard);
customElements.define('hartman-door-lock-card-editor', HartmanDoorLockCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "hartman-door-lock-card",
  name: "Hartman Door Lock Card",
  description: "Custom card for Hartman/Protector Net door locks"
});

console.info(
  '%c HARTMAN-DOOR-LOCK-CARD %c 2.0.0 ',
  'color: white; background: #2196F3; font-weight: 700;',
  'color: #2196F3; background: white; font-weight: 700;'
);
