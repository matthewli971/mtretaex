# mtretaex
MTR Trains ETA Web-app

## Changelog

### v0.02
- **Home station**: Added `HOME_STATION` variable in `data.js` (default: `ADM`). The app automatically loads ETA for the home station on startup, unless a `?station=` URL parameter is provided.
- **Station font colours**: Added `station_font_colour` field to every station in `data.js` for correct text contrast on coloured backgrounds.
- **Removed `LINES_COLOURS_DATA`**: Duplicate colour data array removed from `data.js`. Line colours are now read directly from `linesData[].colour_code`.
- **Station search — select-all on click**: Clicking the search bar now selects all existing text and shows the full unfiltered station list immediately.
- **Search clear button (×)**: A clear button appears inside the search box. Clicking it clears the input and reopens the full list.
- **Station colour dot in dropdown**: Each station in the dropdown now shows a coloured badge (station background + font colour from `data.js`) with the station code, replacing the plain text code.
- **Platform badge — dynamic colour**: The circular platform number badge now uses the line's colour instead of a fixed red.
- **Platform separator**: A dark grey horizontal rule is inserted between groups of trains on different platforms within the same line.
- **Train code (TD) — 7-segment display**: The `td` field from the API is rendered as a 3-digit 7-segment SVG display (amber `#f7cc3e` on dark background), shown to the left of the platform badge.
- **Non-passenger trains**: Destinations starting with `NO_` are displayed as "不 載 客 列 車" in muted italic style.

### v0.01
- Initial release: station search, ETA fetch via MTR API, line colour bars, platform badge, clock, last-update timestamp, refresh button.
- CORS fix: all JSON data embedded as JS variables in `data.js` to support `file://` protocol.

## Data preparation
- Station and line data sourced from files in `/lib/` (`mtr_stations.json`, `mtr_lines.json`, `mtr_lines_colours.json`, `mtr_lines_and_stations.csv`).
- Data is embedded directly into `data.js` as JavaScript variables (`stationsData`, `linesData`, `HOME_STATION`) — no runtime fetch required.
- To add or modify stations/lines, edit `data.js` directly.

## Usage
Open `mtreta.html` directly in a browser (no server required). The app works over `file://` protocol.
