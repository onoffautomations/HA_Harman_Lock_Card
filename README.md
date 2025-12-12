# Hartman Door Lock Card

A custom Lovelace card for Home Assistant to control Hartman/Protector Net door locks with an intuitive and feature-rich interface.

![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2023.1+-green.svg)

## Requirements

This card requires the [Protector Net Integration](https://github.com/hitchin999/protector_net) to be installed and configured in Home Assistant.

## Features

- 🎨 **Three Display Modes**: Full card, compact row (pulse only), or grid tile
- 🔒 **Quick Actions**: Pulse unlock, lockdown, unlock, and resume control
- 🎯 **Advanced Controls**: Override settings with duration, mode, and type options
- 📊 **Real-time Status**: Visual status indicator with color-coded states
- 📝 **Activity Log**: Optional last door access log with formatted timestamps
- 🎨 **Customizable**: Text case options (uppercase, capitalize, normal)
- 📱 **Responsive**: Clean design that works on all screen sizes

## Screenshots

### Full Card Mode
Shows complete control with status, quick actions, and optional advanced settings.

### Pulse Only Mode
Compact single-row display perfect for dashboards with limited space.

### Pulse Grid Mode
Small square tiles ideal for grid layouts with multiple doors.

## Installation

### HACS Installation (Recommended)

1. **Add Custom Repository**:
   - Open HACS in your Home Assistant
   - Click on "Frontend"
   - Click the three dots menu (top right)
   - Select "Custom repositories"
   - Add this repository URL: `https://github.com/onoffautomations/HA_Harman_Lock_Card`
   - Select category: "Lovelace"
   - Click "Add"

2. **Install the Card**:
   - Find "Hartman Door Lock Card" in HACS
   - Click "Download"
   - Restart Home Assistant
   - 
### Manual Installation

1. **Download the File**:
   - Download `hartman-door-lock-card.js` from this repository

2. **Copy to Home Assistant**:
   ```bash
   # Create directory if it doesn't exist
   mkdir -p config/www/hartman-door-lock-card/

   # Copy the file
   cp hartman-door-lock-card.js config/www/hartman-door-lock-card/
   ```

3. **Add Resource**:
   - Go to Settings → Dashboards → Resources
   - Click "Add Resource"
   - URL: `/local/hartman-door-lock-card/hartman-door-lock-card.js`
   - Resource type: `JavaScript Module`
   - Click "Create"

4. **Restart Home Assistant**

## Configuration

### Using the Visual Editor

1. Add a new card to your dashboard
2. Search for "Hartman Door Lock Card"
3. Select your door entity
4. Configure options using the visual editor

### YAML Configuration

#### Basic Configuration

```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
```

#### Full Configuration

```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
name: Front Door
advanced: true
text_case: uppercase
show_log: true
```

#### Pulse Only Mode

```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
name: Back Door
pulse_only: true
```

#### Pulse Grid Mode

```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
name: Garage Door
pulse_grid: true
columns: 4
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **Required** | Door entity identifier (e.g., `panel_2_door_5`) |
| `name` | string | Auto-generated | Custom name for the door |
| `advanced` | boolean | `false` | Enable advanced override controls |
| `pulse_only` | boolean | `false` | Show compact single-row display |
| `pulse_grid` | boolean | `false` | Show small grid tile display |
| `columns` | number | `4` | Number of columns for grid layout |
| `text_case` | string | `uppercase` | Text style: `uppercase`, `capitalize`, or `none` |
| `show_log` | boolean | `true` | Display last door access log |

## Entity Requirements

This card requires the following Home Assistant entities for your door:

### Required Entities
- `sensor.{entity}_lock_state` - Lock state (locked/unlocked)
- `button.{entity}_pulse_unlock` - Pulse unlock button

### Optional Entities (for full functionality)
- `switch.{entity}_override` - Override control switch
- `sensor.{entity}_overridden` - Override status sensor
- `select.{entity}_override_mode` - Override mode selector
- `select.{entity}_override_type` - Override type selector
- `number.{entity}_override_minutes` - Override duration
- `sensor.{entity}_reader_mode` - Reader mode status
- `sensor.{entity}_last_door_log_by` - Last access log

**Example**: If your entity is `panel_2_door_5`, the card expects:
- `sensor.panel_2_door_5_lock_state`
- `button.panel_2_door_5_pulse_unlock`
- etc.

## Usage Examples

### Dashboard with Multiple Doors (Grid Layout)

```yaml
type: grid
columns: 4
cards:
  - type: custom:hartman-door-lock-card
    entity: panel_2_door_1
    pulse_grid: true
  - type: custom:hartman-door-lock-card
    entity: panel_2_door_2
    pulse_grid: true
  - type: custom:hartman-door-lock-card
    entity: panel_2_door_3
    pulse_grid: true
  - type: custom:hartman-door-lock-card
    entity: panel_2_door_4
    pulse_grid: true
```

### Vertical Stack with Compact Doors

```yaml
type: vertical-stack
cards:
  - type: custom:hartman-door-lock-card
    entity: panel_2_door_1
    name: Front Entrance
    pulse_only: true
  - type: custom:hartman-door-lock-card
    entity: panel_2_door_2
    name: Back Door
    pulse_only: true
  - type: custom:hartman-door-lock-card
    entity: panel_2_door_3
    name: Garage Access
    pulse_only: true
```

### Full Control Card

```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
name: Main Entrance
advanced: true
text_case: capitalize
show_log: true
```

## Features Explained

### Status Colors

- 🔴 **Red**: Locked or Lockdown mode
- 🟢 **Green**: Unlocked
- 🟠 **Orange**: Override active
- 🔵 **Blue**: Other override modes

### Quick Actions

- **Pulse**: Temporarily unlock the door (quick unlock)
- **Lockdown**: Lock the door and prevent access
- **Unlock**: Unlock the door
- **Resume**: Return control to Hartman system

### Advanced Controls

When enabled, provides:
- **Duration**: Set override time in minutes
- **Override Mode**: Lockdown, Unlock, etc.
- **Override Type**: Until Resumed, Timed, etc.
- **Apply Override**: Apply custom override settings

**Note**: Override buttons require double-click to activate for safety.

### Last Door Log

Displays the most recent door access with:
- Who accessed the door
- Formatted date and time (e.g., "Dec 12, 2025 at 12:43:40 AM")
- Can be hidden using `show_log: false`

## Troubleshooting

### Card doesn't appear

- Clear browser cache
- Restart Home Assistant
- Check browser console for errors
- Verify the resource is added correctly

### Entities not found

- Check entity naming matches your Hartman integration
- Verify entities exist in Developer Tools → States
- Ensure the base entity name is correct

### Buttons not working

- Check Home Assistant logs for errors
- Verify entity permissions
- For override buttons, remember to double-click

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Changelog

### Version 2.3.0
- Initial public release
- Full card mode with all controls
- Pulse only compact mode
- Pulse grid tile mode
- Advanced override controls
- Activity logging with formatted timestamps
- Customizable text cases
- Optional log display
- Double-click safety for override buttons

## Credits

Created for use with Hartman/Protector Net access control systems integrated with Home Assistant.
