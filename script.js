/* ============================================
   MTR ETA Web App - script.js
   地下鐵到站時間關注組
   ============================================ */

const APP_VERSION = "v0.07";
const API_URL = "https://408tq84duh.execute-api.ap-east-1.amazonaws.com/api/service/GetNextTrainData";
const MAX_TRAINS_PER_GROUP = 8;
const STORAGE_KEY_STATION = "mtreta_last_station";
const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds
const LINE_API_REFRESH_INTERVAL = 30000; // 30 seconds

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
let refreshTimer = null;
let autoRefreshTimer = null;
let clockTimer = null;
let activeLineFilter = null; // null = show all
let lastUpdateTime = null;   // Date object of last API gen_time
let countdownTimer = null;

// Global mode: "I" = Internal API, "D" = OpenData
let masterMode = 'I';
let lastInternalETAData = null; // cached internal API response

// PWA Install
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
});

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
});

// ============================================
// Clock
// ============================================
function startClock() {
    updateClock();
    clockTimer = setInterval(updateClock, 1000);
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

    // Light mode toggle (sun button)
    document.getElementById("sun-toggle").addEventListener("click", function () {
        document.body.classList.remove("dark-mode");
        try { localStorage.setItem("mtreta_theme", "light"); } catch(e) {}
        // Re-render ETA rows to update even-row inline background colours
        if (currentStationCode) { fetchETASilent(currentStationCode); }
    });

    // Dark mode toggle (moon button)
    document.getElementById("theme-toggle").addEventListener("click", function () {
        document.body.classList.add("dark-mode");
        try { localStorage.setItem("mtreta_theme", "dark"); } catch(e) {}
        // Re-render ETA rows to update even-row inline background colours
        if (currentStationCode) {
            fetchETASilent(currentStationCode);
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", function (e) {
        const selector = document.getElementById("station-selector");
        if (!selector.contains(e.target)) {
            closeStationList();
        }
    });

    // PWA install button
    document.getElementById("pwa-install").addEventListener("click", function () {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            deferredInstallPrompt.userChoice.then(function () {
                deferredInstallPrompt = null;
                //document.getElementById("pwa-install").style.display = "none";
            });
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
            var sortedStationLines = s.lines.slice().sort(function (a, b) {
                var la = lineByCode[a], lb = lineByCode[b];
                return (la ? la.line_id : 999) - (lb ? lb.line_id : 999);
            });
            var lineCircles = '';
            sortedStationLines.forEach(function (lc) {
                var colour = getLineColour(lc);
                lineCircles += '<span class="station-line-dot" style="background-color:' + colour + '"></span>';
            });

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
            var sortedLines = station.lines.slice().sort(function (a, b) {
                var la = lineByCode[a], lb = lineByCode[b];
                return (la ? la.line_id : 999) - (lb ? lb.line_id : 999);
            });
            var dotsHtml = '';
            sortedLines.forEach(function (lc) {
                var colour = getLineColour(lc);
                dotsHtml += '<span class="station-line-dot" style="background-color:' + colour + '"></span>';
            });
            document.getElementById("search-line-dots").innerHTML = dotsHtml;
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
        var sortedLines = station.lines.slice().sort(function (a, b) {
            var la = lineByCode[a], lb = lineByCode[b];
            return (la ? la.line_id : 999) - (lb ? lb.line_id : 999);
        });
        var dotsHtml = '';
        sortedLines.forEach(function (lc) {
            var colour = getLineColour(lc);
            dotsHtml += '<span class="station-line-dot" style="background-color:' + colour + '"></span>';
        });
        document.getElementById("search-line-dots").innerHTML = dotsHtml;
    }
    closeStationList();
    showStationInfoBar(code);
    updateMasterSwitch();
    fetchETA(code);
    startAutoRefresh();
    startLineApiFetch(code);
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
    var sections = document.querySelectorAll('#eta-container .line-section');
    sections.forEach(function (sec) {
        if (sec.getAttribute('data-line') === lineCode) {
            sec.style.display = '';
        } else {
            sec.style.display = 'none';
        }
    });
}

function showAllLines() {
    activeLineFilter = null;
    //document.getElementById("btn-show-all").classList.add("hidden");
    var sections = document.querySelectorAll('#eta-container .line-section');
    sections.forEach(function (sec) {
        sec.style.display = '';
    });
}

// ============================================
// Fetch ETA from API
// ============================================

// Returns true if master mode is D (OpenData)
function allLinesInDMode(stationCode) {
    return masterMode === 'D';
}

function fetchETA(stationCode) {
    showLoader();
    // If every line is in D mode, skip the internal API and use OpenData only
    if (allLinesInDMode(stationCode)) {
        fetchOpenDataETA(stationCode, function (odData, sysTime) {
            hideLoader();
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
            hideLoader();
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    // Also fetch OpenData for configured lines and merge
                    fetchOpenDataETA(stationCode, function (odData, sysTime) {
                        if (sysTime) data.sys_time = sysTime;
                        mergeOpenDataIntoETA(data, odData);
                        processETAData(data);
                    });
                } catch (e) {
                    console.error("Failed to parse ETA response:", e);
                    document.getElementById("last-update-time").textContent = "-- : -- : --";
                    document.getElementById("eta-container").innerHTML =
                        '<div style="padding:20px;color:#fff;text-align:center;">無法解析數據</div>';
                }
            } else {
                console.error("API error:", xhr.status);
                document.getElementById("last-update-time").textContent = "-- : -- : --";
                document.getElementById("eta-container").innerHTML =
                    '<div style="padding:20px;color:#fff;text-align:center;">無法取得數據 (HTTP ' + xhr.status + ')</div>';
            }
        }
    };
    xhr.send(JSON.stringify({ stationcode: stationCode }));
}

// Silent AJAX fetch (no loader)
function fetchETASilent(stationCode) {
    // If every line is in D mode, skip the internal API and use OpenData only
    if (allLinesInDMode(stationCode)) {
        fetchOpenDataETA(stationCode, function (odData, sysTime) {
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
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    fetchOpenDataETA(stationCode, function (odData, sysTime) {
                        if (sysTime) data.sys_time = sysTime;
                        mergeOpenDataIntoETA(data, odData);
                        processETAData(data);
                    });
                } catch (e) {
                    console.error("Failed to parse ETA response:", e);
                    document.getElementById("last-update-time").textContent = "-- : -- : --";
                }
            } else {
                console.error("API error:", xhr.status);
                document.getElementById("last-update-time").textContent = "-- : -- : --";
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
        if (getLineMode(lineCode) === 'D') {
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

// Get the current global mode ("I" or "D")
function getLineMode(lineCode) {
    return masterMode;
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
    var el = document.getElementById('master-mode-input');
    if (!el) return;
    var isD = masterMode === 'D';
    el.checked = isD;
    var slider = el.nextElementSibling;
    if (slider) slider.setAttribute('data-label', isD ? 'D' : 'I');
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

    // Find lines with mode "D" that this station belongs to
    var linesToFetch = [];
    station.lines.forEach(function (lc) {
        if (getLineMode(lc) === 'D') linesToFetch.push(lc);
    });
    if (!linesToFetch.length) { callback({}); return; }

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
                            // Convert UP/DOWN arrays to platform-keyed format
                            Object.keys(stationData).forEach(function (dir) {
                                var trains = stationData[dir];
                                if (!Array.isArray(trains)) return;
                                trains.forEach(function (t) {
                                    if (t.valid !== "Y") return;
                                    var plat = String(t.plat || "1");
                                    if (!results[lineCode][plat]) results[lineCode][plat] = [];
                                    // Calculate ttnt from time field if ttnt not present
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
function normalizeLineApiResponse(raw, lineCode, jsonType) {
    // Standard format: flat array with .line field (KTL, TWL, ISL, TKL)
    if (jsonType === "url") {
        if (!Array.isArray(raw)) return [];
        return raw.filter(function (train) {
            return train.line === lineCode;
        });
    }
    // SIL format: flat array, filter by line
    if (jsonType === "sil") {
        if (!Array.isArray(raw)) return [];
        return raw.filter(function (train) {
            return train.line === lineCode || train.line === "SIL";
        });
    }
    // TCL format: array with jsonContent containing trainId
    if (jsonType === "tcl") {
        if (!Array.isArray(raw)) return [];
        return raw.filter(function (item) {
            var tid = (item.jsonContent && item.jsonContent.trainId) || item.trainId || '';
            return tid.indexOf('TCL') === 0 || tid.indexOf('V') === 0;
        }).map(function (item) {
            // Flatten jsonContent into top-level for uniform access
            var jc = item.jsonContent || {};
            // td comes from top-level td field (train distribution number matching ETA)
            var rawTd = item.td || jc.trainDistribution || '';
            return {
                td: rawTd,
                trainId: jc.trainId || item.trainId || '',
                trainType: jc.trainType || item.trainType || '',
                trainConsist: jc.trainConsist || item.trainConsist || '',
                currentStationCode: jc.currentStationCode || item.currentStationCode || '',
                nextStationCode: jc.nextStationCode || item.nextStationCode || '',
                destinationStationCode: jc.destinationStationCode || item.destinationStationCode || '',
                doorStatus: jc.doorStatus !== undefined ? jc.doorStatus : item.doorStatus,
                trainSpeed: jc.trainSpeed || item.trainSpeed || 0,
                updatedTime: item.updatedTime || jc.updatedTime,
                line: 'TCL'
            };
        });
    }
    // EAL/NSL format
    if (jsonType === "nsl") {
        if (!Array.isArray(raw)) return [];
        return raw.filter(function (train) {
            return train.line === lineCode || train.line === "EAL";
        });
    }
    // TML format: wrapped in {"Items": [...]} with train_type field
    if (jsonType === "tml") {
        var items = raw.Items || raw.items || (Array.isArray(raw) ? raw : []);
        if (!Array.isArray(items)) return [];
        return items.map(function (train) {
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
                line: 'TML'
            };
        });
    }
    // Fallback: try as flat array
    if (Array.isArray(raw)) {
        return raw.filter(function (train) {
            return train.line === lineCode;
        });
    }
    return [];
}

// Lines with confirmed train type support
var TRAINTYPE_SUPPORTED_LINES = ["KTL", "TWL", "ISL", "TKL", "TCL", "TML"];

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
        var hh = String(latestTime.getHours()).padStart(2, "0");
        var mm = String(latestTime.getMinutes()).padStart(2, "0");
        var ss = String(latestTime.getSeconds()).padStart(2, "0");
        el.textContent = hh + ":" + mm + ":" + ss;
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

            lookup[key] = {
                trainId: train.trainId || '',
                trainType: parseTrainTypeForLine(train, lineCode),
                trainConsist: train.trainConsist || '',
                currentStation: resolveStationCode((train.currentStationCode || '').replace(/_PLT$/, '')),
                nextStation: resolveStationCode(train.nextStationCode || ''),
                destination: resolveStationCode(train.destinationStationCode || ''),
                doorStatus: train.doorStatus,
                trainSpeed: train.trainSpeed,
                updatedTime: train.updatedTime ? new Date(train.updatedTime * 1000) : null,
                line: train.line || lineCode,
                carLoads: train.carLoads || null
            };
        });
    });
    return lookup;
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
        if (tt.indexOf('SP1900') !== -1) return 'SP';
        if (tt.indexOf('T1141A') !== -1) return 'C';
        return '';
    }
    // Default: KTL/TWL/ISL/TKL/SIL
    else {
        var typeStr = train.trainType;
        if (!typeStr) return '';
        return typeStr.charAt(0).toUpperCase();
    }
}

// Update existing ETA rows with enrichment data (train type badge + door status)
function updateTrainEnrichment() {
    var lookup = getTrainInfoByTd();
    var rows = document.querySelectorAll('.eta-row');
    rows.forEach(function (row) {
        var row1 = row.querySelector('.eta-row1');
        if (!row1) return;
        var tcEl = row1.querySelector('.train-code');
        if (!tcEl) return;
        var td = tcEl.getAttribute('data-td');
        if (!td) return;

        // Determine current row's line from its parent .line-section
        var section = row.closest('.line-section');
        var rowLine = section ? section.getAttribute('data-line') : null;
        var key = rowLine ? rowLine + '_' + td : null;
        var info = key ? lookup[key] : null;

        // Update or create train-type badge
        var typeEl = row1.querySelector('.train-type-badge');
        if (info && info.trainType) {
            if (!typeEl) {
                typeEl = document.createElement('span');
                typeEl.className = 'train-type-badge';
                tcEl.parentNode.insertBefore(typeEl, tcEl);
            }
            typeEl.textContent = info.trainType;
            typeEl.className = 'train-type-badge train-type-' + info.trainType.toLowerCase();
        } else if (typeEl) {
            typeEl.textContent = '';
            typeEl.className = 'train-type-badge';
        }

        // Update door status indicator in row1 — place to the left of eta-time element
        var doorEl = row1.querySelector('.door-status');
        var timeEl = row1.querySelector('.eta-time');
        if (info && info.doorStatus === true) {
            if (!doorEl) {
                doorEl = document.createElement('span');
                doorEl.className = 'door-status door-open';
                doorEl.title = '車門已開';
                if (timeEl) timeEl.parentNode.insertBefore(doorEl, timeEl);
            }
            doorEl.classList.add('door-open');
            doorEl.classList.remove('door-closed');
        } else if (info && info.doorStatus === false) {
            if (!doorEl) {
                doorEl = document.createElement('span');
                doorEl.className = 'door-status door-closed';
                doorEl.title = '車門已關';
                if (timeEl) timeEl.parentNode.insertBefore(doorEl, timeEl);
            }
            doorEl.classList.remove('door-open');
            doorEl.classList.add('door-closed');
        } else if (doorEl) {
            doorEl.remove();
        }

        // If row2 is expanded, refresh its content
        var row2 = row.querySelector('.eta-row2');
        if (row2 && !row2.classList.contains('hidden')) {
            populateRow2(row2);
        }
    });
}

// ============================================
// Process & Render ETA Data
// ============================================
function processETAData(data) {
    // Update last update time
    var timeSource = data.gen_time || data.sys_time;
    if (timeSource) {
        const t = new Date(timeSource);
        lastUpdateTime = t;
        const hh = String(t.getHours()).padStart(2, "0");
        const mm = String(t.getMinutes()).padStart(2, "0");
        const ss = String(t.getSeconds()).padStart(2, "0");
        document.getElementById("last-update-time").textContent = hh + ":" + mm + ":" + ss;
    }

    if (!data.line) {
        document.getElementById("eta-container").innerHTML =
            '<div style="padding:20px;text-align:center;">沒有列車資料</div>';
        return;
    }

    // Collect all trains grouped by line then platform
    const lineGroups = {};

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
                // Filter out -1 min trains
                if (ttntNum < 0) return;

                lineGroups[mappedLine].push({
                    line: mappedLine,
                    platform: parseInt(platformNum, 10),
                    destination: train.destination || train.dest || "",
                    ttnt: ttnt,
                    tta: train.tta,
                    ttd: train.ttd,
                    td: train.td || ""
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
        var platformGroups = null;
        if (typeof platformGroup !== "undefined" && platformGroup[currentStationCode]) {
            platformGroups = platformGroup[currentStationCode];
        }

        if (platformGroups) {
            // Group trains by platform group, sort by ttnt then platform
            var groupedTrains = [];
            var ungrouped = [];

            trains.forEach(function (train) {
                var assigned = false;
                for (var gi = 0; gi < platformGroups.length; gi++) {
                    if (platformGroups[gi].indexOf(train.platform) !== -1) {
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

            renderTrainsForLine(sortedTrains, lineCode, platformGroups);
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

        var prevPlatform = null;
        var rowIndex = 1;
        limitedTrains.forEach(function (train) {
            // Platform separator: skip if platforms are in same group
            if (prevPlatform !== null && train.platform !== prevPlatform) {
                var sameGroup = false;
                if (platformGroups) {
                    for (var gi = 0; gi < platformGroups.length; gi++) {
                        if (platformGroups[gi].indexOf(prevPlatform) !== -1 && platformGroups[gi].indexOf(train.platform) !== -1) {
                            sameGroup = true;
                            break;
                        }
                    }
                }
                if (!sameGroup) {
                    html += '<div class="platform-separator"></div>';
                    rowIndex = 1; // reset row index after separator for consistent striping
                }
            }
            prevPlatform = train.platform;

            var destCode = train.destination;
            var destChi, isNoop = false;
            var isUnknownDest = false;

            if (destCode && destCode.indexOf("NO_") === 0) {
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

            var timeDisplay = formatTrainTime(train, isNoop || isUnknownDest);
            var isOpenDataLine = (getLineMode(lineCode) === 'D');
            var tdHtml = isOpenDataLine ? '' : renderTrainCode(train.td, lineCode);
            var rowClass = (rowIndex % 2 === 0) ? 'eta-row-even' : 'eta-row-odd';
            var isDark = document.body.classList.contains('dark-mode');
            var evenBg = isDark ? darkenColor(colour, 0.80) : lightenColor(colour, 0.80);
            var rowStyle = (rowIndex % 2 === 0) ? ' style="background-color:' + evenBg + '"' : '';

            html += '<div class="eta-row ' + rowClass + '"' + rowStyle + ' data-td="' + (train.td || '') + '" data-line="' + lineCode + '">';
            html += '<div class="eta-row1" onclick="toggleRow2(this)">';
            html += '<div class="eta-dest">';
            html += '<span class="eta-dest-chi' + (isNoop || isUnknownDest ? ' eta-dest-noop' : '') + '">' + destChi + '</span>';
            html += '</div>';
            html += tdHtml;
            html += '<div class="eta-platform-badge" style="background-color:' + colour + '">' + train.platform + '</div>';
            html += '<div class="eta-time' + (isNoop || isUnknownDest ? ' eta-time-muted' : '') + '">' + timeDisplay + '</div>';
            html += '</div>';
            html += '<div class="eta-row2 hidden"></div>';
            html += '</div>';
            rowIndex++;
        });

        html += '</div>';
    }

    if (!html) {
        html = '<div style="padding:20px;text-align:center;">沒有列車資料</div>';
    }

    document.getElementById("eta-container").innerHTML = html;

    // Re-apply line filter if active
    if (activeLineFilter) {
        filterByLine(activeLineFilter);
    }

    // Start countdown timers for ttnt=1
    startCountdownTimers();

    // Re-apply train enrichment from cached line API data
    updateTrainEnrichment();
}

// ============================================
// Toggle row2 (expand/collapse train detail)
// ============================================
function toggleRow2(row1El) {
    var row2 = row1El.nextElementSibling;
    if (!row2 || !row2.classList.contains('eta-row2')) return;
    var isHidden = row2.classList.contains('hidden');
    if (isHidden) {
        row2.classList.remove('hidden');
        row1El.classList.add('eta-row1-expanded');
        populateRow2(row2);
    } else {
        row2.classList.add('hidden');
        row1El.classList.remove('eta-row1-expanded');
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
    var info = lookup[key];

    if (!info || !info.carLoads || !info.carLoads.length) {
        // Show door status only if available
        if (info && info.doorStatus !== undefined && info.doorStatus !== null) {
            var doorClass = info.doorStatus ? 'door-badge-open' : 'door-badge-closed';
            var doorText = info.doorStatus ? 'Door Opened' : 'Door Closed';
            row2El.innerHTML = '<span class="door-badge ' + doorClass + '">' + doorText + '</span>';
        } else {
            row2El.innerHTML = '<span class="row2-no-data">沒有列車資料</span>';
        }
        return;
    }

    var html = '<div class="trainload-cars">';
    info.carLoads.forEach(function (car) {
        var pCount = car.passengerCount || 0;
        var colorMap = { 0: '#ffffff', 1: '#4CAF50', 2: '#FFC107', 3: '#F44336' };
        var bgColor = colorMap[pCount] || '#ffffff';
        var textColor = (pCount === 0 || pCount === 2) ? '#333' : '#fff';
        html += '<div class="car-rect" style="background-color:' + bgColor + ';color:' + textColor + '">';
        html += '<span class="car-load-val">' + (car.passengerLoad !== undefined ? car.passengerLoad : '') + '</span>';
        html += '</div>';
    });
    html += '</div>';

    // Door status badge
    if (info.doorStatus !== undefined && info.doorStatus !== null) {
        var doorClass = info.doorStatus ? 'door-badge-open' : 'door-badge-closed';
        var doorText = info.doorStatus ? 'Door Opened' : 'Door Closed';
        html += '<span class="door-badge ' + doorClass + '">' + doorText + '</span>';
    }

    row2El.innerHTML = html;
}

// ============================================
// Helper: Resolve alternative station codes
// ============================================
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
function formatTrainTime(train, isMuted) {
    var val = train.ttnt;
    var mutedClass = isMuted ? ' eta-time-muted-text' : '';
    // Check if departing (0)
    if (val === 0 || val === "0") {
        // If current time - last update time > 30s, show 已離站
        if (lastUpdateTime) {
            var elapsed = new Date() - lastUpdateTime;
            if (elapsed > 30000) {
                return '<span class="eta-time-departing' + mutedClass + '">已離站</span>';
            }
        }
        return '<span class="eta-time-departing' + mutedClass + '">已到站</span>';
    }
    // Check if arriving (1) - show countdown
    if (val === 1 || val === "1") {
        return '<span class="eta-time-countdown' + mutedClass + '" data-countdown="1">0:59</span>';
    }
    // Otherwise show minutes
    var mins = parseInt(val, 10);
    if (isNaN(mins)) {
        return '<span class="eta-time-departing' + mutedClass + '">' + escapeHtml(String(val)) + '</span>';
    }
    return '<span class="eta-time-value' + mutedClass + '">' + mins + '</span><span class="eta-time-unit' + mutedClass + '"> min</span>';
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

function renderTrainCode(td, lineCode) {
    if (!td) return '<div class="train-code" data-td=""></div>';
    var nums = td.replace(/[^0-9]/g, '');
    while (nums.length < 3) nums = '0' + nums;
    nums = nums.slice(-3);
    // Look up train info for type badge (line-specific only)
    var lookup = getTrainInfoByTd();
    var key = lineCode ? lineCode + '_' + nums : null;
    var info = key ? lookup[key] : null;
    var typeBadge = '';
    if (info && info.trainType) {
        typeBadge = '<span class="train-type-badge train-type-' + info.trainType.toLowerCase() + '">' + info.trainType + '</span>';
    }
    var html = typeBadge + '<div class="train-code" data-td="' + nums + '">';
    for (var i = 0; i < 3; i++) {
        html += make7SegDigit(nums[i]);
    }
    html += '</div>';
    return html;
}

// ============================================
// Helper: Lighten a hex colour by a percentage
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
    if (!lastUpdateTime) return;
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
