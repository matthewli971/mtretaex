/* ============================================
   MTR ETA Web App - script.js
   地下鐵到站時間關注組
   ============================================ */

const APP_VERSION = "v0.15.1";
const API_URL = "https://408tq84duh.execute-api.ap-east-1.amazonaws.com/api/service/GetNextTrainData";
const MAX_TRAINS_PER_GROUP = 8;
const STORAGE_KEY_STATION = "mtreta_last_station";
const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds
const LINE_API_REFRESH_INTERVAL = 20000; // 20 seconds
const TRAIN_LOAD_TIME_FILTER_MS = 10 * 60 * 1000; // 10 minutes // Trainload TTL filter: discard records older than this (milliseconds)
const DEFAULT_SPECIAL_TRAIN_SHOW_BEFORE_MINS = 20; // Default "show before" time for special trains without explicit show_before_mins (in minutes)
const DEFAULT_SPECIAL_TRAIN_SHOW_AFTER_MINS = 30; // Default "show after" time for special trains without explicit show_after_mins (in minutes)

// ============================================
// Data stores — defined in data.js
// ============================================
// stationsData, linesData, HOME_STATION, platformGroup are declared in data.js

// Lookup maps built after loading
let stationByCode = {};   // station_code -> station object
let lineByCode = {};      // line_code -> line object
let altCodeMap = {};      // alternative code -> canonical station_code

// Train info cache from line-specific APIs
// Key: line_code, Value: { data: [...trains], timestamp: Date }
let trainInfoCache = {};
let lineApiTimers = {};   // line_code -> intervalId

// State
let currentStationCode = null;
let autoRefreshTimer = null;
let clockTimer = null;
let activeLineFilter = null; // null = show all
let lastUpdateTime = null;   // Date object of last API gen_time
let countdownTimer = null;

// Global mode: "I" = Internal API, "D" = OpenData
let masterMode = 'I';

let railwayPlasticMode = false;
let nextStationVizMode = true;

// ============================================
// Initialisation
// ============================================
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("app-version").textContent = APP_VERSION;
    startClock();
    setupEventListeners();
    loadStaticData();
    buildStationList();
    loadLineModeState();

    // Check URL params for pre-selected station
    const params = new URLSearchParams(window.location.search);
    const preStation = params.get("station");
    if (preStation && stationByCode[preStation.toUpperCase()]) {
        selectStation(preStation.toUpperCase());
    } else {
        // Try localStorage for last used station
        var savedStation = null;
        try { savedStation = localStorage.getItem(STORAGE_KEY_STATION); } catch(e) {}
        if (savedStation && stationByCode[savedStation]) {
            selectStation(savedStation);
        } else if (typeof HOME_STATION !== "undefined" && stationByCode[HOME_STATION]) {
            selectStation(HOME_STATION);
        }
    }

    // Theme: apply saved preference (default: dark), then mark as loaded
    var savedTheme = null;
    try { savedTheme = localStorage.getItem("mtreta_theme"); } catch(e) {}
    if (savedTheme === "light") {
        document.body.classList.remove("dark-mode");
    } else {
        document.body.classList.add("dark-mode");
    }
    // Signal that theme has been resolved — CSS active states now apply
    document.body.classList.add("theme-loaded");

    // Load next station visualization preference
    try {
        nextStationVizMode = localStorage.getItem("mtreta_nextstationviz") === "true";
    } catch(e) {}

    // Initialize settings panel
    initSettingsPanel();

    // Resize handler for responsive layout changes
    window.addEventListener('resize', function () {
        applySuperWideLayout();
        autoExpandRow2ForWideScreen();
    });

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js').catch(function (err) {
            console.warn('Service worker registration failed:', err);
        });
    }
});

// ============================================
// PWA Install Prompt
// ============================================
var _pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _pwaInstallPrompt = e;
    var btn = document.getElementById('btn-pwa-install');
    if (btn) btn.classList.remove('hidden');
});

window.addEventListener('appinstalled', function () {
    _pwaInstallPrompt = null;
    var btn = document.getElementById('btn-pwa-install');
    if (btn) btn.classList.add('hidden');
});

function pwaInstallClick() {
    if (!_pwaInstallPrompt) return;
    _pwaInstallPrompt.prompt();
    _pwaInstallPrompt.userChoice.then(function () {
        _pwaInstallPrompt = null;
        var btn = document.getElementById('btn-pwa-install');
        if (btn) btn.classList.add('hidden');
    });
}

// ============================================
// Clock
// ============================================
function startClock() {
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
}

// ============================================
// Theme Toggle
// ============================================
function toggleTheme() {
    var isDark = document.body.classList.toggle('dark-mode');
    try { localStorage.setItem('mtreta_theme', isDark ? 'dark' : 'light'); } catch(e) {}
    if (currentStationCode) { fetchETASilent(currentStationCode); }
}

function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    document.getElementById("clock").innerHTML =
        hh + ": " + mm + '<span class="clock-sec">: ' + ss + "</span>";
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    document.getElementById("btn-refresh").addEventListener("click", function () {
        if (currentStationCode) {
            fetchETASilent(currentStationCode);
        }
    });

    var pwaBtn = document.getElementById('btn-pwa-install');
    if (pwaBtn) pwaBtn.addEventListener('click', pwaInstallClick);

    // Enter key on search: if exactly one result is visible, select it
    document.getElementById("station-search").addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        var visibleItems = Array.prototype.slice.call(
            document.querySelectorAll(".station-item")
        ).filter(function (el) { return el.style.display !== "none"; });
        if (visibleItems.length === 1) {
            var code = visibleItems[0].getAttribute("data-code");
            if (code) selectStation(code);
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", function (e) {
        const selector = document.getElementById("station-selector");
        if (!selector.contains(e.target)) {
            closeStationList();
        }
    });
}

// ============================================
// Load Static Data (from embedded data)
// ============================================
function loadStaticData() {
    // Build lookup maps from embedded data
    stationsData.forEach(function (s) {
        stationByCode[s.station_code] = s;
    });
    linesData.forEach(function (l) {
        lineByCode[l.line_code] = l;
    });
    // Build alternative-code map from alternativeNames array in data.js
    if (typeof alternativeNames !== "undefined") {
        alternativeNames.forEach(function (entry) {
            Object.keys(entry).forEach(function (altCode) {
                altCodeMap[altCode] = entry[altCode];
            });
        });
    }
}

// Build line colour dot HTML for a station's lines, sorted by line_id
function buildLineDotsHtml(station) {
    if (!station || !station.lines) return '';
    var sorted = station.lines.slice().sort(function (a, b) {
        var la = lineByCode[a], lb = lineByCode[b];
        return (la ? la.line_id : 999) - (lb ? lb.line_id : 999);
    });
    var html = '';
    sorted.forEach(function (lc) {
        html += '<span class="station-line-dot" style="background-color:' + getLineColour(lc) + '"></span>';
    });
    return html;
}

// ============================================
// Station List / Search
// ============================================
function buildStationList() {
    const listEl = document.getElementById("station-list");
    let html = "";

    // Order by line_id, then by station order in each line
    var sortedLines = linesData.slice().sort(function (a, b) {
        return a.line_id - b.line_id;
    });

    var addedStations = {}; // track which stations already added

    sortedLines.forEach(function (line) {
        // Line header (unselectable)
        html += '<div class="station-list-header" style="border-left: 15px solid ' + line.colour_code + ';">';
        html += '<span class="station-list-header-chi">' + line.name_chi + '</span>';
        html += '<span class="station-list-header-eng">' + line.name_eng + '</span>';
        html += '</div>';

        // Stations in line order
        line.stations.forEach(function (stationCode) {

            var s = stationByCode[stationCode];
            if (!s) return;

            // Build line colour circles ordered by line_id
            var lineCircles = buildLineDotsHtml(s);

            var stationItemClass = 'station-item' + (addedStations[stationCode] ? ' station-item-duplicated' : '');

            html +=
                '<div class="' + stationItemClass + '" data-code="' + s.station_code + '" onclick="selectStation(\'' + s.station_code + '\')">' +
                '<span class="station-colour-dot" style="background-color:' + s.station_colour + ';color:' + (s.station_font_colour || '#fff') + '">' + s.station_code + '</span>' + ' ' +
                '<span class="station-item-chi">' + s.name_chi + '</span>' +
                '<span class="station-item-eng">' + s.name_eng + '</span>' +
                '<span class="station-line-dots">' + lineCircles + '</span>' +
                '</div>';
            
            addedStations[stationCode] = true;
        });
    });

    listEl.innerHTML = html;
}

function toggleStationList() {
    var dropdown = document.getElementById("station-dropdown");
    if (dropdown.classList.contains("hidden")) {
        openStationList();
    } else {
        closeStationList();
    }
}

function openStationList() {
    var input = document.getElementById("station-search");
    // Hide the visual display and show the real input for typing
    document.getElementById("station-display").classList.add("hidden");
    document.getElementById("search-line-dots").innerHTML = '';
    input.value = '';
    input.classList.remove('search-has-station');
    input.focus();
    document.getElementById("station-dropdown").classList.remove("hidden");
    // Show all items and headers unfiltered when opening
    var items = document.querySelectorAll(".station-item");
    items.forEach(function (el) { el.style.display = ""; });
    var headers = document.querySelectorAll(".station-list-header");
    headers.forEach(function (el) { el.style.display = ""; });
}

function closeStationList() {
    document.getElementById("station-dropdown").classList.add("hidden");
    // Re-show the visual badge if a station is selected
    if (currentStationCode) {
        document.getElementById("station-display").classList.remove("hidden");
        // Restore line dots
        var station = stationByCode[currentStationCode];
        if (station) {
            document.getElementById("search-line-dots").innerHTML = buildLineDotsHtml(station);
        }
    }
}

function filterStationList() {
    var input = document.getElementById("station-search");
    const keyword = input.value.trim().toLowerCase();
    // Ensure dropdown is open when typing, overlay hidden, text visible
    document.getElementById("station-display").classList.add("hidden");
    input.classList.remove('search-has-station');
    document.getElementById("station-dropdown").classList.remove("hidden");

    // Hide line dots while typing/filtering
    document.getElementById("search-line-dots").innerHTML = '';

    const headers = document.querySelectorAll(".station-list-header");
    const items = document.querySelectorAll(".station-item");
    const duplicates = document.querySelectorAll(".station-item-duplicated");

    if (!keyword) {
        // Show everything when no keyword
        items.forEach(function (el) { el.style.display = ""; });
        headers.forEach(function (el) { el.style.display = ""; });
        duplicates.forEach(function (el) { el.style.display = ""; });
    } else {
        // Hide all headers when filtering
        headers.forEach(function (el) { el.style.display = "none"; });
        items.forEach(function (el) {
            const code = el.getAttribute("data-code").toLowerCase();
            const text = el.textContent.toLowerCase();
            if (code.indexOf(keyword) !== -1 || text.indexOf(keyword) !== -1) {
                el.style.display = "";
            } else {
                el.style.display = "none";
            }
        });
        duplicates.forEach(function (el) { el.style.display = "none"; });
    }
}

function selectStation(code) {
    currentStationCode = code;
    try { localStorage.setItem(STORAGE_KEY_STATION, code); } catch(e) {}
    const station = stationByCode[code];
    if (station) {
        // Keep input value for fallback/screenreader
        document.getElementById("station-search").value =
            code + " - " + station.name_chi + " " + station.name_eng;

        // Populate the visual badge display
        var badgeEl = document.getElementById("station-display-badge");
        var nameEl = document.getElementById("station-display-name");
        if (badgeEl) {
            badgeEl.className = 'station-colour-dot';
            badgeEl.textContent = code;
            badgeEl.style.backgroundColor = station.station_colour || '#666';
            badgeEl.style.color = station.station_font_colour || '#fff';
        }
        if (nameEl) {
            nameEl.textContent = station.name_chi + " " + station.name_eng;
        }
        document.getElementById("station-display").classList.remove("hidden");
        document.getElementById("station-search").classList.add("search-has-station");

        // Show line circles in search bar, ordered by line_id
        document.getElementById("search-line-dots").innerHTML = buildLineDotsHtml(station);
    }
    closeStationList();
    showStationInfoBar(code);
    updateMasterSwitch();
    fetchETA(code);
    startAutoRefresh();
    startLineApiFetch(code);
    showAllLines();
}

// ============================================
// Auto-Refresh (AJAX, no loader)
// ============================================
function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshTimer = setInterval(function () {
        if (currentStationCode) {
            fetchETASilent(currentStationCode);
        }
    }, AUTO_REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
}

// ============================================
// Station Info Bar
// ============================================
function showStationInfoBar(code) {
    const station = stationByCode[code];
    if (!station) return;

    const bar = document.getElementById("station-info-bar");
    bar.classList.remove("hidden");
    bar.style.backgroundColor = station.station_colour || '';
    bar.style.color = station.station_font_colour || '';

    document.getElementById("station-info-name").textContent =
        station.name_chi + " " + station.name_eng;

    // Station call button
    var callBtn = document.getElementById("station-call-btn");
    if (callBtn) {
        if (station.hotline) {
            var telNum = station.hotline.replace(/\s/g, '');
            callBtn.href = 'tel:' + telNum;
            callBtn.title = station.hotline;
            callBtn.classList.remove('hidden');
        } else {
            callBtn.classList.add('hidden');
        }
    }

    // Line filter badges (second row) - ordered by line_id
    activeLineFilter = null;
    let badgesHtml = "";
    var sortedLines = station.lines.slice().sort(function (a, b) {
        var lineA = lineByCode[a];
        var lineB = lineByCode[b];
        var idA = lineA ? lineA.line_id : 999;
        var idB = lineB ? lineB.line_id : 999;
        return idA - idB;
    });
    sortedLines.forEach(function (lineCode) {
        const colour = getLineColour(lineCode);
        const line = lineByCode[lineCode];
        const label = line ? line.name_chi : lineCode;
        badgesHtml += '<span class="line-badge-filter" style="background-color:' + colour + '" onclick="filterByLine(\'' + lineCode + '\')">' + label + '</span>';
    });
    document.getElementById("station-info-filter").innerHTML = badgesHtml;
}

function filterByLine(lineCode) {
    activeLineFilter = lineCode;
    //document.getElementById("btn-show-all").classList.remove("hidden");
    // Hide/show line sections in eta-container
    var container = document.getElementById('eta-container');
    container.setAttribute('data-filtered', 'true');
    var sections = container.querySelectorAll('.line-section');
    sections.forEach(function (sec) {
        if (sec.getAttribute('data-line') === lineCode) {
            sec.style.display = '';
        } else {
            sec.style.display = 'none';
        }
    });
    applySuperWideLayout();
}

function showAllLines() {
    activeLineFilter = null;
    //document.getElementById("btn-show-all").classList.add("hidden");
    var container = document.getElementById('eta-container');
    container.removeAttribute('data-filtered');
    var sections = container.querySelectorAll('.line-section');
    sections.forEach(function (sec) {
        sec.style.display = '';
    });
    applySuperWideLayout();
}

// ============================================
// Fetch ETA from API
// ============================================

function fetchETA(stationCode) {
    fetchETAInternal(stationCode, true);
}

function fetchETASilent(stationCode) {
    fetchETAInternal(stationCode, false);
}

function fetchETAInternal(stationCode, withLoader) {
    if (withLoader) showLoader();
    // If master mode is D, skip the internal API and use OpenData only
    if (masterMode === 'D') {
        fetchOpenDataETA(stationCode, function (odData, sysTime) {
            if (withLoader) hideLoader();
            var data = { line: {} };
            if (sysTime) data.sys_time = sysTime;
            mergeOpenDataIntoETA(data, odData);
            processETAData(data);
        });
        return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (withLoader) hideLoader();
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    // Check staleness: if gen_time is >15s old, supplement with OpenData
                    var genTime = data.gen_time || data.sys_time;
                    var staleMs = genTime ? (Date.now() - new Date(genTime).getTime()) : 0;
                    var openDataLinesToMerge = getOpenDataLinesForStation(stationCode);
                    var needsOdFetch = (staleMs > 15000) || (openDataLinesToMerge.length > 0);
                    if (needsOdFetch) {
                        fetchOpenDataForHybrid(stationCode, function (odData, odSysTime) {
                            // For openDataLines: replace I-mode ETA with OpenData, keeping td from I-mode
                            if (openDataLinesToMerge.length > 0) {
                                mergeOpenDataLinesETA(data, odData, openDataLinesToMerge);
                            }
                            if (staleMs > 15000) {
                                supplementInternalWithOpenData(data, odData);
                                if (odSysTime) data._odSysTime = odSysTime;
                            }
                            processETAData(data);
                        });
                    } else {
                        processETAData(data);
                    }
                } catch (e) {
                    console.error("Failed to parse ETA response:", e);
                    document.getElementById("last-update-time").textContent = "-- : -- : --";
                    if (withLoader) {
                        document.getElementById("eta-container").innerHTML =
                            '<div style="padding:20px;color:#fff;text-align:center;">無法解析數據</div>';
                    }
                }
            } else {
                console.error("API error:", xhr.status);
                document.getElementById("last-update-time").textContent = "-- : -- : --";
                if (withLoader) {
                    document.getElementById("eta-container").innerHTML =
                        '<div style="padding:20px;color:#fff;text-align:center;">無法取得數據 (HTTP ' + xhr.status + ')</div>';
                }
            }
        }
    };
    xhr.send(JSON.stringify({ stationcode: stationCode }));
}

// Merge OpenData results into the main ETA data structure
function mergeOpenDataIntoETA(data, odData) {
    if (!odData || !Object.keys(odData).length) return;
    if (!data.line) data.line = {};
    // Build a reverse map: canonical code -> legacy aliases present in data.line
    // e.g. "TML" -> ["EWL"] if data.line has "EWL"
    var legacyAliases = { "EAL": ["NSL"], "TML": ["EWL"] };
    Object.keys(odData).forEach(function (lineCode) {
        // Only merge if line is in "D" mode
        if (masterMode === 'D') {
            // Remove any legacy-alias key that would map to the same canonical line,
            // preventing processETAData from doubling up internal + OpenData trains.
            var aliases = legacyAliases[lineCode];
            if (aliases) {
                aliases.forEach(function (alias) {
                    if (data.line[alias] !== undefined) {
                        delete data.line[alias];
                    }
                });
            }
            data.line[lineCode] = odData[lineCode];
        }
    });
}

// Fetch OpenData for hybrid mode (always fetches all lines at station)
function fetchOpenDataForHybrid(stationCode, callback) {
    var station = stationByCode[stationCode];
    var linesToFetch = station ? station.lines.slice() : [];
    fetchOpenDataLines(stationCode, linesToFetch, callback);
}

// Return the subset of a station's lines that are listed in openDataLines
function getOpenDataLinesForStation(stationCode) {
    if (typeof openDataLines === 'undefined' || !openDataLines.length) return [];
    var station = stationByCode[stationCode];
    if (!station || !station.lines) return [];
    return station.lines.filter(function (lc) {
        return openDataLines.indexOf(lc) !== -1;
    });
}

// For lines in openDataLines: replace I-mode ETA with OpenData ETA,
// carrying over td from I-mode by position matching.
// This lets us show valid ETA times while preserving the train number (td).
function mergeOpenDataLinesETA(data, odData, openDataLinesList) {
    if (!data.line) data.line = {};
    openDataLinesList.forEach(function (lineCode) {
        var odLineData = odData[lineCode];
        if (!odLineData) return; // No OpenData available — keep I-mode data as-is
        var iModeLineData = data.line[lineCode] || {};
        var mergedPlatforms = {};
        Object.keys(odLineData).forEach(function (platNum) {
            var odTrains = odLineData[platNum];
            if (!Array.isArray(odTrains) || odTrains.length === 0) return;
            var iModeTrains = iModeLineData[platNum];
            if (!Array.isArray(iModeTrains)) iModeTrains = [];
            // Map each OpenData train to the I-mode train at the same position to get its td
            mergedPlatforms[platNum] = odTrains.map(function (odTrain, idx) {
                var merged = Object.assign({}, odTrain);
                var iModeTrain = iModeTrains[idx];
                merged.td = (iModeTrain && iModeTrain.td) ? iModeTrain.td : '';
                return merged;
            });
        });
        data.line[lineCode] = mergedPlatforms;
    });
}

// Supplement internal API data with OpenData ttnt values when stale
// Only replaces ttnt when |internal_ttnt - opendata_ttnt| <= 1
// Marks replaced trains with _odSupplemented flag for styling
function supplementInternalWithOpenData(data, odData) {
    if (!odData || !Object.keys(odData).length) return;
    if (!data.line) return;

    // Map legacy line codes for matching
    var legacyToCanonical = { "NSL": "EAL", "EWL": "TML" };

    Object.keys(data.line).forEach(function (internalLineCode) {
        // Skip lines handled by mergeOpenDataLinesETA — they already use OpenData ETA
        if (typeof openDataLines !== 'undefined' && openDataLines.indexOf(internalLineCode) !== -1) return;
        var canonicalLine = legacyToCanonical[internalLineCode] || internalLineCode;
        var odLine = odData[canonicalLine];
        if (!odLine) return;

        var platforms = data.line[internalLineCode];
        Object.keys(platforms).forEach(function (platformNum) {
            var internalTrains = platforms[platformNum];
            if (!Array.isArray(internalTrains)) return;
            var odTrains = odLine[platformNum];
            if (!odTrains || !odTrains.length) return;

            // Match by destination + platform, in order
            internalTrains.forEach(function (iTrain) {
                var iDest = iTrain.destination || iTrain.dest || '';
                // Skip NO_ (non-passenger) trains — they won't exist in OpenData
                if (iDest.indexOf('NO_') === 0) return;

                var iTtnt = parseInt(iTrain.ttnt, 10);
                if (isNaN(iTtnt)) return;

                // Find matching OpenData train by destination on same platform
                for (var oi = 0; oi < odTrains.length; oi++) {
                    var oTrain = odTrains[oi];
                    if (oTrain._used) continue;
                    var oDest = oTrain.destination || '';
                    if (resolveStationCode(oDest) !== resolveStationCode(iDest)) continue;

                    var oTtnt = parseInt(oTrain.ttnt, 10);
                    if (isNaN(oTtnt)) continue;

                    // Only replace if difference is ≤1 minute
                    var diff = Math.abs(iTtnt - oTtnt);
                    if (diff <= 1) {
                        iTrain.ttnt = oTrain.ttnt;
                        iTrain._odSupplemented = true;
                        oTrain._used = true;
                        break;
                    }
                }
            });
        });
    });

    // Set flag so processETAData can style the update time
    data._hasOdSupplement = true;
}

// Toggle master mode and re-fetch data
function toggleMasterMode() {
    masterMode = (masterMode === 'D') ? 'I' : 'D';
    saveMasterMode();
    updateMasterSwitch();
    if (currentStationCode) {
        fetchETASilent(currentStationCode);
    }
}

// Persist masterMode to localStorage
function saveMasterMode() {
    try { localStorage.setItem('mtreta_master_mode', masterMode); } catch(e) {}
}

// Load masterMode from localStorage
function loadLineModeState() {
    try {
        var stored = localStorage.getItem('mtreta_master_mode');
        if (stored === 'I' || stored === 'D') masterMode = stored;
    } catch(e) {}
}

// Update master switch UI to reflect current state
function updateMasterSwitch() {
    var el = document.getElementById('settings-mode-input');
    if (!el) return;
    el.checked = (masterMode === 'I');
}

function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

// ============================================
// OpenData ETA Fetch
// ============================================
var OPENDATA_API_URL = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

function fetchOpenDataETA(stationCode, callback) {
    var station = stationByCode[stationCode];
    if (!station) { callback({}); return; }

    // Only fetch lines in D mode
    var linesToFetch = [];
    station.lines.forEach(function (lc) {
        if (masterMode === 'D') linesToFetch.push(lc);
    });
    fetchOpenDataLines(stationCode, linesToFetch, callback);
}

// Shared OpenData fetch: fetches specified lines and parses responses
function fetchOpenDataLines(stationCode, linesToFetch, callback) {
    if (!linesToFetch || !linesToFetch.length) { callback({}, null); return; }

    var results = {};
    var sysTime = null;
    var pending = linesToFetch.length;

    linesToFetch.forEach(function (lineCode) {
        var url = OPENDATA_API_URL + "?line=" + encodeURIComponent(lineCode) + "&sta=" + encodeURIComponent(stationCode);
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.timeout = 10000;
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 200) {
                try {
                    var resp = JSON.parse(xhr.responseText);
                    if (resp.sys_time) sysTime = resp.sys_time;
                    if (resp.status === 1 && resp.data) {
                        var key = lineCode + "-" + stationCode;
                        var stationData = resp.data[key];
                        if (stationData) {
                            if (!results[lineCode]) results[lineCode] = {};
                            Object.keys(stationData).forEach(function (dir) {
                                var trains = stationData[dir];
                                if (!Array.isArray(trains)) return;
                                trains.forEach(function (t) {
                                    if (t.valid !== "Y") return;
                                    var plat = String(t.plat || "1");
                                    if (!results[lineCode][plat]) results[lineCode][plat] = [];
                                    var ttnt = t.ttnt;
                                    if (ttnt === undefined || ttnt === null || ttnt === "-") {
                                        ttnt = calculateTtntFromTime(t.time);
                                    }
                                    results[lineCode][plat].push({
                                        ttnt: String(ttnt),
                                        destination: t.dest || "",
                                        td: "",
                                        tta: t.time || "",
                                        ttd: ""
                                    });
                                });
                            });
                        }
                    }
                } catch (e) {
                    console.error("OpenData parse error (" + lineCode + "):", e);
                }
            }
            pending--;
            if (pending <= 0) callback(results, sysTime);
        };
        xhr.ontimeout = function () {
            pending--;
            if (pending <= 0) callback(results, sysTime);
        };
        xhr.send();
    });
}

function calculateTtntFromTime(timeStr) {
    if (!timeStr) return "";
    // timeStr format: "2026-05-22 18:05:00"
    var parts = timeStr.split(" ");
    if (parts.length < 2) return "";
    var timeParts = parts[1].split(":");
    if (timeParts.length < 3) return "";
    var arrivalDate = new Date(parts[0] + "T" + parts[1]);
    var now = new Date();
    var diffMs = arrivalDate - now;
    var diffMin = Math.round(diffMs / 60000);
    if (diffMin < 0) diffMin = 0;
    return String(diffMin);
}

// ============================================
// Line-Specific API (trainLoads) — 30s cache
// ============================================
function startLineApiFetch(stationCode) {
    stopLineApiFetch();
    // Clear cache when switching stations to prevent cross-line contamination
    trainInfoCache = {};
    resetLineApiTime();
    var station = stationByCode[stationCode];
    if (!station) return;

    var linesToFetch = getLineApiLines(station);
    if (!linesToFetch.length) return;

    // Immediately fetch for relevant lines
    linesToFetch.forEach(function (lineCode) {
        fetchLineApi(lineCode);
    });

    // Set up 30s interval per line
    linesToFetch.forEach(function (lineCode) {
        lineApiTimers[lineCode] = setInterval(function () {
            fetchLineApi(lineCode);
        }, LINE_API_REFRESH_INTERVAL);
    });
}

function stopLineApiFetch() {
    Object.keys(lineApiTimers).forEach(function (lc) {
        clearInterval(lineApiTimers[lc]);
    });
    lineApiTimers = {};
}

// Determine which lines need the line-specific API call
function getLineApiLines(station) {
    var lines = [];
    if (typeof lineApiConfig === "undefined") return lines;
    (station.lines || []).forEach(function (lc) {
        var cfg = lineApiConfig[lc];
        if (cfg && cfg.url) {
            lines.push(lc);
        }
    });
    return lines;
}

function fetchLineApi(lineCode, retryCount) {
    var cfg = lineApiConfig[lineCode];
    if (!cfg || !cfg.url) return;
    if (retryCount === undefined) retryCount = 0;

    var url = cfg.url;

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    if (cfg.x_api_key) {
        xhr.setRequestHeader("x-api-key", cfg.x_api_key);
    }
    xhr.timeout = 15000;
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            try {
                var raw = JSON.parse(xhr.responseText);
                var trains = normalizeLineApiResponse(raw, lineCode, cfg.json_type);
                if (trains && trains.length > 0) {
                    trainInfoCache[lineCode] = {
                        data: trains,
                        timestamp: new Date()
                    };
                    updateLineApiTime();
                    if (currentStationCode) {
                        updateTrainEnrichment();
                        autoExpandRow2ForWideScreen();
                    }
                }
            } catch (e) {
                console.error("Failed to parse line API (" + lineCode + "):", e);
                if (retryCount < 1) {
                    setTimeout(function () { fetchLineApi(lineCode, retryCount + 1); }, 3000);
                } else {
                    resetLineApiTimeIfEmpty();
                }
            }
        } else {
            console.error("Line API error (" + lineCode + "):", xhr.status);
            if (retryCount < 1) {
                setTimeout(function () { fetchLineApi(lineCode, retryCount + 1); }, 3000);
            } else {
                resetLineApiTimeIfEmpty();
            }
        }
    };
    xhr.ontimeout = function () {
        console.error("Line API timeout (" + lineCode + ")");
        if (retryCount < 1) {
            setTimeout(function () { fetchLineApi(lineCode, retryCount + 1); }, 3000);
        } else {
            resetLineApiTimeIfEmpty();
        }
    };
    xhr.send();
}

// Normalize different API response formats into a common train array
function normalizeUrlFormat(raw, lineCode) {
    if (!Array.isArray(raw)) return [];
    var nowSec = Math.floor(Date.now() / 1000);
    var filterSec = TRAIN_LOAD_TIME_FILTER_MS / 1000;
    return raw.filter(function (train) {
        if (train.line !== lineCode) return false;
        if (train.ttl && Math.abs(train.ttl - nowSec) > filterSec) return false;
        return true;
    });
}

function normalizeSilFormat(raw) {
    if (!Array.isArray(raw)) return [];
    var nowSec = Math.floor(Date.now() / 1000);
    var filterSec = TRAIN_LOAD_TIME_FILTER_MS / 1000;
    return raw.filter(function (train) {
        var ttl = parseInt(train.ttl) || 0;
        if (!ttl || Math.abs(ttl - nowSec) > filterSec) return false;
        return true;
    }).map(function (train) {
        var doorOpen = false;
        if (train.doorOpenAction && train.doorOpenAction !== '-') doorOpen = true;
        return {
            td: train.trainId || '',
            trainId: train.trainId || '',
            trainType: '',
            trainConsist: train.trainSet || '',
            currentStationCode: (train.currentStationCode && train.currentStationCode !== '-') ? train.currentStationCode : '',
            nextStationCode: (train.nextStationCode && train.nextStationCode !== '-') ? train.nextStationCode : '',
            destinationStationCode: (train.destinationStationCode && train.destinationStationCode !== '-') ? train.destinationStationCode : '',
            doorStatus: doorOpen,
            trainSpeed: 0,
            updatedTime: train.receivedTime ? Number(train.receivedTime) : null,
            line: 'SIL',
            carLoads: (train.carLoads || []).map(function (car) {
                return {
                    carNo: car.carNo || '',
                    passengerCount: car.passengerCount >= 0 ? car.passengerCount : 0,
                    passengerLoad: car.floorRemainingAvg >= 0 ? car.floorRemainingAvg : 0
                };
            })
        };
    });
}

function normalizeTclFormat(raw) {
    if (!Array.isArray(raw)) return [];
    var nowSec = Math.floor(Date.now() / 1000);
    var filterSec = TRAIN_LOAD_TIME_FILTER_MS / 1000;
    return raw.filter(function (item) {
        var tid = (item.jsonContent && item.jsonContent.trainId) || item.trainId || '';
        if (tid.indexOf('TCL') !== 0 && tid.indexOf('V') !== 0) return false;
        var ttl = parseInt(item.ttl) || 0;
        if (!ttl || Math.abs(ttl - nowSec) > filterSec) return false;
        return true;
    }).map(function (item) {
        var jc = item.jsonContent || {};
        var rawTd = item.td || jc.trainDistribution || '';
        var curSta = jc.curStn || item.currentStationCode || '';
        var nextSta = jc.nextStn || item.nextStationCode || '';
        var destSta = jc.destStn || item.destinationStationCode || '';
        // Treat '---' as unknown
        if (curSta === '---') curSta = '';
        if (nextSta === '---') nextSta = '';
        if (destSta === '---') destSta = '';
        return {
            td: rawTd,
            trainId: jc.trainId || item.trainId || '',
            trainType: jc.trainType || item.trainType || '',
            trainConsist: item.trainConsist || '',
            currentStationCode: curSta,
            nextStationCode: nextSta,
            destinationStationCode: destSta,
            doorStatus: jc.doorStatus !== undefined ? jc.doorStatus : item.doorStatus,
            trainSpeed: jc.trainSpeed || item.trainSpeed || 0,
            updatedTime: item.updatedTime || jc.updatedTime,
            line: 'TCL',
            carLoads: (item.carLoads || []).map(function (car) {
                return {
                    carNo: car.carNo || '',
                    passengerCount: car.passengerCount !== undefined ? car.passengerCount : 0,
                    passengerLoad: car.passengerLoad !== undefined ? parseFloat(car.passengerLoad) : -1
                };
            })
        };
    });
}

function normalizeNslFormat(raw) {
    if (!Array.isArray(raw)) return [];
    var nowMs = Date.now();
    return raw.filter(function (train) {
        var ttl = parseInt(train.ttl) || 0;
        if (!ttl || Math.abs(ttl - nowMs) > TRAIN_LOAD_TIME_FILTER_MS) return false;
        return true;
    }).map(function (train) {
        var doorOpen = train.doorStatus === "0" || train.doorStatus === 0;
        var cars = (train.listCars || []).map(function (car) {
            return {
                carNo: car.carName || '',
                passengerCount: car.passengerCount !== undefined ? car.passengerCount : 0
            };
        });
        return {
            td: train.td || '',
            trainId: train.trainId || '',
            trainType: '',
            trainConsist: '',
            currentStationCode: String(train.currentStationCode || ''),
            nextStationCode: String(train.nextStationCode || ''),
            destinationStationCode: String(train.destinationStationCode || ''),
            doorStatus: doorOpen,
            trainSpeed: parseFloat(train.trainSpeed) || 0,
            startDistance: train.startDistance,
            targetDistance: train.targetDistance,
            updatedTime: train.receivedTime ? train.receivedTime / 1000 : null,
            line: 'EAL',
            carLoads: cars
        };
    });
}

function normalizeTmlFormat(raw) {
    var items = raw.Items || raw.items || (Array.isArray(raw) ? raw : []);
    if (!Array.isArray(items)) return [];

    // Filter: only in-service trains with recent data (within 2 minutes)
    var filtered = items.filter(function (train) {
        if (!train.isInService) return false;
        var ts = parseInt(train.receivedTime);
        var isOutdated = ts < Date.now() - TRAIN_LOAD_TIME_FILTER_MS;
        if (isNaN(ts) || isOutdated) return false;
        if (!train.trainId || train.trainId === '000' || train.trainId === '999') return false;
        return true;
    });

    // Deduplicate: group by (currentStationCode, nextStationCode, destinationStationCode)
    // Keep only the one with the smallest trainId (numeric), verifying trainload of all cars
    var groups = {};
    filtered.forEach(function (train) {
        var key = String(train.currentStationCode) + '_' + String(train.nextStationCode) + '_' + String(train.destinationStationCode);
        if (train.listCars?.every(car => !car.passengerCount)) {
            return;
        }

        if (train.listCars && Array.isArray(train.listCars)) {
            key += '_' + train.listCars.map(function(c) { return c.passengerCount; }).join(',');
        }
        if (!groups[key]) {
            groups[key] = train;
        } else {
            var existing = parseInt(groups[key].trainId) || 9999;
            var current = parseInt(train.trainId) || 9999;
            if (current < existing) {
                groups[key] = train;
            }
        }
    });

    var deduped = Object.keys(groups).map(function (k) { return groups[k]; });

    return deduped.map(function (train) {
        // Determine direction using tmlStationOrder
        var curOrder = (typeof tmlStationOrder !== 'undefined') ? (tmlStationOrder[String(train.currentStationCode)] || 0) : 0;
        var destOrder = (typeof tmlStationOrder !== 'undefined') ? (tmlStationOrder[String(train.destinationStationCode)] || 0) : 0;
        var isUpline = curOrder < destOrder; // toward TUM = upline

        // Extract car loads from listCars
        var cars = (train.listCars || []).map(function (car) {
            return {
                carNo: car.carName || car.carNo || '',
                passengerCount: (car.passengerCount !== undefined && car.passengerCount !== null) ? car.passengerCount : -1
            };
        });

        return {
            td: train.trainId || '',
            trainId: train.trainId || '',
            train_type: train.train_type || '',
            trainType: train.train_type || '',
            trainConsist: '',
            currentStationCode: String(train.currentStationCode || ''),
            nextStationCode: String(train.nextStationCode || ''),
            destinationStationCode: String(train.destinationStationCode || ''),
            doorStatus: train.isDoorOpen || false,
            trainSpeed: train.trainSpeed || 0,
            updatedTime: train.receivedTime ? train.receivedTime / 1000 : null,
            line: 'TML',
            isUpline: isUpline,
            carLoads: cars
        };
    });
}

function normalizeLineApiResponse(raw, lineCode, jsonType) {
    switch (jsonType) {
        case "url": return normalizeUrlFormat(raw, lineCode);
        case "sil": return normalizeSilFormat(raw);
        case "tcl": return normalizeTclFormat(raw);
        case "nsl": return normalizeNslFormat(raw);
        case "tml": return normalizeTmlFormat(raw);
        default:
            if (Array.isArray(raw)) {
                return raw.filter(function (train) { return train.line === lineCode; });
            }
            return [];
    }
}

// Update the "Trainload" timestamp display (only from lines with train type support)
function updateLineApiTime() {
    var latestTime = null;
    Object.keys(trainInfoCache).forEach(function (lc) {
        if (TRAINTYPE_SUPPORTED_LINES.indexOf(lc) === -1) return;
        var cache = trainInfoCache[lc];
        if (cache && cache.timestamp) {
            if (!latestTime || cache.timestamp > latestTime) {
                latestTime = cache.timestamp;
            }
        }
    });
    var el = document.getElementById("line-api-time");
    if (el && latestTime) {
        el.textContent = formatTimeHHMMSS(latestTime);
    } else if (el) {
        el.textContent = "-- : -- : --";
    }
}

function resetLineApiTime() {
    var el = document.getElementById("line-api-time");
    if (el) el.textContent = "-- : -- : --";
}

function resetLineApiTimeIfEmpty() {
    var hasData = Object.keys(trainInfoCache).some(function (lc) {
        if (TRAINTYPE_SUPPORTED_LINES.indexOf(lc) === -1) return false;
        return trainInfoCache[lc] && trainInfoCache[lc].data && trainInfoCache[lc].data.length > 0;
    });
    if (!hasData) resetLineApiTime();
}

// ============================================
// Train Enrichment — map line API data to ETA rows
// ============================================
// Build a lookup by train code (td) from all cached line data
// Now also keyed by line to avoid cross-line collisions
function getTrainInfoByTd(filterLine) {
    var lookup = {};
    Object.keys(trainInfoCache).forEach(function (lineCode) {
        if (filterLine && filterLine !== lineCode) return;
        var cache = trainInfoCache[lineCode];
        if (!cache || !cache.data) return;
        cache.data.forEach(function (train) {
            if (!train.td || train.td === "NA" || train.td === "000") return;
            var td = train.td.replace(/[^0-9]/g, '');
            if (!td) return;
            // Normalise to 3 digits for matching
            while (td.length < 3) td = '0' + td;
            td = td.slice(-3);
            var key = lineCode + '_' + td;

            var trainType = parseTrainTypeForLine(train, lineCode);
            var originStationCode = null;
            var routeCode = train.jsonContent ? train.jsonContent.routeCode : '';
            if ('C' === trainType) {
                if ('24' == routeCode) {
                    originStationCode = 'HOM';
                }
            }

            var infoObj = {
                trainId: train.trainId || '',
                trainType: trainType,
                trainConsist: train.trainConsist || '',
                currentStation: resolveStationCode((train.currentStationCode || '').replace(/_PLT$/, '')),
                nextStation: resolveStationCode(train.nextStationCode || ''),
                origin: resolveStationCode(originStationCode),
                destination: resolveStationCode(train.destinationStationCode || ''),
                doorStatus: train.doorStatus,
                trainSpeed: train.trainSpeed,
                startDistance: train.startDistance,
                targetDistance: train.targetDistance,
                updatedTime: train.updatedTime ? new Date(train.updatedTime * 1000) : null,
                line: train.line || lineCode,
                carLoads: train.carLoads || null,
                routeCode: routeCode
            };

            // On td collision, prefer the entry with valid currentStation (not "NA"/"-"/"")
            if (lookup[key]) {
                var existingCur = lookup[key].currentStation || '';
                var newCur = infoObj.currentStation || '';
                var existingValid = existingCur && existingCur !== 'NA' && existingCur !== '-';
                var newValid = newCur && newCur !== 'NA' && newCur !== '-';
                if (existingValid && !newValid) return; // keep existing
                if (!existingValid && newValid) { lookup[key] = infoObj; } // overwrite with better
                else { return; } // both valid or both invalid — keep first
            } else {
                lookup[key] = infoObj;
            }

            // SIL: trainload trainId (e.g. "A516"→"516") may differ in leading digit from ETA td.
            // Register under all leading-digit variants of the last 2-digit suffix.
            if (lineCode === 'SIL') {
                var suffix = td.slice(-2);
                for (var pfx = 0; pfx <= 9; pfx++) {
                    var altKey = lineCode + '_' + String(pfx) + suffix;
                    if (!lookup[altKey]) lookup[altKey] = infoObj;
                }
            }
        });
    });
    return lookup;
}

// ISL fallback: when exact 3-digit td has no match, try matching by last 2 digits
function lookupWithIslFallback(lookup, lineCode, normTd) {
    var key = lineCode + '_' + normTd;
    var info = lookup[key] || null;
    if (!info && lineCode === 'ISL') {
        var suffix = normTd.slice(-2);
        for (var pfx = 0; pfx <= 9; pfx++) {
            var altKey = 'ISL_' + String(pfx) + suffix;
            if (lookup[altKey]) { info = lookup[altKey]; break; }
        }
    }
    return info;
}

// TML position-based matching: builds a lookup keyed by nextStation abbreviation + direction
// Returns: { "stationAbbr_up": [info1, info2, ...], "stationAbbr_down": [...] }
// Each array is sorted by proximity (closest to station first, based on linesData order)
function getTmlPositionLookup() {
    var tmlLineCode = 'TML';
    var cache = trainInfoCache[tmlLineCode];
    if (!cache || !cache.data) return {};

    // Get TML station order from linesData for sorting
    var tmlLine = null;
    for (var i = 0; i < linesData.length; i++) {
        if (linesData[i].line_code === tmlLineCode) { tmlLine = linesData[i]; break; }
    }
    if (!tmlLine) return {};
    var stationList = tmlLine.stations; // TUM(idx0) → WKS(idx26), idx increases = downline direction

    // Build reverse map: abbreviation → index in linesData stations array
    var stationIndex = {};
    stationList.forEach(function (s, idx) { stationIndex[s] = idx; });

    var posLookup = {};

    cache.data.forEach(function (train) {
        if (!train.nextStationCode && !train.currentStationCode) return;

        var tmlStationCodeMap = stationCodeMap[tmlLineCode];
        // Resolve station codes to abbreviations
        var nextStaAbbr = (typeof tmlStationCodeMap !== 'undefined') ? tmlStationCodeMap[train.nextStationCode] : null;
        var currStaAbbr = (typeof tmlStationCodeMap !== 'undefined') ? tmlStationCodeMap[train.currentStationCode] : null;
        var destStaAbbr = (typeof tmlStationCodeMap !== 'undefined') ? tmlStationCodeMap[train.destinationStationCode] : null;

        // Direction: use precomputed isUpline
        var direction = train.isUpline ? 'up' : 'down';

        var infoObj = {
            trainId: train.trainId || '',
            trainType: parseTrainTypeForLine(train, tmlLineCode),
            trainConsist: '',
            currentStation: train.currentStationCode || '',
            nextStation: train.nextStationCode || '',
            destination: train.destinationStationCode || '',
            destinationAbbr: destStaAbbr || '',
            doorStatus: train.doorStatus,
            trainSpeed: train.trainSpeed,
            updatedTime: train.updatedTime ? new Date(train.updatedTime * 1000) : null,
            line: tmlLineCode,
            isUpline: train.isUpline,
            carLoads: train.carLoads || null,
            currIdx: currStaAbbr ? (stationIndex[currStaAbbr] !== undefined ? stationIndex[currStaAbbr] : -1) : -1
        };

        // Register under nextStationAbbr + direction (train is heading to this station)
        if (nextStaAbbr) {
            var posKey = nextStaAbbr + '_' + direction;
            if (!posLookup[posKey]) posLookup[posKey] = [];
            posLookup[posKey].push(infoObj);
        }

        // Also register under currentStationAbbr + direction (train is AT this station, e.g. door open)
        if (currStaAbbr && currStaAbbr !== nextStaAbbr) {
            var posKey2 = currStaAbbr + '_' + direction;
            if (!posLookup[posKey2]) posLookup[posKey2] = [];
            posLookup[posKey2].push(infoObj);
        }
    });

    // Sort each position group by proximity to the target station
    Object.keys(posLookup).forEach(function (key) {
        var parts = key.split('_');
        var targetAbbr = parts[0];
        var targetIdx = stationIndex[targetAbbr] !== undefined ? stationIndex[targetAbbr] : -1;
        posLookup[key].sort(function (a, b) {
            var distA = Math.abs(a.currIdx - targetIdx);
            var distB = Math.abs(b.currIdx - targetIdx);
            return distA - distB;
        });
    });

    return posLookup;
}

// Build a reverse map from station abbreviation to its TML numeric code
function getTmlReverseCodeMap() {
    var tmlStationCodeMap = stationCodeMap['TML'];
    if (typeof tmlStationCodeMap === 'undefined') return {};
    var rev = {};
    Object.keys(tmlStationCodeMap).forEach(function (numCode) {
        var abbr = tmlStationCodeMap[numCode];
        // Only store first (main) mapping for each abbreviation
        if (!rev[abbr]) rev[abbr] = numCode;
    });
    return rev;
}

// Get TML trains for a station+direction, searching backwards along the line if none found at target
// Returns an array of infoObj sorted by arrival order (closest first)
// etaDests: array of ETA destination codes (abbreviations) for verification
function getTmlTrainsForStation(stationAbbr, direction, etaDests, etaTtnts) {
    var posLookup = getTmlPositionLookup();

    // Get TML station list for traversal
    var tmlLine = null;
    for (var i = 0; i < linesData.length; i++) {
        if (linesData[i].line_code === 'TML') { tmlLine = linesData[i]; break; }
    }
    if (!tmlLine) return [];
    var stationList = tmlLine.stations;
    var stationIndex = {};
    stationList.forEach(function (s, idx) { stationIndex[s] = idx; });

    var targetIdx = stationIndex[stationAbbr];
    if (targetIdx === undefined) return [];

    // Collect trains: start at target station, then search backwards (where trains come from)
    // Upline (toward TUM = decreasing idx): trains come from higher indices
    // Downline (toward WKS = increasing idx): trains come from lower indices
    var collected = [];
    var usedTrainIds = {}; // prevent duplicates

    // Search range: target station and up to 10 stations back
    var maxSearch = 10;
    for (var step = 0; step <= maxSearch; step++) {
        var searchIdx;
        if (direction === 'up') {
            // Upline: trains come from higher indices (WKS side)
            searchIdx = targetIdx + step;
        } else {
            // Downline: trains come from lower indices (TUM side)
            searchIdx = targetIdx - step;
        }
        if (searchIdx < 0 || searchIdx >= stationList.length) break;

        var searchStation = stationList[searchIdx];
        var posKey = searchStation + '_' + direction;
        var entries = posLookup[posKey];
        if (!entries) continue;

        entries.forEach(function (info) {
            if (usedTrainIds[info.trainId]) return;
            usedTrainIds[info.trainId] = true;
            collected.push(info);
        });
    }

    // Sort collected trains by distance to target station (closest first)
    collected.sort(function (a, b) {
        var distA = Math.abs(a.currIdx - targetIdx);
        var distB = Math.abs(b.currIdx - targetIdx);
        return distA - distB;
    });

    // Match against ETA destinations: verify and stop on mismatch
    if (!etaDests || etaDests.length === 0) return collected;

    var matched = [];
    var reverseCodeMap = getTmlReverseCodeMap();

    for (var ei = 0; ei < etaDests.length; ei++) {
        var etaDest = etaDests[ei];
        var etaTtnt = (etaTtnts && etaTtnts[ei] !== undefined) ? parseInt(etaTtnts[ei], 10) : NaN;
        // Skip not-in-service departures
        if (!etaDest || etaDest.indexOf('NO_') === 0) {
            matched.push(null);
            continue;
        }
        // Check if ETA destination matches current station (not-in-service)
        if (resolveStationCode(etaDest) === resolveStationCode(stationAbbr)) {
            matched.push(null);
            continue;
        }

        // Find the next unmatched train whose destination matches this ETA departure
        var found = false;
        var etaDestResolved = resolveStationCode(etaDest);
        for (var ci = 0; ci < collected.length; ci++) {
            var trainInfo = collected[ci];
            // Compare resolved destination abbreviations
            var trainDestResolved = resolveStationCode(trainInfo.destinationAbbr || '');

            if (trainDestResolved === etaDestResolved) {
                // Check if train's nextStation is PAST the target station
                // If so, only allow match when ETA ttnt <= 0 (train already at/departed station)
                var tmlStationCodeMap = stationCodeMap['TML'];
                var nextStaAbbr = (typeof tmlStationCodeMap !== 'undefined') ? tmlStationCodeMap[trainInfo.nextStation] : null;
                var nextStaIdx = nextStaAbbr ? stationIndex[nextStaAbbr] : undefined;
                if (nextStaIdx !== undefined && !isNaN(etaTtnt) && etaTtnt >= 1) {
                    var isPast = direction === 'up' ? (nextStaIdx < targetIdx) : (nextStaIdx > targetIdx);
                    if (isPast) {
                        // Train has passed the station but ETA >= 1min — skip this train
                        continue;
                    }
                }
                matched.push(trainInfo);
                collected.splice(ci, 1); // remove from pool
                found = true;
                break;
            }
        }
        if (!found) {
            // Destination mismatch — stop trying to process further
            matched.push(null);
            break;
        }
    }

    // Fill remaining with null
    while (matched.length < etaDests.length) {
        matched.push(null);
    }

    return matched;
}

// Get TML train info for a specific ETA row by position matching
// stationAbbr: current viewing station, platformNum: platform number (odd=up, even=down)
// orderIdx: 0-based index among same-platform rows, or -1 to return full matched array
// etaDests: array of destination codes for all rows on this platform (for verification)
// etaTtnts: array of ttnt values for all rows on this platform
function getTmlTrainByPosition(stationAbbr, platformNum, orderIdx, etaDests, etaTtnts) {
    var direction = (platformNum % 2 === 1) ? 'up' : 'down';
    var matched = getTmlTrainsForStation(stationAbbr, direction, etaDests, etaTtnts);
    if (orderIdx === -1) return matched; // return full array
    if (!matched || orderIdx >= matched.length) return null;
    return matched[orderIdx];
}

function parseTrainTypeForLine(train, lineCode) {
    // TCL: use top-level trainType field first, fall back to trainId prefix
    if (lineCode === "TCL") {
        var tt = (train.trainType || '').toLowerCase();
        if (tt.indexOf('caf') !== -1) return 'A';
        if (tt.indexOf('k') !== -1) return 'K';
        // Fallback: parse from trainId "TCL K Vxxx-Vxxx" or "TCL C Vxxx-Vxxx"
        var tid = train.trainId || '';
        if (tid.indexOf('TCL K') === 0) return 'K';
        if (tid.indexOf('TCL C') === 0) return 'A';
        return '';
    }
    // TML: parse from train_type field
    else if (lineCode === "TML") {
        var tt = train.train_type || train.trainType || '';
        if (tt.indexOf('SP1900') !== -1) return '19';
        if (tt.indexOf('T1141A') !== -1) return 'C';
        return '';
    }
    // EAL/NSL: show "R" by default
    else if (lineCode === "EAL" || lineCode === "NSL") {
        var typeStr = train.trainType;
        if (!typeStr) return 'R';
        return typeStr.charAt(0).toUpperCase() || 'R';
    }
    // SIL: show "S" by default
    else if (lineCode === "SIL") {
        var typeStr = train.trainType;
        if (!typeStr) return 'S';
        return typeStr.charAt(0).toUpperCase() || 'S';
    }
    // Default: KTL/TWL/ISL/TKL
    else {
        var typeStr = train.trainType;
        if (!typeStr) return '';
        return typeStr.charAt(0).toUpperCase();
    }
}

// Update existing ETA rows with enrichment data (train type badge + door status)
function updateTrainEnrichment() {
    var lookup = getTrainInfoByTd();
    // TML: pre-compute matched trains per platform (with destination verification)
    var tmlMatchedByPlatform = {}; // key: platformNum → array of infoObj|null
    // Track which platforms already have door status shown (per line-section)
    var sections = document.querySelectorAll('.line-section');
    sections.forEach(function (section) {
        var rowLine = section.getAttribute('data-line');
        var platformDoorShown = {}; // platform -> true

        // TML: pre-build destination and ttnt arrays per platform for this section
        if (rowLine === 'TML') {
            var tmlRows = section.querySelectorAll('.eta-row[data-line="TML"]');
            var platformDests = {}; // platformNum → [dest1, dest2, ...]
            var platformTtnts = {}; // platformNum → [ttnt1, ttnt2, ...]
            tmlRows.forEach(function (r) {
                var plat = r.getAttribute('data-platform') || '1';
                var dest = r.getAttribute('data-dest') || '';
                var ttnt = r.getAttribute('data-ttnt') || '';
                if (!platformDests[plat]) platformDests[plat] = [];
                if (!platformTtnts[plat]) platformTtnts[plat] = [];
                platformDests[plat].push(dest);
                platformTtnts[plat].push(ttnt);
            });
            // Resolve matched trains for each platform
            Object.keys(platformDests).forEach(function (plat) {
                var platNum = parseInt(plat) || 1;
                var matchKey = 'TML_' + plat;
                tmlMatchedByPlatform[matchKey] = getTmlTrainByPosition(currentStationCode, platNum, -1, platformDests[plat], platformTtnts[plat]);
            });
        }

        var tmlPlatformCounters = {}; // per-section counters
        var rows = section.querySelectorAll('.eta-row');
        rows.forEach(function (row) {
            var row1 = row.querySelector('.eta-row1');
            if (!row1) return;
            var tcEl = row1.querySelector('.train-code');

            // Get td from .train-code if present; otherwise normalise from .eta-row's raw data-td
            var td = tcEl ? tcEl.getAttribute('data-td') : null;
            if (!td) {
                var rawTd = row.getAttribute('data-td') || '';
                var normTd = rawTd.replace(/[^0-9]/g, '');
                while (normTd.length < 3) normTd = '0' + normTd;
                normTd = normTd.slice(-3);
                td = (normTd && normTd !== '000') ? normTd : null;
            }
            if (!td) return;

            var key = rowLine ? rowLine + '_' + td : null;
            var info = key ? lookupWithIslFallback(lookup, rowLine, td) : null;

            // TML: use pre-computed position-based matching with destination verification
            if (rowLine === 'TML' && (!info || !info.carLoads || !info.carLoads.length)) {
                var platform = row.getAttribute('data-platform') || '1';
                var pKey = 'TML_' + platform;
                if (!tmlPlatformCounters[pKey]) tmlPlatformCounters[pKey] = 0;
                var orderIdx = tmlPlatformCounters[pKey];
                tmlPlatformCounters[pKey]++;
                var matchedArr = tmlMatchedByPlatform[pKey];
                if (matchedArr && orderIdx < matchedArr.length && matchedArr[orderIdx]) {
                    info = matchedArr[orderIdx];
                }
            }

            // Update or create train-type badge with click handler
            var typeEl = row1.querySelector('.train-type-badge');
            if (info && info.trainType) {
                if (!typeEl) {
                    typeEl = document.createElement('span');
                    typeEl.className = 'train-type-badge';
                    typeEl.onclick = function() { toggleRow2(this); };
                    if (tcEl) { tcEl.parentNode.insertBefore(typeEl, tcEl); }
                    else { row1.insertBefore(typeEl, row1.firstChild); }
                }
                typeEl.textContent = info.trainType;
                typeEl.className = 'train-type-badge train-type-' + info.trainType.toLowerCase();
                if (!typeEl.onclick) typeEl.onclick = function() { toggleRow2(this); };
            } else if (info && info.carLoads && info.carLoads.length > 0) {
                // NSL/SIL: show default badge only once trainload data is available
                var defType = '';
                if (rowLine === 'EAL') defType = 'R';
                else if (rowLine === 'SIL') defType = 'S';
                if (defType && !typeEl) {
                    typeEl = document.createElement('span');
                    typeEl.className = 'train-type-badge train-type-' + defType.toLowerCase();
                    typeEl.textContent = defType;
                    typeEl.onclick = function() { toggleRow2(this); };
                    if (tcEl) { tcEl.parentNode.insertBefore(typeEl, tcEl); }
                    else { row1.insertBefore(typeEl, row1.firstChild); }
                }
            }

            // TKL at TKO/TIK: update origin display from trainload currentStation (down line = even platforms only)
            if (rowLine === 'TKL' && (currentStationCode === 'TKO' || currentStationCode === 'TIK') && info && info.currentStation) {
                var tklPlatform = parseInt(row.getAttribute('data-platform'), 10);
                var tklIsDownLine = (!isNaN(tklPlatform) && tklPlatform % 2 === 0);
                var tklCurSta = info.currentStation;
                var tklOriginText = '';
                if (tklIsDownLine) {
                    if (tklCurSta === 'LHP') {
                        tklOriginText = stationByCode['LHP'].name_chi;
                    } else if (tklCurSta === 'POA' || tklCurSta === 'HAH') {
                        tklOriginText = stationByCode['POA'].name_chi;
                    }
                }
                var destEl = row1.querySelector('.eta-dest');
                var originEl = destEl ? destEl.querySelector('.eta-dest-origin') : null;
                if (tklOriginText && destEl) {
                    if (!originEl) {
                        originEl = document.createElement('span');
                        destEl.appendChild(originEl);
                    }
                    originEl.className = 'eta-dest-origin';
                    originEl.textContent = '[' + tklOriginText + '始発]';
                } else if (originEl) {
                    originEl.parentNode.removeChild(originEl);
                }
            }

            // KTL: update origin display from routeCode 24
            if (rowLine === 'KTL' && info && info.routeCode == 24) {
                var homSta = stationByCode['HOM'];
                if (homSta) {
                    var ktlOriginText = (currentStationCode === 'HOM') ? '當駅' : homSta.name_chi;
                    var ktlIsOriginSelf = (currentStationCode === 'HOM');
                    var destEl = row1.querySelector('.eta-dest');
                    var originEl = destEl ? destEl.querySelector('.eta-dest-origin') : null;
                    if (destEl) {
                        if (!originEl) {
                            originEl = document.createElement('span');
                            destEl.appendChild(originEl);
                        }
                        var isNoop = row.querySelector('.eta-dest-noop') !== null;
                        var originExtraClass = isNoop ? ' eta-dest-noop' : (ktlIsOriginSelf ? ' eta-dest-origin-self' : '');
                        originEl.className = 'eta-dest-origin' + originExtraClass;
                        originEl.textContent = '[' + ktlOriginText + '始発]';
                    }
                }
            }

            // Departed check reactively: if train at current station and TTNT is 0 or 1, mark as departed
            var ttntAttr = row.getAttribute('data-ttnt');
            var ttntVal = ttntAttr ? parseInt(ttntAttr, 10) : -1;
            if (info && info.currentStation && info.currentStation === currentStationCode && ttntVal <= 1) {
                var destChiEl = row1.querySelector('.eta-dest-chi');
                var etaTimeEl = row1.querySelector('.eta-time');
                if (destChiEl && !destChiEl.classList.contains('eta-dest-noop')) {
                    destChiEl.classList.add('eta-dest-departed');
                }
                if (etaTimeEl) {
                    etaTimeEl.classList.add('eta-time-muted');
                    etaTimeEl.innerHTML = '<span class="eta-time-departing">已離站</span>';
                }
            }

            // Door status: only show on first row of each platform
            var platform = row.getAttribute('data-platform');
            var isFirstForPlatform = platform && !platformDoorShown[platform];
            if (isFirstForPlatform && info) {
                platformDoorShown[platform] = true;
            }

            // If row2 is expanded, refresh its content
            var row2 = row.querySelector('.eta-row2');
            if (row2 && !row2.classList.contains('hidden')) {
                populateRow2(row2);
            }
        });
    });
}

// ============================================
// Process & Render ETA Data
// ============================================
function processETAData(data) {
    // Update last update time
    var updateEl = document.getElementById("last-update-time");
    if (data._hasOdSupplement && data._odSysTime) {
        // Stale internal data — show OpenData sys_time in yellow
        var t = new Date(data._odSysTime);
        lastUpdateTime = t;
        updateEl.textContent = formatTimeHHMMSS(t);
        updateEl.classList.add('eta-update-od-supplemented');
    } else {
        var timeSource = data.gen_time || data.sys_time;
        if (timeSource) {
            var t = new Date(timeSource);
            lastUpdateTime = t;
            updateEl.textContent = formatTimeHHMMSS(t);
        }
        // Fresh internal data — remove yellow highlight
        updateEl.classList.remove('eta-update-od-supplemented');
    }

    if (!data.line) {
        document.getElementById("eta-container").innerHTML =
            '<div style="padding:20px;text-align:center;">沒有列車資料</div>';
        return;
    }

    // Collect all trains grouped by line then platform
    const lineGroups = {};
    const enrichmentLookup = getTrainInfoByTd();

    Object.keys(data.line).forEach(function (lineCode) {
        const mappedLine = mapLineCode(lineCode);
        if (!lineByCode[mappedLine]) return;

        if (!lineGroups[mappedLine]) {
            lineGroups[mappedLine] = [];
        }

        const platforms = data.line[lineCode];
        Object.keys(platforms).forEach(function (platformNum) {
            const trains = platforms[platformNum];
            if (!Array.isArray(trains)) return;
            trains.forEach(function (train) {
                var ttnt = train.ttnt;
                var ttntNum = parseInt(ttnt, 10);
                // Filter out -1 min trains unless ttd is valid (originating trains)
                if (ttntNum < 0) {
                    var ttaNum = parseInt(train.tta, 10);
                    if (isNaN(ttaNum) || ttaNum < 0) return;
                    ttnt = train.tta; // use departure time for originating trains
                }

                // Enrichment lookup
                var enrichment = null;
                if (train.td) {
                    var tdNum = train.td.replace(/[^0-9]/g, '');
                    while (tdNum.length < 3) tdNum = '0' + tdNum;
                    tdNum = tdNum.slice(-3);
                    enrichment = enrichmentLookup[mappedLine + '_' + tdNum];
                }

                lineGroups[mappedLine].push({
                    line: mappedLine,
                    platform: parseInt(platformNum, 10),
                    destination: train.destination || train.dest || "",
                    ttnt: ttnt,
                    tta: train.tta,
                    ttd: train.ttd,
                    td: train.td || "",
                    routeCode: train.routeCode || (enrichment ? enrichment.routeCode : null),
                    currentStation: enrichment ? enrichment.currentStation : null,
                    _odSupplemented: train._odSupplemented || false
                });
            });
        });
    });

    // Sort lines by line_id from linesData
    const sortedLineKeys = Object.keys(lineGroups).sort(function (a, b) {
        var lineA = lineByCode[a];
        var lineB = lineByCode[b];
        var idA = lineA ? lineA.line_id : 999;
        var idB = lineB ? lineB.line_id : 999;
        return idA - idB;
    });

    let html = "";

    sortedLineKeys.forEach(function (lineCode) {
        const trains = lineGroups[lineCode];

        // Check if platformGroup applies for this station
        var stationPlatformGroups = null;
        if (typeof platformGroup !== "undefined" && platformGroup[currentStationCode]) {
            stationPlatformGroups = platformGroup[currentStationCode];
        }

        // Determine which platform groups are relevant for THIS line's trains
        var linePlatforms = {};
        trains.forEach(function (t) { linePlatforms[t.platform] = true; });
        var relevantGroups = null;
        if (stationPlatformGroups) {
            relevantGroups = stationPlatformGroups.filter(function (grp) {
                return grp.some(function (p) { return linePlatforms[p]; });
            });
            if (relevantGroups.length === 0) relevantGroups = null;
        }

        if (relevantGroups) {
            // Group trains by platform group, sort by ttnt then platform
            var groupedTrains = [];
            var ungrouped = [];

            trains.forEach(function (train) {
                var assigned = false;
                for (var gi = 0; gi < relevantGroups.length; gi++) {
                    if (relevantGroups[gi].indexOf(train.platform) !== -1) {
                        if (!groupedTrains[gi]) groupedTrains[gi] = [];
                        groupedTrains[gi].push(train);
                        assigned = true;
                        break;
                    }
                }
                if (!assigned) ungrouped.push(train);
            });

            // Sort within each group: by ttnt, then platform
            var sortedTrains = [];
            groupedTrains.forEach(function (grp) {
                if (!grp) return;
                grp.sort(function (a, b) {
                    var tA = parseTimeValue(a), tB = parseTimeValue(b);
                    if (tA !== tB) return tA - tB;
                    return a.platform - b.platform;
                });
                sortedTrains = sortedTrains.concat(grp);
            });
            ungrouped.sort(function (a, b) {
                if (a.platform !== b.platform) return a.platform - b.platform;
                return parseTimeValue(a) - parseTimeValue(b);
            });
            sortedTrains = sortedTrains.concat(ungrouped);

            renderTrainsForLine(sortedTrains, lineCode, relevantGroups);
        } else {
            // Original logic: sort by platform ascending, then by time
            trains.sort(function (a, b) {
                if (a.platform !== b.platform) return a.platform - b.platform;
                return parseTimeValue(a) - parseTimeValue(b);
            });

            // Limit to MAX_TRAINS_PER_GROUP per platform
            const platformBuckets = {};
            const limitedTrains = [];
            trains.forEach(function (train) {
                const pf = train.platform;
                if (!platformBuckets[pf]) platformBuckets[pf] = 0;
                if (platformBuckets[pf] < MAX_TRAINS_PER_GROUP) {
                    limitedTrains.push(train);
                    platformBuckets[pf]++;
                }
            });

            renderTrainsForLine(limitedTrains, lineCode, null);
        }
    });

    function renderTrainsForLine(limitedTrains, lineCode, platformGroups) {
        const colour = getLineColour(lineCode);
        const lineInfo = lineByCode[lineCode];
        const lineChi = lineInfo ? lineInfo.name_chi : lineCode;
        const lineEng = lineInfo ? lineInfo.name_eng : "";

        html += '<div class="line-section" data-line="' + lineCode + '">';
        html += '<div class="line-bar" style="background-color:' + colour + '">';
        html += '<span class="line-bar-chi">' + lineChi + '</span>';
        html += '<span class="line-bar-eng">' + lineEng + '</span>';
        html += '</div>';

        // Group trains into 2 columns for independent layout rendering
        var columns = [[], []];
        limitedTrains.forEach(function (train) {
            var colIdx = 0; // Default to col 1 (left)
            if (platformGroups && platformGroups.length >= 2) {
                // Multiple groups: assign by group index
                for (var gi = 0; gi < platformGroups.length; gi++) {
                    if (platformGroups[gi].indexOf(train.platform) !== -1) {
                        colIdx = gi % 2;
                        break;
                    }
                }
            } else if (platformGroups && platformGroups.length === 1) {
                // Single group: all grouped trains go into col 0 (single column)
                colIdx = 0;
            } else {
                // No platformGroups: even platforms go to col 2 (right), odd to col 1 (left)
                var pNum = parseInt(train.platform, 10);
                if (!isNaN(pNum) && pNum % 2 === 0) {
                    colIdx = 1;
                }
            }
            columns[colIdx].push(train);
        });

        // Function to build row HTML
        function buildRowHtml(train, rowIndex, gridColAttr) {
            var destCode = train.destination;
            var destChi, isNoop = false;
            var isUnknownDest = false;

            var isVVTrain = (lineCode === 'EAL' && train.td && train.td.toUpperCase().indexOf('VV') === 0);

            if (lineCode === 'EAL' && train.td && train.td.toUpperCase().indexOf('TT') === 0) {
                destChi = "不 載 客 列 車";
                isNoop = true;
            } else if (destCode && destCode.indexOf("NO_") === 0) {
                destChi = "不 載 客 列 車";
                isNoop = true;
            } else if (currentStationCode && resolveStationCode(destCode) === resolveStationCode(currentStationCode)) {
                destChi = "不 載 客 列 車";
                isNoop = true;
            } else {
                var dest = stationByCode[resolveStationCode(destCode)];
                if (dest) {
                    destChi = dest.name_chi;
                } else {
                    destChi = "回 廠 (" + destCode + ")";
                    isUnknownDest = true;
                }
            }

            var isViaRac = (lineCode === 'EAL') && train.td && /[BGKN]/i.test(train.td) && !isNoop;
            
            // Departed logic: 
            // 1. ttnt === 0 and elapsed > 30s
            // 2. currentStationCode === train.currentStation (from enrichment)
            var isDeparted = false;
            if ((train.ttnt === 0 || train.ttnt === "0") && lastUpdateTime && (new Date() - lastUpdateTime) > 30000) {
                isDeparted = true;
            }
            // if currentStationCode === train.currentStation, treated as the train departed from the current station
            // Only update if TTNT is 1 or 0 to avoid showing at other lines/stations incorrectly
            var ttntVal = parseInt(train.ttnt, 10);
            if (currentStationCode && train.currentStation && currentStationCode === train.currentStation && ttntVal <= 1) {
                isDeparted = true;
            }

            var timeDisplay = formatTrainTime(train, isNoop || isUnknownDest, isDeparted);
            var isFullDMode = (masterMode === 'D');
            var isOpenDataModeLine = (typeof openDataLines !== 'undefined' && openDataLines.indexOf(lineCode) !== -1);
            var tdHtml;
            if (isFullDMode) {
                tdHtml = '';
            } else {
                tdHtml = renderTrainCode(train.td, lineCode, isVVTrain);
            }
            var rowClass = (rowIndex % 2 === 0) ? 'eta-row-even' : 'eta-row-odd';
            var isDark = document.body.classList.contains('dark-mode');
            var evenBg = isDark ? darkenColor(colour, 0.80) : lightenColor(colour, 0.80);
            var rowStyle = (rowIndex % 2 === 0) ? ' style="background-color:' + evenBg + '"' : '';

            var destExtraClass = (isNoop || isUnknownDest || isVVTrain) ? ' eta-dest-noop' : (isDeparted ? ' eta-dest-departed' : '');
            var destInnerHtml = destChi;
            var destOriginHtml = '';
            var isOriginSelf = false;
            if (isViaRac && currentStationCode !== 'RAC') {
                destInnerHtml += '<span class="eta-dest-via"> 經馬場</span>';
            }

            if (lineCode === 'EAL' && train.td && train.td.length >= 2/* && !isNoop*/) {
                var ealSeq = (lineByCode['EAL'] || {}).stations || [];
                var currSeqIdx = ealSeq.indexOf(currentStationCode);
                var destSeqIdx = ealSeq.indexOf(resolveStationCode(train.destination));
                var nslIsDownLine = (currSeqIdx !== -1 && destSeqIdx !== -1 && destSeqIdx < currSeqIdx);
                var trainCodeLetter = train.td.charAt(nslIsDownLine ? 1 : 0).toUpperCase();
                var originCode = nslOriginMap[trainCodeLetter];
                if (originCode) {
                    var originSta = stationByCode[originCode];
                    if (originSta) {
                        if (originCode === currentStationCode && nslTermini.indexOf(currentStationCode) === -1) {
                            destOriginHtml = '當駅';
                            isOriginSelf = true;
                        } else if (originCode !== currentStationCode) {
                            destOriginHtml = originSta.name_chi;
                        }
                    }
                }
            } else if (lineCode === 'KTL' && !destOriginHtml) {
                if (train.routeCode == 24) {
                    var homSta = stationByCode['HOM'];
                    if (homSta) {
                        destOriginHtml = (currentStationCode === 'HOM') ? '當駅' : homSta.name_chi;
                        if (currentStationCode === 'HOM') isOriginSelf = true;
                    }
                }
            } else if (!destOriginHtml && typeof specialTrains !== 'undefined' && specialTrains[lineCode]) {
                var spOriginCode = getSpecialTrainOrigin(lineCode, train.td || '', train.platform);
                if (spOriginCode) {
                    var spOriginSta = stationByCode[spOriginCode];
                    if (spOriginSta) {
                        if (spOriginCode === currentStationCode) {
                            destOriginHtml = '當駅';
                            isOriginSelf = true;
                        } else {
                            destOriginHtml = spOriginSta.name_chi;
                        }
                    }
                }
            }

            var rowHtml = '<div class="eta-row ' + rowClass + '"' + rowStyle + ' data-td="' + (train.td || '') + '" data-line="' + lineCode + '" data-platform="' + train.platform + '" data-dest="' + (train.destination || '') + '" data-ttnt="' + (train.ttnt || '') + '"' + gridColAttr + '>';
            rowHtml += '<div class="eta-row1">';
            rowHtml += '<div class="eta-dest">';
            rowHtml += '<span class="eta-dest-chi' + destExtraClass + '">' + destInnerHtml + '</span>';
            if (destOriginHtml) {
                var originExtraClass = isNoop ? ' eta-dest-noop' : (isOriginSelf ? ' eta-dest-origin-self' : '');
                rowHtml += '<span class="eta-dest-origin' + originExtraClass + '">[' + destOriginHtml + '始発]</span>';
            }
            rowHtml += '</div>';
            rowHtml += tdHtml;
            rowHtml += '<div class="eta-platform-badge" style="background-color:' + colour + '">' + train.platform + '</div>';
            rowHtml += '<div class="eta-time' + ((isNoop || isUnknownDest || isVVTrain) ? ' eta-time-muted' : (isDeparted ? ' eta-time-muted' : '')) + '">' + timeDisplay + '</div>'
            rowHtml += '</div>';
            rowHtml += '<div class="eta-row2 hidden"></div>';
            rowHtml += '</div>';
            return rowHtml;
        }

        // Render each column's container wrapper
        columns.forEach(function (colTrains, ci) {
            if (colTrains.length === 0) return;
            if (ci > 0) {
                html += '<div class="platform-separator"></div>';
            }
            html += '<div class="platform-col" data-col="' + (ci + 1) + '">';
            var prevPlatform = null;
            var rowIndex = 1;
            colTrains.forEach(function (train) {
                // Determine layout separator rules correctly for within the column
                if (prevPlatform !== null && train.platform !== prevPlatform) {
                    //var sameGroup = false;
                    if (platformGroups) {
                        for (var gi = 0; gi < platformGroups.length; gi++) {
                            if (platformGroups[gi].indexOf(prevPlatform) !== -1 && platformGroups[gi].indexOf(train.platform) !== -1) {
                                //sameGroup = true;
                                break;
                            }
                        }
                    }
                    /*if (!sameGroup) {
                        html += '<div class="platform-separator"></div>';
                        rowIndex = 1;
                    }*/
                }
                prevPlatform = train.platform;

                var gridColAttr = ' data-grid-col="' + (ci + 1) + '"';
                html += buildRowHtml(train, rowIndex, gridColAttr);
                rowIndex++;
            });
            html += '</div>';
        });

        html += '</div>';
    }

    if (!html) {
        html = '<div style="padding:20px;text-align:center;">沒有列車資料</div>';
    }

    // Save expanded row2 state before replacing DOM
    var expandedKeys = [];
    var expandedStation = document.getElementById("eta-container").getAttribute('data-station');
    if (expandedStation && expandedStation === currentStationCode) {
        document.querySelectorAll('.eta-row2:not(.hidden)').forEach(function(r) {
            var etaRow = r.closest('.eta-row');
            if (etaRow) {
                var td = etaRow.getAttribute('data-td');
                var line = etaRow.getAttribute('data-line');
                if (td && line) expandedKeys.push(line + '_' + td);
            }
        });
    }

    document.getElementById("eta-container").innerHTML = html;
    document.getElementById("eta-container").setAttribute('data-station', currentStationCode);

    // Restore expanded row2 state
    if (expandedKeys.length) {
        document.querySelectorAll('.eta-row').forEach(function(etaRow) {
            var td = etaRow.getAttribute('data-td');
            var line = etaRow.getAttribute('data-line');
            if (td && line && expandedKeys.indexOf(line + '_' + td) !== -1) {
                var row2 = etaRow.querySelector('.eta-row2');
                var row1 = etaRow.querySelector('.eta-row1');
                if (row2) {
                    row2.classList.remove('hidden');
                    if (row1) row1.classList.add('eta-row1-expanded');
                }
            }
        });
    }

    // Re-apply line filter if active
    if (activeLineFilter) {
        filterByLine(activeLineFilter);
    }

    // Start countdown timers for ttnt=1
    startCountdownTimers();

    // Re-apply train enrichment from cached line API data
    updateTrainEnrichment();
    autoExpandRow2ForWideScreen();
    applySuperWideLayout();

    // Populate row2 content for restored expanded rows
    if (expandedKeys.length) {
        document.querySelectorAll('.eta-row2:not(.hidden)').forEach(function(row2) {
            populateRow2(row2);
        });
    }
}

// Auto-expand row2 for rows with trainload data
function autoExpandRow2ForWideScreen() {
    // Only expand the first row per platform/platform-group per line-section.
    // If the first row has no trainload badge, stop — do not try subsequent rows.
    document.querySelectorAll('.line-section').forEach(function (section) {
        var seenGroups = {}; // key: grid-col or platform → true once first row encountered
        section.querySelectorAll('.eta-row').forEach(function (etaRow) {
            // Use data-grid-col (platform group) if present, else fall back to platform number
            var groupKey = etaRow.getAttribute('data-grid-col') || etaRow.getAttribute('data-platform') || '1';
            if (seenGroups[groupKey]) return; // already handled the first row for this group
            // Mark this group as done immediately — first row only, no fallback
            seenGroups[groupKey] = true;

            var badge = etaRow.querySelector('.train-type-badge');
            // If no badge or badge is unknown placeholder, no trainload data — stop here
            if (!badge || badge.classList.contains('train-type-unknown') || !badge.textContent.trim()) return;

            var row2 = etaRow.querySelector('.eta-row2');
            var row1 = etaRow.querySelector('.eta-row1');
            if (!row2 || !row2.classList.contains('hidden')) return; // already expanded
            row2.classList.remove('hidden');
            if (row1) row1.classList.add('eta-row1-expanded');
            populateRow2(row2); // will collapse back silently if no carLoads data
        });
    });
}

// ============================================
// Super-wide layout (≥1760px): multi-column for multi-line stations
// ============================================
function applySuperWideLayout() {
    var container = document.getElementById('eta-container');
    if (!container) return;
    // Remove previous super-wide attributes
    container.removeAttribute('data-sw-cols');
    var allSections = container.querySelectorAll('.line-section');
    allSections.forEach(function (sec) {
        sec.removeAttribute('data-sw-col');
        sec.removeAttribute('data-sw-span');
    });

    if (window.innerWidth < 1760) return;

    var visibleSections = Array.prototype.slice.call(allSections).filter(function(sec) {
        return sec.style.display !== 'none';
    });
    var numLines = visibleSections.length;
    if (numLines <= 1) return; // single line uses existing 2-col behavior

    if (numLines === 2) {
        // 2 lines: 4 columns total. Each line gets 2 columns, unless a line has only 1 platform/group
        container.setAttribute('data-sw-cols', '4');

        visibleSections.forEach(function (sec, idx) {
            var lineCode = sec.getAttribute('data-line');
            var platformCount = getDistinctPlatformGroupCount(lineCode);
            if (platformCount === 1) {
                // Single platform/group: span 2 columns
                sec.setAttribute('data-sw-col', String(idx * 2 + 1));
                sec.setAttribute('data-sw-span', '2');
            } else {
                // Multiple platforms: use internal 2-col grid
                sec.setAttribute('data-sw-col', String(idx * 2 + 1));
                sec.setAttribute('data-sw-span', '2');
            }
        });
    } else if (numLines === 3) {
        container.setAttribute('data-sw-cols', '3');
        visibleSections.forEach(function (sec, idx) {
            sec.setAttribute('data-sw-col', String(idx + 1));
        });
    } else {
        // 4+ lines: 4 columns
        container.setAttribute('data-sw-cols', '4');
        visibleSections.forEach(function (sec, idx) {
            sec.setAttribute('data-sw-col', String((idx % 4) + 1));
        });
    }
}

// Count distinct platform groups or platforms for a line at the current station
function getDistinctPlatformGroupCount(lineCode) {
    if (!currentStationCode) return 1;
    var station = stationByCode[currentStationCode];
    if (!station) return 1;

    // Check if platformGroup is defined for this station and line
    var platformGroups = null;
    if (typeof platformGroup !== "undefined" && platformGroup[currentStationCode]) {
        platformGroups = platformGroup[currentStationCode];
    }

    // Get platforms for this line at this station from the ETA container
    var section = document.querySelector('.line-section[data-line="' + lineCode + '"]');
    if (!section) return 1;

    var platforms = {};
    section.querySelectorAll('.eta-row').forEach(function (row) {
        var p = row.getAttribute('data-platform');
        if (p) platforms[p] = true;
    });
    var platformList = Object.keys(platforms);

    if (platformGroups) {
        // Count how many distinct groups these platforms belong to
        var groupSet = {};
        platformList.forEach(function (p) {
            var pNum = parseInt(p);
            for (var gi = 0; gi < platformGroups.length; gi++) {
                if (platformGroups[gi].indexOf(pNum) !== -1) {
                    groupSet[gi] = true;
                    break;
                }
            }
        });
        return Math.max(Object.keys(groupSet).length, 1);
    }

    return platformList.length;
}

// ============================================
// Toggle row2 (expand/collapse train detail)
// ============================================
function toggleRow2(badgeEl) {
    var etaRow = badgeEl.closest('.eta-row');
    if (!etaRow) return;
    var row2 = etaRow.querySelector('.eta-row2');
    var row1 = etaRow.querySelector('.eta-row1');
    if (!row2) return;
    var isHidden = row2.classList.contains('hidden');
    if (isHidden) {
        row2.classList.remove('hidden');
        if (row1) row1.classList.add('eta-row1-expanded');
        populateRow2(row2);
    } else {
        row2.classList.add('hidden');
        if (row1) row1.classList.remove('eta-row1-expanded');
    }
}

// Populate row2 with carLoads and door status from enrichment cache
function populateRow2(row2El) {
    var etaRow = row2El.closest('.eta-row');
    if (!etaRow) return;
    var td = etaRow.getAttribute('data-td');
    var lineCode = etaRow.getAttribute('data-line');
    if (!td || !lineCode) { row2El.innerHTML = '<span class="row2-no-data">沒有列車資料</span>'; return; }

    // Re-normalise td to 3-digit for lookup
    var normTd = td.replace(/[^0-9]/g, '');
    while (normTd.length < 3) normTd = '0' + normTd;
    normTd = normTd.slice(-3);
    var key = lineCode + '_' + normTd;
    var lookup = getTrainInfoByTd(lineCode);
    var info = lookupWithIslFallback(lookup, lineCode, normTd);

    // TML: use position-based matching since trainId ≠ ETA td
    if (lineCode === 'TML' && (!info || !info.carLoads || !info.carLoads.length)) {
        var platform = parseInt(etaRow.getAttribute('data-platform')) || 1;
        // Determine order index and collect destinations for all same-platform rows
        var section = etaRow.closest('.line-section');
        var orderIdx = 0;
        var etaDests = [];
        var etaTtnts = [];
        if (section) {
            var sameRows = section.querySelectorAll('.eta-row[data-line="TML"][data-platform="' + platform + '"]');
            for (var ri = 0; ri < sameRows.length; ri++) {
                etaDests.push(sameRows[ri].getAttribute('data-dest') || '');
                etaTtnts.push(sameRows[ri].getAttribute('data-ttnt') || '');
                if (sameRows[ri] === etaRow) { orderIdx = ri; }
            }
        }
        var tmlInfo = getTmlTrainByPosition(currentStationCode, platform, orderIdx, etaDests, etaTtnts);
        if (tmlInfo) info = tmlInfo;
    }

    if (!info || !info.carLoads || !info.carLoads.length) {
        row2El.classList.add('hidden');
        var row1El = row2El.previousElementSibling;
        if (row1El && row1El.classList.contains('eta-row1')) {
            row1El.classList.remove('eta-row1-expanded');
        }
        return;
    }

    // Determine if this is the first ETA row for its platform (for door status display)
    var isFirstRow = false;
    var platform = etaRow.getAttribute('data-platform');
    if (platform) {
        var section = etaRow.closest('.line-section');
        if (section) {
            var allRows = section.querySelectorAll('.eta-row[data-platform="' + platform + '"]');
            isFirstRow = (allRows.length > 0 && allRows[0] === etaRow);
        }
    }

    var html = '';


    var lineStationCodeMap = stationCodeMap[lineCode] || null;
    var trainCurrentStationCode = lineStationCodeMap ? lineStationCodeMap[info.currentStation] : info.currentStation;
    var currStaObj = '';
    var nextStaObj = '';
    var nextStaCode = '';
    var locText = '';

    // Build door badge HTML (used in right column)
    var doorBadgeHtml = '';
    if (isFirstRow && info.doorStatus !== undefined && info.doorStatus !== null) {
        var doorClass = info.doorStatus ? 'door-badge-open' : 'door-badge-closed';
        var doorText = info.doorStatus ? 'Door Opened' : 'Door Closed';
        if (info.doorStatus && trainCurrentStationCode != null && currentStationCode !== trainCurrentStationCode) {
            doorText += ' (' + trainCurrentStationCode + ')';
            doorClass = 'door-badge-closed';
        }
        doorBadgeHtml = '<span class="door-badge ' + doorClass + '">' + doorText + '</span>';
    }

    // NSL: show currentStation > nextStation (or 停站中 if startDistance == 0)
    if ((lineCode === 'EAL') && info.currentStation) {
        currStaObj = stationByCode[resolveStationCode(trainCurrentStationCode)];
        var currStaLabel = currStaObj ? currStaObj.name_chi : trainCurrentStationCode;
        if (info.startDistance !== undefined && info.startDistance !== null && (info.startDistance === 0 || info.startDistance === '0')) {
            locText = currStaLabel + ' (停站中)';
        } else {
            var nextStaLabel = '';
            if (info.nextStation) {
                nextStaCode = lineStationCodeMap ? lineStationCodeMap[info.nextStation] : info.nextStation;
                var nextStaObj = stationByCode[resolveStationCode(nextStaCode)];
                nextStaLabel = nextStaObj ? nextStaObj.name_chi : nextStaCode;
            }
            locText = currStaLabel + (nextStaLabel ? ' > ' + nextStaLabel : '');
        }
    }
    if ((lineCode === 'TML') && info.currentStation) {
        currStaObj = stationByCode[resolveStationCode(trainCurrentStationCode)];
        var currStaLabel = currStaObj ? currStaObj.name_chi : trainCurrentStationCode;
        var nextStaLabel = '';
        if (info.nextStation) {
            nextStaCode = lineStationCodeMap ? lineStationCodeMap[info.nextStation] : info.nextStation;
            var nextStaObj = stationByCode[resolveStationCode(nextStaCode)];
            nextStaLabel = nextStaObj ? nextStaObj.name_chi : nextStaCode;
        }
        locText = currStaLabel + (nextStaLabel ? ' > ' + nextStaLabel : '');
    }
    // KTL/TWL/ISL/TKL/SIL/TCL: show currentStation > nextStation (Chinese names)
    if ((lineCode === 'KTL' || lineCode === 'TWL' || lineCode === 'ISL' || lineCode === 'TKL' || lineCode === 'SIL' || lineCode === 'TCL') && info.nextStation) {
        currStaObj = (info.currentStation && info.currentStation !== 'NA' && info.currentStation !== '-') ? stationByCode[resolveStationCode(info.currentStation)] : null;
        nextStaObj = stationByCode[resolveStationCode(info.nextStation)];
        var currStaLabel = currStaObj ? currStaObj.name_chi : '';
        var nextStaLabel = nextStaObj ? nextStaObj.name_chi : info.nextStation;
        nextStaCode = nextStaObj ? nextStaObj.station_code : 'N/A';
        if (info.currentStation && info.currentStation !== 'NA' && info.currentStation !== '-' &&
            resolveStationCode(info.currentStation) === resolveStationCode(info.nextStation)) {
            locText = nextStaLabel + ' (停站中)';
        } else {
            locText = currStaLabel ? (currStaLabel + ' > ' + nextStaLabel) : ('> ' + nextStaLabel);
        }
    }

    // Determine stopped state and viz data
    var isStopped = false;
    var vizLineColour = getLineColour(lineCode);
    var vizCurrLabel = currStaObj ? (currStaObj.name_chi || trainCurrentStationCode) : 'N/A';
    var vizNextLabel = nextStaObj ? (nextStaObj.name_chi || nextStaCode) : (nextStaCode || '');
    if (lineCode === 'EAL' && info.startDistance !== undefined && info.startDistance !== null && (info.startDistance === 0 || info.startDistance === '0')) {
        isStopped = true;
    } else if (lineCode === 'TML' 
        && info.currentStation && info.nextStation && resolveStationCode(trainCurrentStationCode) === resolveStationCode(nextStaCode)) {
        isStopped = true;
    } else if ((lineCode === 'KTL' || lineCode === 'TWL' || lineCode === 'ISL' || lineCode === 'TKL' || lineCode === 'SIL' || lineCode === 'TCL') 
        && info.currentStation && info.currentStation !== 'NA' && info.currentStation !== '-' 
        && resolveStationCode(info.currentStation) === resolveStationCode(info.nextStation)) {
        isStopped = true;
    }

    // Build train ID / consist HTML (for right column)
    var trainInfoHtml = '';
    if (!nextStationVizMode) {
        if (locText && locText.trim() !== '') {
            trainInfoHtml += '<span class="row2-info-item row2-loc-item">' + locText + '</span>';
        }
        if (info.trainSpeed && info.trainSpeed > 0) {
            trainInfoHtml += '<span class="row2-info-item">' + info.trainSpeed + ' km/h</span>';
        }
    }
    
    if (lineCode === 'TML' && info.currentStation) {
        if (info.trainId) {
            trainInfoHtml += '<span class="row2-info-item">Train #' + info.trainId + '</span>';
        }
    } else if (lineCode === 'EAL') {
        var ealTd = etaRow.getAttribute('data-td') || '';
        if (ealTd) {
            var ealTrainLabel = escapeHtml(ealTd);
            if (info.trainId) {
                var tidNum = parseInt(info.trainId, 10);
                if (!isNaN(tidNum) && tidNum > 0) {
                    ealTrainLabel += '(T' + Math.floor(tidNum / 3) + ')';
                }
            }
            trainInfoHtml += '<span class="row2-info-item">Train #' + ealTrainLabel + '</span>';
        }
    }
    var trainConsistText = '';
    if (lineCode === 'TKL' || (info.trainConsist && info.trainConsist === '-')) {
        trainConsistText = info.trainId ? info.trainId : '';
    } else {
        trainConsistText = info.trainConsist ? info.trainConsist : '';
    }
    if (trainConsistText && trainConsistText.trim() !== '') {
        trainInfoHtml += '<span class="row2-info-item">Consist: ' + trainConsistText + '</span>';
    }

    var viewStaObj = currentStationCode ? stationByCode[currentStationCode] : null;
    var viewStaLabel = viewStaObj ? viewStaObj.name_chi : currentStationCode;

    // ── Row 1: two-column layout ──────────────────────────────────────────────
    html += '<div class="row2-info-row">';

    // LEFT column (50%): visualization or plain text
    html += '<div class="' + (nextStationVizMode ? 'row2-left-col' : 'row2-left-col row2-left-col-viz') + '">';

    if (nextStationVizMode && locText && locText.trim() !== '') {
        // Detect station sequence distance for special stopped-at-station cases
        var stationDist = null;
        var orderMap = stationOrderMap[lineCode];
        if (orderMap) {
            var viewOrderRank = null;
            var trainOrderRank = null;
            if (lineCode === 'EAL' || lineCode === 'TML') {
                trainOrderRank = orderMap[info.currentStation];
                var mapForLine = stationCodeMap[lineCode];
                for (var id in mapForLine) {
                    if (mapForLine[id] === currentStationCode) { viewOrderRank = orderMap[id]; break; }
                }
            } else {
                viewOrderRank = orderMap[currentStationCode];
                trainOrderRank = orderMap[info.currentStation];
            }
            if (viewOrderRank !== null && viewOrderRank !== undefined && trainOrderRank !== null && trainOrderRank !== undefined) {
                var sortedRanks = [...new Set(Object.values(orderMap))].sort((a,b) => a - b);
                console.log(trainInfoHtml, 'viewOrderRank:', viewOrderRank, 'trainOrderRank:', trainOrderRank, 'sortedRanks:', sortedRanks);
                var vIdx = sortedRanks.indexOf(viewOrderRank);
                var tIdx = sortedRanks.indexOf(trainOrderRank);
                if (vIdx !== -1 && tIdx !== -1) { stationDist = Math.abs(vIdx - tIdx); }
            }
        }

        // Detect if train is stationary 
        var isStationary = (info.doorStatus === true);
        if (info.doorStatus === undefined || info.doorStatus === null) {
            if (lineCode === 'EAL') {
                isStationary = (info.startDistance === 0 || info.startDistance === '0');
            } else {
                isStationary = (info.currentStation && info.nextStation && resolveStationCode(info.currentStation) === resolveStationCode(info.nextStation));
            }
        }

        var isStoppedAtStart = (isStationary && stationDist === 0 && !isStopped);
        var isStoppedElsewhere = (isStationary && stationDist !== null && stationDist > 0 && !isStopped);

        if (isStoppedAtStart && !isStopped) {
            isStopped = true;
        }

        // Detect multi-hop (train is not yet at the station segment reaching the viewer)
        var isMultiHop = false;
        if (isStoppedElsewhere) {
            isMultiHop = (stationDist >= 2);
        } else if (nextStaCode && nextStaCode !== 'NA' && nextStaCode !== '-') {
            if (resolveStationCode(nextStaCode) !== resolveStationCode(currentStationCode)) {
                isMultiHop = true;
            }
        }

        // Calculate train progress position (0-100 scale on the segment)
        var segmentPct = null;
        if (isStoppedAtStart || isStoppedElsewhere) {
            segmentPct = 0; // At the dot
        } else if (lineCode === 'EAL' && !isStopped) {
            var startDist = parseInt(info.startDistance);
            var targetDist = parseInt(info.targetDistance);
            if (!isNaN(startDist) && !isNaN(targetDist) && (startDist + targetDist) > 0) {
                segmentPct = (startDist / (startDist + targetDist)) * 100;
            }
        }
        
        // Map segment progress to total line width progress
        var trainPosPct = null;
        if (segmentPct !== null) {
            trainPosPct = isMultiHop ? (segmentPct / 2) : segmentPct;
        }
        var trainStopAtCurrStation = (currentStationCode === trainCurrentStationCode);
        var arrowPct = isMultiHop && !trainStopAtCurrStation ? 25 : 50;

        html += '<div class="row2-viz">';
            html += '<div class="row2-viz-group">';
            html += '<div class="row2-viz-line" style="background-color:' + vizLineColour + '"></div>';
        if (isStoppedAtStart || isStopped) {
            if (trainStopAtCurrStation) {
                html += '<div class="row2-viz-dot row2-viz-dot-center"></div>';
                html += '</div>';
                html += '<span class="row2-viz-label row2-viz-label-center row2-viz-label-this-station">' + viewStaLabel + ' [当駅]</span>';
            }
            else {
                var leftDotClass = 'row2-viz-dot row2-viz-dot-left row2-viz-dot-stopped';
                html += '<div class="' + leftDotClass + '"></div>';
                html += '<div class="row2-viz-dot row2-viz-dot-right"></div>';
                
                html += '<div class="row2-viz-line-arrow row2-viz-arrow-blink" style="--arrow-pct:50%">' + arrowSvg + '</div>';
                html += '</div>'; // end row2-viz-group
                html += '<span class="row2-viz-label row2-viz-label-left">' + vizCurrLabel + '</span>';
                html += '<span class="row2-viz-label row2-viz-label-right row2-viz-label-this-station">' + viewStaLabel + ' [当駅]</span>';
            }
        } else {
            var leftDotClass = 'row2-viz-dot row2-viz-dot-left';
            if (isStoppedElsewhere) leftDotClass += ' row2-viz-dot-stopped';
            html += '<div class="' + leftDotClass + '"></div>';

            if (isMultiHop && !trainStopAtCurrStation) {
                var midDotClass = 'row2-viz-dot row2-viz-dot-mid';
                if (!isStoppedElsewhere) midDotClass += ' row2-viz-dot-flash';
                html += '<div class="' + midDotClass + '"></div>';
                html += '<div class="row2-viz-dot row2-viz-dot-right"></div>';
            } else {
                html += '<div class="row2-viz-dot row2-viz-dot-right row2-viz-dot-flash"></div>';
            }

            if (trainPosPct !== null) {
                html += '<div class="row2-viz-train" style="--train-pct:' + trainPosPct + ';color:' + vizLineColour + '">' + trainSvg + '</div>';
            }
            
            var arrowClass = 'row2-viz-line-arrow';
            if (isStoppedElsewhere) arrowClass += ' row2-viz-arrow-blink';
            html += '<div class="' + arrowClass + '" style="--arrow-pct:' + arrowPct + '%">' + arrowSvg + '</div>';
            
            if (info.trainSpeed && info.trainSpeed > 0) {
                html += '<span class="row2-viz-speed" style="--arrow-pct:' + arrowPct + '%">' + info.trainSpeed + ' km/h</span>';
            }
            html += '</div>'; // end row2-viz-group
            if (trainStopAtCurrStation) {
                html += '<span class="row2-viz-label row2-viz-label-left row2-viz-label-this-station">' + viewStaLabel + ' [当駅]</span>';
            } else {
                html += '<span class="row2-viz-label row2-viz-label-left">' + vizCurrLabel + '</span>';
            }

            if (isStoppedElsewhere) {
                if (stationDist >= 2) {
                    html += '<span class="row2-viz-label row2-viz-label-mid">' + vizNextLabel + '</span>';
                } 
                if (stationDist >= 1) {
                    html += '<span class="row2-viz-label row2-viz-label-right row2-viz-label-this-station">' + viewStaLabel + ' [当駅]</span>';
                }
            } else {
                if (trainStopAtCurrStation) {
                    html += '<span class="row2-viz-label row2-viz-label-right">' + vizNextLabel + '</span>';
                } else {
                    if (isMultiHop) {
                        html += '<span class="row2-viz-label row2-viz-label-mid">' + vizNextLabel + '</span>';
                    }
                    html += '<span class="row2-viz-label row2-viz-label-right row2-viz-label-this-station">' + viewStaLabel + ' [当駅]</span>';
                }
            }
        }
        html += '</div>';
    } else if (trainInfoHtml) {
        // Normal mode: show train load text info in left column
        html += '<div class="row2-info">' + trainInfoHtml + '</div>';
    }
    html += '</div>'; // row2-left-col

    // RIGHT column: door badge on top, train info below (both right-aligned)
    html += '<div class="row2-right-col">';
    html += '<div class="row2-door-slot">' + doorBadgeHtml + '</div>';
    if (nextStationVizMode && trainInfoHtml) {
        html += '<div class="row2-traininfo">' + trainInfoHtml + '</div>';
    }
    html += '</div>'; // row2-right-col

    html += '</div>'; // row2-info-row

    // Trainload cars row (lower)
    html += '<div class="trainload-cars">';
    //html += '<span class="trainload-direction">&larr;</span>';

    // Determine NSL first-class car position based on td direction
    var firstClassCarNo = -1;
    var carLoadsOrdered = info.carLoads;
    var platform = parseInt(etaRow.getAttribute('data-platform')) || 1;
    var isUp = (platform % 2 === 1);
    if (lineCode === 'EAL') {
        // Determine direction from trainload API station sequence; fall back to td last digit
        var isUp;
        var ealDirResolved = false;
        if (info.currentStation && info.nextStation) {
            var ealLineStations = (lineByCode['EAL'] || {}).stations || [];
            var currAbbr = (typeof lineStationCodeMap !== 'undefined' && lineStationCodeMap[info.currentStation]) || info.currentStation;
            var nextAbbr = (typeof lineStationCodeMap !== 'undefined' && lineStationCodeMap[info.nextStation]) || info.nextStation;
            var currIdx = ealLineStations.indexOf(currAbbr);
            var nextIdx = ealLineStations.indexOf(nextAbbr);
            if (currIdx !== -1 && nextIdx !== -1 && currIdx !== nextIdx) {
                isUp = (nextIdx > currIdx); // toward LMC = higher index = upline
                ealDirResolved = true;
            }
        }
        if (!ealDirResolved) {
            // Fallback: use last digit of td numeric portion
            var tdNums = td.replace(/[^0-9]/g, '');
            var lastDigit = tdNums.length > 0 ? parseInt(tdNums[tdNums.length - 1]) : 0;
            isUp = (lastDigit % 2 === 1);
        }
        firstClassCarNo = isUp ? 4 : 6; // up=car4, down=car6
        // Down line: carLoads[0]=car9, carLoads[8]=car1 — reverse for correct display order
        if (!isUp) {
            carLoadsOrdered = info.carLoads.slice().reverse();
        }
    // TWL/TCL: up line (odd platform) is inverted — reverse carLoads for upline
    } else if (lineCode === 'KTL' || lineCode === 'TWL' || lineCode === 'ISL' || lineCode === 'TCL') {
        if (isUp) {
            carLoadsOrdered = info.carLoads.slice().reverse();
        }
    }

    // TML: no reversal needed — always show car 1 to 8 from left
    //var tmlIsUpline = true;
    //if (lineCode === 'TML') {
    //    var tmlPlatform = parseInt(etaRow.getAttribute('data-platform')) || 1;
    //    tmlIsUpline = (tmlPlatform % 2 === 1);
    //}

    carLoadsOrdered.forEach(function (car, idx) {
        // Check if this is the first-class car for NSL
        var carNo = idx + 1;
        var carNoStr = '';
        var isFirstClass = (firstClassCarNo > 0 && carNo === firstClassCarNo);

        // Determine color class and display value
        var colorClass;
        var loadVal;
        if (lineCode === 'EAL') {
            // NSL: classify by passengerLoad thresholds
            loadVal = car.passengerCount >= 0 ? car.passengerCount : 0;
            colorClass = 'car-rect-eal '; 
            if (loadVal === undefined || loadVal === null || loadVal < 0) {
                colorClass += 'car-rect-empty';
            } else if (isFirstClass) {
                colorClass += loadVal < 70 ? 'car-rect-low' : (loadVal < 150 ? 'car-rect-mid' : 'car-rect-high');
            } else {
                colorClass += loadVal < 110 ? 'car-rect-low' : (loadVal < 250 ? 'car-rect-mid' : 'car-rect-high');
            }
        } else if (lineCode === 'TML') {
            // TML: passengerCount with thresholds 120/230
            var pCount = car.passengerCount;
            if (pCount === undefined || pCount === null || pCount < 0) {
                // Missing passengerCount: show "?" with white background
                loadVal = '?';
                colorClass = 'car-rect-empty';
            } else {
                loadVal = pCount;
                if (pCount < 120) colorClass = 'car-rect-low';
                else if (pCount < 230) colorClass = 'car-rect-mid';
                else colorClass = 'car-rect-high';
            }
            carNoStr = ' (' + car.carNo + ')';
        } else if (lineCode === 'TCL') {
            // TCL: passengerCount for color (same as URL), passengerLoad rounded to 2dp for display
            var pLoad = car.passengerLoad;
            if (pLoad !== undefined && pLoad !== null && pLoad >= 0) {
                loadVal = (Math.round(pLoad * 10) / 10).toFixed(1);
            } else {
                loadVal = '?';
            }

            var pCount = car.passengerCount !== undefined ? car.passengerCount : 0;
            if (pCount < 0) pCount = 0;
            if      (pCount <= 0)  colorClass = 'car-rect-empty';
            else if (pCount === 1) colorClass = 'car-rect-low';
            else if (pCount === 2) colorClass = 'car-rect-mid';
            else                   colorClass = 'car-rect-high';
        } else {
            // Other lines: use passengerCount as color indicator
            loadVal = car.passengerLoad;
            if (loadVal !== undefined && loadVal !== null && loadVal >= 0) {
                loadVal = Math.round(loadVal);
            } else {
                loadVal = '?';
            }

            var pCount = car.passengerCount !== undefined ? car.passengerCount : 0;
            if (pCount < 0) pCount = 0;
            if      (pCount <= 0)  colorClass = 'car-rect-empty';
            else if (pCount === 1) colorClass = 'car-rect-low';
            else if (pCount === 2) colorClass = 'car-rect-mid';
            else                   colorClass = 'car-rect-high';
        }

        html += '<div class="car-rect-wrapper">';
        html += '<div class="car-rect ' + colorClass + (isFirstClass ? ' first-class' : '') + '">';
        html += '<span class="car-load-val">' + loadVal + '</span>';
        html += '</div>';
        html += '<span class="car-num-label">' + carNo + '</span>';
        if (railwayPlasticMode && carNoStr) {
            html += '<span class="car-num-label car-num-label-extra">' + carNoStr + '</span>';
        }
        html += '</div>';
    });
    html += '</div>';

    row2El.innerHTML = html;
}

// ============================================
// Helper: Format Date to HH:MM:SS string
// ============================================
function formatTimeHHMMSS(date) {
    var hh = String(date.getHours()).padStart(2, "0");
    var mm = String(date.getMinutes()).padStart(2, "0");
    var ss = String(date.getSeconds()).padStart(2, "0");
    return hh + ":" + mm + ":" + ss;
}

function resolveStationCode(code) {
    return altCodeMap[code] || code;
}

// ============================================
// Helper: Map legacy line codes
// ============================================
function mapLineCode(code) {
    const mapping = {
        "NSL": "EAL",  // legacy name for East Rail
        "EWL": "TML"   // legacy name for Tuen Ma
    };
    return mapping[code] || code;
}

// ============================================
// Helper: Parse time value for sorting
// ============================================
function parseTimeValue(train) {
    var val = train.ttnt;
    if (val === 0 || val === "0") return -1;  // Departing first
    if (val === 1 || val === "1") return 0;   // Arriving next
    var n = parseInt(val, 10);
    return isNaN(n) ? 9999 : n;
}

// ============================================
// Helper: Format train arrival time display
// ============================================
function formatTrainTime(train, isMuted, isDepartedForce) {
    var val = train.ttnt;
    var mutedClass = isMuted ? ' eta-time-muted-text' : '';
    var odClass = train._odSupplemented ? ' eta-time-od-supplemented' : '';
    
    if (isDepartedForce) {
        return '<span class="eta-time-departing' + odClass + mutedClass + '">已離站</span>';
    }

    // Check if departing (0)
    if (val === 0 || val === "0") {
        // If current time - last update time > 30s, show 已離站
        if (lastUpdateTime) {
            var elapsed = new Date() - lastUpdateTime;
            if (elapsed > 30000) {
                return '<span class="eta-time-departing' + odClass + mutedClass + '">已離站</span>';
            }
        }
        return '<span class="eta-time-departing' + odClass + mutedClass + '">已到站</span>';
    }
    // Check if arriving (1) - show countdown
    if (val === 1 || val === "1") {
        return '<span class="eta-time-countdown' + odClass + mutedClass + '" data-countdown="1">0:59</span>';
    }
    // Otherwise show minutes
    var mins = parseInt(val, 10);
    if (isNaN(mins)) {
        return '<span class="eta-time-departing' + mutedClass + odClass + '">' + escapeHtml(String(val)) + '</span>';
    }

    if (mins > 60) {
        var refTime = new Date();
        var arrivalTime = new Date(refTime.getTime() + mins * 60000);
        var h = arrivalTime.getHours();
        var m = arrivalTime.getMinutes();
        var mStr = (m < 10 ? '0' : '') + m;
        return '<span class="eta-time-value' + odClass + mutedClass + '">' + h + ':' + mStr + '</span>';
    }

    return '<span class="eta-time-value' + odClass + mutedClass + '">' + mins + '</span><span class="eta-time-unit' + mutedClass + '"> min</span>';
}

function getSpecialTrainOrigin(lineCode, trainTd, platformNum) {
    if (typeof specialTrains === 'undefined' || !specialTrains[lineCode]) return null;
    var now = new Date();
    var dayOfWeek = now.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7; // Map Sunday from 0 to 7
    var specialsNew = specialTrains[lineCode];
    var lineData = linesOperationData[lineCode];
    var specialTrainShowBeforeMins = (lineData != null && lineData.journey_time != null) ? lineData.journey_time : DEFAULT_SPECIAL_TRAIN_SHOW_BEFORE_MINS;
    var specialTrainShowAfterMins  = (lineData != null && lineData.journey_time != null) ? lineData.journey_time  : DEFAULT_SPECIAL_TRAIN_SHOW_AFTER_MINS;
    var normalizedTd = String(parseInt((trainTd || '').replace(/[^0-9]/g, ''), 10) || 0).padStart(2, '0').slice(-2);
    
    var allSpecials = [];
    if (specialsNew.up) allSpecials = allSpecials.concat(specialsNew.up);
    if (specialsNew.down) allSpecials = allSpecials.concat(specialsNew.down);

    for (var i = 0; i < allSpecials.length; i++) {
        var s = allSpecials[i];
        if ((s.td !== normalizedTd) || (s.operating_days && s.operating_days.indexOf(dayOfWeek) === -1)) continue;
        var depParts = s.departure_time.split(':');
        var depMin = parseInt(depParts[0], 10) * 60 + parseInt(depParts[1], 10);
        var nowMin = now.getHours() * 60 + now.getMinutes();
        
        // Handle cross-midnight comparison safely using modulo
        var diff = (nowMin - depMin + 1440) % 1440;
        // diff is the minutes passed since departure time.
        // If it's a very large number (e.g. 1420), it means 'now' is BEFORE departure (e.g. 20 mins before).
        if (diff <= specialTrainShowAfterMins || diff >= (1440 - specialTrainShowBeforeMins)) {
            return s.origin_station_code;
        }
    }
    return null;
}

// ============================================
// Helper: Get line colour
// ============================================
function getLineColour(lineCode) {
    if (lineByCode[lineCode]) return lineByCode[lineCode].colour_code;
    return "#666666";
}

// ============================================
// Helper: Escape HTML to prevent XSS
// ============================================
function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ============================================
// 7-Segment Display for Train Code
// ============================================
function make7SegDigit(d, color) {
    var segs = {
        '0': [1,1,1,1,1,1,0],
        '1': [0,1,1,0,0,0,0],
        '2': [1,1,0,1,1,0,1],
        '3': [1,1,1,1,0,0,1],
        '4': [0,1,1,0,0,1,1],
        '5': [1,0,1,1,0,1,1],
        '6': [1,0,1,1,1,1,1],
        '7': [1,1,1,0,0,0,0],
        '8': [1,1,1,1,1,1,1],
        '9': [1,1,1,1,0,1,1]
    };
    var s = segs[d] || [0,0,0,0,0,0,0];
    var onColor = color || '#f7cc3e';
    var offColor = '#222222';
    var paths = [
        'M1.8,0 L10.2,0 L8.8,1.5 L3.2,1.5 Z', // Top
        'M10.5,0.3 L10.5,8.7 L9,7.9 L9,1.8 Z', // Upper Right
        'M10.5,9.4 L10.5,17.7 L9,16.2 L9,10.2 Z', // Lower Right
        'M1.8,18 L10.2,18 L8.8,16.5 L3.2,16.5 Z', // Bottom
        'M1.5,9.4 L1.5,17.7 L3,16.2 L3,10.2 Z', // Lower Left
        'M1.5,0.3 L1.5,8.7 L3,7.9 L3,1.8 Z', // Upper Left
        'M1.6,9 L3.1,8.3 L8.9,8.3 L10.3,9 L8.9,9.8 L3.1,9.8 Z' // Middle
    ];
    var svg = '<svg viewBox="0 0 12 18" class="seven-seg-digit">';
    for (var i = 0; i < 7; i++) {
        svg += '<path d="' + paths[i] + '" fill="' + (s[i] ? onColor : offColor) + '"/>';
    }
    svg += '</svg>';
    return svg;
}
/*
// Render a placeholder 7-segment display with all digits off (for openDataLines rows without a matched td)
function renderHiddenTrainCode() {
    var html = '<span class="train-type-badge train-type-unknown"></span>';
    html += '<div class="train-code train-code-hidden" data-td="">';
    html += make7SegDigit(' ') + make7SegDigit(' ') + make7SegDigit(' ');
    html += '</div>';
    return html;
}*/

function renderTrainCode(td, lineCode, isVVTrain) {
    //if (!td) return '<div class="train-code" data-td=""></div>';
    var typeBadgeNew = 'unknown';
    if (!td) {
        var html = '<span class="train-type-badge train-type-unknown"></span>';
        if (isVVTrain) {
            html = '<span class="train-type-badge train-type-vv"><img src="lib/chai.png" class="eta-chai-badge"></span>';
        }
        html += '<div class="train-code train-code-hidden" data-td="">';
        html += make7SegDigit(' ') + make7SegDigit(' ') + make7SegDigit(' ');
        html += '</div>';
        return html;
    }
    var nums = td.replace(/[^0-9]/g, '');
    while (nums.length < 3) nums = '0' + nums;
    nums = nums.slice(-3);
    // Look up train info for type badge (line-specific only)
    var lookup = getTrainInfoByTd();
    var key = lineCode ? lineCode + '_' + nums : null;
    var info = key ? lookupWithIslFallback(lookup, lineCode, nums) : null;
    var typeBadge = '';
    if (isVVTrain) {
        typeBadge = '<span class="train-type-badge train-type-vv"><img src="lib/chai.png" class="eta-chai-badge"></span>';
    } else if (info && info.trainType) {
        typeBadge = '<span class="train-type-badge train-type-' + info.trainType.toLowerCase() + '" onclick="toggleRow2(this)">' + info.trainType + '</span>';
    } else {
        typeBadge = '<span class="train-type-badge train-type-unknown"></span>';
    }
    var html = typeBadge + '<div class="train-code" data-td="' + nums + '">';
    for (var i = 0; i < 3; i++) {
        html += make7SegDigit(nums[i]);
    }
    html += '</div>';
    return html;
}

// ============================================
// Helper: Lighten a hex fy a percentage
// ============================================
function lightenColor(hex, percent) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    var r = parseInt(hex.substring(0,2), 16);
    var g = parseInt(hex.substring(2,4), 16);
    var b = parseInt(hex.substring(4,6), 16);
    r = Math.round(r + (255 - r) * percent);
    g = Math.round(g + (255 - g) * percent);
    b = Math.round(b + (255 - b) * percent);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function darkenColor(hex, percent) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    var r = parseInt(hex.substring(0,2), 16);
    var g = parseInt(hex.substring(2,4), 16);
    var b = parseInt(hex.substring(4,6), 16);
    r = Math.round(r * (1 - percent));
    g = Math.round(g * (1 - percent));
    b = Math.round(b * (1 - percent));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ============================================
// Countdown timers for ttnt=1 trains
// ============================================
function startCountdownTimers() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdowns, 1000);
    updateCountdowns();
}

function updateCountdowns() {
    var now = new Date();
    var elems = document.querySelectorAll('.eta-time-countdown');
    elems.forEach(function (el) {
        // target = lastUpdateTime + 30s
        // Countdown starts from 0:29 at ttnt=1, so we give it a full 30s to count down to 0:00
        var target = new Date(lastUpdateTime.getTime() + 30000);
        var diff = target - now;
        if (diff <= 0) {
            el.textContent = '進站中';
            el.classList.add('eta-time-departing');
        } else {
            var secs = Math.ceil(diff / 1000);
            var m = Math.floor(secs / 60);
            var s = secs % 60;
            el.textContent = m + ':' + String(s).padStart(2, '0');
        }
    });
}

// ============================================
// Settings Panel
// ============================================
function initSettingsPanel() {
    // Sync mode switch state
    var modeInput = document.getElementById('settings-mode-input');
    if (modeInput) {
        // Now: Checked means 'I', Unchecked means 'D'
        modeInput.checked = (masterMode === 'I');
    }
    // Sync viz switch state
    var vizInput = document.getElementById('settings-viz-input');
    if (vizInput) {
        vizInput.checked = nextStationVizMode;
    }
}

function toggleSettingsPanel() {
    var panel = document.getElementById('settings-panel');
    var overlay = document.getElementById('settings-overlay');
    var isOpen = !panel.classList.contains('hidden');
    if (isOpen) {
        closeSettingsPanel();
    } else {
        // Sync states before opening
        initSettingsPanel();
        panel.classList.remove('hidden');
        overlay.classList.remove('hidden');
        requestAnimationFrame(function () {
            panel.classList.add('open');
            overlay.classList.add('open');
        });
    }
}

function closeSettingsPanel() {
    var panel = document.getElementById('settings-panel');
    var overlay = document.getElementById('settings-overlay');
    panel.classList.remove('open');
    overlay.classList.remove('open');
    setTimeout(function () {
        panel.classList.add('hidden');
        overlay.classList.add('hidden');
    }, 300);
}

function settingsToggleTheme() {
    var isDark = document.body.classList.toggle('dark-mode');
    try { localStorage.setItem("mtreta_theme", isDark ? "dark" : "light"); } catch(e) {}
    // Re-render ETA to update inline row colors
    if (currentStationCode) { fetchETASilent(currentStationCode); }
}

function settingsToggleMode() {
    var modeInput = document.getElementById('settings-mode-input');
    masterMode = modeInput.checked ? 'I' : 'D';
    saveMasterMode();
    updateMasterSwitch();
    if (currentStationCode) fetchETAInternal(currentStationCode, false);
}

function settingsToggleViz() {
    var vizInput = document.getElementById('settings-viz-input');
    nextStationVizMode = vizInput.checked;
    try { localStorage.setItem("mtreta_nextstationviz", nextStationVizMode ? "true" : "false"); } catch(e) {}
    // Re-render expanded rows if any are open
    document.querySelectorAll('.eta-row2:not(.hidden)').forEach(function (row2El) {
        populateRow2(row2El);
    });
}
