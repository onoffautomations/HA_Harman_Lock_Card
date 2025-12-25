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

    // Pulse Grid mode (small clean button)
    if (this._pulseGrid) {
      this.shadowRoot.innerHTML = `
        <style>
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
            background: var(--ha-card-background, #fff);
            border-radius: 12px;
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
            ${this._purpleOutline ? 'border: 2px solid #9b59b6;' : ''}
          }

          .pulse-grid-card.advanced-mode {
            box-shadow: 0 2px 8px rgba(155, 89, 182, 0.25), 0 0 0 1px rgba(155, 89, 182, 0.1);
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
            width: 14px;
            height: 14px;
            background: linear-gradient(135deg, #9b59b6, #8e44ad);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            color: white;
            box-shadow: 0 1px 3px rgba(155, 89, 182, 0.4);
          }

          .pulse-grid-name {
            font-size: 11px;
            font-weight: 600;
            color: var(--primary-text-color, #333);
            text-align: center;
            line-height: 1.2;
            ${nameTextCaseStyle}
          }

          .pulse-grid-btn {
            background: #9b59b6;
            border: none;
            border-radius: 6px;
            padding: 6px 14px;
            color: white;
            font-size: 10px;
            font-weight: 600;
            ${textCaseStyle}
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .pulse-grid-btn:hover {
            background: #8e44ad;
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
            background: rgba(155, 89, 182, 0.2);
            overflow: hidden;
            border-radius: 0 0 16px 16px;
          }

          .dialog-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #9b59b6, #8e44ad);
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
            color: var(--primary-text-color, #333);
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
            color: var(--primary-text-color, #333);
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
            border: none;
            border-radius: 8px;
            padding: 14px 12px;
            font-size: 11px;
            font-weight: 600;
            ${textCaseStyle}
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
          }

          .dialog-action-btn:active:not(:disabled) {
            transform: scale(0.96);
          }

          .dialog-action-btn:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .dialog-action-btn.pulse { background: #9b59b6; color: white; }
          .dialog-action-btn.pulse:hover:not(:disabled) { background: #8e44ad; }
          .dialog-action-btn.lockdown { background: #e74c3c; color: white; }
          .dialog-action-btn.lockdown:hover:not(:disabled) { background: #c0392b; }
          .dialog-action-btn.unlock { background: #2ecc71; color: white; }
          .dialog-action-btn.unlock:hover:not(:disabled) { background: #27ae60; }
          .dialog-action-btn.resume { background: #3498db; color: white; }
          .dialog-action-btn.resume:hover:not(:disabled) { background: #2980b9; }

          .dialog-btn-icon {
            font-size: 18px;
          }
        </style>

        <div class="pulse-grid-card ${this._advanced ? 'advanced-mode' : ''}" id="cardClick">
          ${this._advanced ? '<div class="advanced-indicator">⚙</div>' : ''}
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
                    <span class="dialog-btn-icon">⏱</span>
                    ${this.formatText('Pulse')}
                  </button>
                  <button class="dialog-action-btn lockdown" id="dialogLockdownBtn">
                    <span class="dialog-btn-icon">🔒</span>
                    ${this.formatText('Lockdown')}
                  </button>
                  <button class="dialog-action-btn unlock" id="dialogUnlockBtn">
                    <span class="dialog-btn-icon">🔓</span>
                    ${this.formatText('Unlock')}
                  </button>
                  <button class="dialog-action-btn resume" id="dialogResumeBtn" ${!isOverrideOn ? 'disabled' : ''}>
                    <span class="dialog-btn-icon">↩️</span>
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
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :host {
            display: block;
            position: relative;
            z-index: 1;
          }
          
          .pulse-card {
            background: var(--ha-card-background, #fff);
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
            color: var(--primary-text-color, #333);
            ${nameTextCaseStyle}
          }
          
          .pulse-status {
            font-size: 10px;
            color: var(--secondary-text-color, #666);
            text-transform: capitalize;
          }
          
          .pulse-btn {
            background: #9b59b6;
            border: none;
            border-radius: 6px;
            padding: 8px 14px;
            color: white;
            font-size: 11px;
            font-weight: 600;
            ${textCaseStyle}
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
            flex-shrink: 0;
          }
          
          .pulse-btn:hover {
            background: #8e44ad;
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :host {
          display: block;
          position: relative;
          z-index: 1;
        }

        .card {
          background: var(--ha-card-background, #fff);
          border-radius: 12px;
          overflow: visible;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          position: relative;
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
          color: var(--primary-text-color, #333);
          ${nameTextCaseStyle}
        }

        .door-status {
          font-size: 11px;
          color: var(--secondary-text-color, #666);
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
          border: none;
          border-radius: 8px;
          padding: 12px 8px;
          font-size: 10px;
          font-weight: 600;
          ${textCaseStyle}
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .action-btn:active:not(:disabled) {
          transform: scale(0.96);
        }

        .action-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .action-btn.pulse {
          background: #9b59b6;
          color: white;
        }
        .action-btn.pulse:hover:not(:disabled) { background: #8e44ad; }

        .action-btn.lockdown {
          background: #e74c3c;
          color: white;
        }
        .action-btn.lockdown:hover:not(:disabled) { background: #c0392b; }

        .action-btn.unlock {
          background: #2ecc71;
          color: white;
        }
        .action-btn.unlock:hover:not(:disabled) { background: #27ae60; }

        .action-btn.resume {
          background: #3498db;
          color: white;
        }
        .action-btn.resume:hover:not(:disabled) { background: #2980b9; }

        .btn-icon {
          font-size: 16px;
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
        }

        .override-section {
          background: ${isOverrideOn ? 'rgba(230, 126, 34, 0.08)' : 'rgba(0,0,0,0.02)'};
          border-radius: 8px;
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
          border-radius: 6px;
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
          border-radius: 6px;
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
          background: #d35400;
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
          border-radius: 6px;
          text-align: center;
        }

        .info-box.log {
          background: rgba(155, 89, 182, 0.08);
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
            <span class="btn-icon">⏱</span>
            ${this.formatText('Pulse')}
          </button>
          <button class="action-btn lockdown" id="lockdownBtn">
            <span class="btn-icon">🔒</span>
            ${this.formatText('Lockdown')}
          </button>
          <button class="action-btn unlock" id="unlockBtn">
            <span class="btn-icon">🔓</span>
            ${this.formatText('Unlock')}
          </button>
          <button class="action-btn resume" id="resumeBtn" ${!isOverrideOn ? 'disabled' : ''}>
            <span class="btn-icon">↩️</span>
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
      show_log: true,
      purple_outline: true,
      show_double_click_note: true
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
          border-radius: 6px;
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
          border-color: #9b59b6;
          border-width: 2px;
        }

        #entitySearch:focus {
          border-color: #8e44ad;
          box-shadow: 0 0 0 3px rgba(155, 89, 182, 0.1);
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
          background: rgba(155, 89, 182, 0.1);
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
          border-radius: 6px;
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

      <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--divider-color, #eee);">
        <div style="font-size: 10px; color: var(--secondary-text-color, #999); text-transform: uppercase; letter-spacing: 0.5px;">
          Hartman Door Lock Card v1.3.0
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
    const showLogInput = this.shadowRoot.getElementById('show_log');
    const purpleOutlineInput = this.shadowRoot.getElementById('purple_outline');
    const showDoubleClickNoteInput = this.shadowRoot.getElementById('show_double_click_note');

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
  '%c HARTMAN-DOOR-LOCK-CARD %c 1.3.0 ',
  'color: white; background: #4caf50; font-weight: 700;',
  'color: #4caf50; background: white; font-weight: 700;'
);
