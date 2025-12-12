# Hartman Door Lock Card

A beautiful and feature-rich Lovelace card for controlling Hartman/Protector Net door locks in Home Assistant.

## Requirements

This card requires the [Protector Net Integration](https://github.com/hitchin999/protector_net) to be installed and configured in Home Assistant.

## Features

**Multiple Display Modes:**
- Full card with complete controls
- Compact row (pulse only) for space-saving
- Grid tiles for multi-door layouts

**Quick Actions:**
- Pulse unlock for temporary access
- Lockdown to secure the door
- Unlock and Resume controls
- Double-click safety for override buttons

**Advanced Features:**
- Real-time status with color-coded indicators
- Override controls (duration, mode, type)
- Activity logging with formatted timestamps
- Reader mode display
- Customizable text formatting

**Visual Design:**
- Clean, modern interface
- Color-coded status bullets (red=locked, green=unlocked, orange=override)
- Responsive layout for all screen sizes
- Smooth animations and transitions

## Perfect For

- Access control systems
- Multi-door installations
- Office buildings
- Residential complexes
- Any Hartman/Protector Net setup

## Quick Configuration

### Full Card
```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
name: Front Door
advanced: true
```

### Compact Mode
```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
pulse_only: true
```

### Grid Layout
```yaml
type: custom:hartman-door-lock-card
entity: panel_2_door_5
pulse_grid: true
```

## Support

For detailed documentation, configuration options, and troubleshooting, see the [full README](https://github.com/onoffautomations/HA_Harman_Lock_Card).

If you find this card helpful, please ⭐ star the repository!
