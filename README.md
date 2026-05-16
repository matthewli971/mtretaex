# mtretaex
MTR Trains ETA Web-app

## Changelog

### v0.04
- **Filter -1 min trains**: Trains with `ttnt < 0` are now excluded from the display.
- **Terminus station handling**: Added `TERMINUS_PLATFORMS` variable in `data.js`. When the API destination equals the current station on a terminus platform, the train is shown as "不 載 客 列 車".
- **Remember last station**: The user's last selected station is persisted in `localStorage`. On next visit, the app loads the previously used station instead of the default.
- **Removed station-info-code**: The station code label was removed from the station info bar row1 for cleaner layout.
- **"顯示全部" button width**: The button now has a `min-width: 25%` to align with line filter badges (consistent width when 4 lines shown).
- **Line-coloured even rows**: Even ETA rows use an 80% lightened version of the line colour instead of a fixed colour, giving each line section its own tint.
- **Dark mode**: Added a full dark mode theme with CSS custom property overrides. Dark mode is the default. A toggle switch (🌙/☀️) in the header allows the user to switch between dark and light mode. Preference is saved in `localStorage`.
- **Favicon**: Added an inline SVG favicon for the web page tab.
- **1-min countdown timer**: When `ttnt = 1`, instead of showing "1 min", a countdown timer is displayed calculating `[lastUpdateTime + 60s - now]`. When countdown reaches 0, it shows "進站中".
- **Display order by platform**: Lines are now sorted by their smallest platform number at the current station (e.g., TWL > ISL > SIL > EAL at ADM) instead of alphabetically.

### v0.03
- **Station info bar — station colours**: The station info bar background and text now use the station's own `station_colour` and `station_font_colour` for visual identity.
- **Line filter badges**: Line badges moved to a dedicated second row in the station info bar. Each badge spans equally to fill the full row width. Clicking a badge filters the ETA display to only show that line.
- **"顯示全部" button**: Appears on the station name row (right-aligned) after a line filter is active. Clicking it restores all lines.
- **Station name font size**: Station name in the info bar now matches the line badge font size (`--font-size-line-bar`).
- **Train code black background**: The 7-segment train code display has a `#111111` background with rounded corners for visibility.
- **Train code — italic tilt**: 7-segment digit SVGs are tilted with `skewX(-8deg)` to mimic real electronic displays.
- **Train code — centre segment fix**: The middle horizontal segment (G) now has the same height/thickness as the vertical segments for clearer readability.
- **Row colour alternation fix**: Replaced CSS `nth-child` selectors with explicit `.eta-row-even` / `.eta-row-odd` classes so line bars and platform separators no longer skew the alternation.
- **Line sections**: Each line's ETA group is wrapped in a `.line-section[data-line]` div to support filtering and proper structure.
- **Web page name change**: Change web app to index.html for easier access.

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
- Data is embedded directly into `data.js` as JavaScript variables (`stationsData`, `linesData`, `HOME_STATION`, `TERMINUS_PLATFORMS`) — no runtime fetch required.
- To add or modify stations/lines, edit `data.js` directly.

## Usage
Open `index.html` directly in a browser (no server required). The app works over `file://` protocol.
