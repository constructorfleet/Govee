# Govee Protocol Atlas site

Static search/filter UI for the protocol collection in `../protocol/`.

## Local dev

```bash
cd site
npm install
npm run dev
```

`npm run prepare-data` reads `../protocol/data/ALL.json` and every
`../protocol/**/*.md`, then writes `public/data/site.json`. Vite serves the app.

## Build

```bash
npm run build
```

Outputs `dist/` (relative asset paths, so it works under a GitHub Pages project
subpath). The GitHub Actions workflow deploys `dist/` on every push to `main`.

## Features

- Global command palette (`⌘K` / `Ctrl+K` / `/`)
- Devices, commands, effects, readings, status and docs tabs
- Filters by transport, split module, sub-mode and free text
- Detail drawer with payload, layout, response, source path and copy buttons
- **Try it out** builder: BLE frame + BCC, base64 and MQTT/`ptReal` JSON for BLE commands;
  editable MQTT JSON for IoT commands
- Transport formats (`ptReal`, `ptIot`, `pt`, `multiSync`, `ptUrl`, read envelopes) are
  separated from actual commands
- Docs tab renders the per-split deep dives from Markdown
