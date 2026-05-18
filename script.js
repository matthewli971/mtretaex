/* ============================================
   MTR ETA Web App - script.js
   地下鐵到站時間關注組
   ============================================ */

const APP_VERSION = "v0.05";
const API_URL = "https://408tq84duh.execute-api.ap-east-1.amazonaws.com/api/service/GetNextTrainData";
const MAX_TRAINS_PER_GROUP = 4;
const STORAGE_KEY_STATION = "mtreta_last_station";
const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

// ============================================
// Data stores — defined in data.js
// ============================================
// stationsData, linesData, HOME_STATION, PLATFORM_GROUP are declared in data.js

// Lookup maps built after loading
let stationByCode = {};   // station_code -> station object
let lineByCode = {};      // line_code -> line object

// State
let currentStationCode = null;
let refreshTimer = null;
let autoRefreshTimer = null;
let clockTimer = null;
let activeLineFilter = null; // null = show all
let lastUpdateTime = null;   // Date object of last API gen_time
let countdownTimer = null;

// ============================================
// Initialisation
// ============================================
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("app-version").textContent = APP_VERSION;
    startClock();
    setupEventListeners();
    loadStaticData();
    buildStationList();

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

    // Dark mode: apply saved preference (default: dark)
    var savedTheme = null;
    try { savedTheme = localStorage.getItem("mtreta_theme"); } catch(e) {}
    if (savedTheme === "light") {
        document.body.classList.remove("dark-mode");
    } else {
        document.body.classList.add("dark-mode");
    }
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
        hh + ":" + mm + '<span class="clock-sec">:' + ss + "</span>";
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

    // Dark mode toggle (button)
    document.getElementById("theme-toggle").addEventListener("click", function () {
        var isDark = document.body.classList.contains("dark-mode");
        if (isDark) {
            document.body.classList.remove("dark-mode");
            try { localStorage.setItem("mtreta_theme", "light"); } catch(e) {}
        } else {
            document.body.classList.add("dark-mode");
            try { localStorage.setItem("mtreta_theme", "dark"); } catch(e) {}
        }
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
    input.select();
    document.getElementById("station-dropdown").classList.remove("hidden");
    // Show all items and headers unfiltered when opening
    var items = document.querySelectorAll(".station-item");
    items.forEach(function (el) { el.style.display = ""; });
    var headers = document.querySelectorAll(".station-list-header");
    headers.forEach(function (el) { el.style.display = ""; });
}

function closeStationList() {
    document.getElementById("station-dropdown").classList.add("hidden");
}

function filterStationList() {
    const keyword = document.getElementById("station-search").value.trim().toLowerCase();
    // Ensure dropdown is open when typing
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
        document.getElementById("station-search").value =
            code + " - " + station.name_chi + " " + station.name_eng;

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
    fetchETA(code);
    startAutoRefresh();
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
function fetchETA(stationCode) {
    showLoader();
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            hideLoader();
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    processETAData(data);
                } catch (e) {
                    console.error("Failed to parse ETA response:", e);
                    document.getElementById("eta-container").innerHTML =
                        '<div style="padding:20px;color:#fff;text-align:center;">無法解析數據</div>';
                }
            } else {
                console.error("API error:", xhr.status);
                document.getElementById("eta-container").innerHTML =
                    '<div style="padding:20px;color:#fff;text-align:center;">無法取得數據 (HTTP ' + xhr.status + ')</div>';
            }
        }
    };
    xhr.send(JSON.stringify({ stationcode: stationCode }));
}

// Silent AJAX fetch (no loader)
function fetchETASilent(stationCode) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    processETAData(data);
                } catch (e) {
                    console.error("Failed to parse ETA response:", e);
                }
            } else {
                console.error("API error:", xhr.status);
            }
        }
    };
    xhr.send(JSON.stringify({ stationcode: stationCode }));
}

function showLoader() {
    document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
    document.getElementById("loader").classList.add("hidden");
}

// ============================================
// Process & Render ETA Data
// ============================================
function processETAData(data) {
    // Update last update time
    if (data.gen_time) {
        const t = new Date(data.gen_time);
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

        // Check if PLATFORM_GROUP applies for this station
        var platformGroups = null;
        if (typeof PLATFORM_GROUP !== "undefined" && PLATFORM_GROUP[currentStationCode]) {
            platformGroups = PLATFORM_GROUP[currentStationCode];
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
                }
            }
            prevPlatform = train.platform;

            var destCode = train.destination;
            var destChi, isNoop = false;
            var isUnknownDest = false;

            if (destCode && destCode.indexOf("NO_") === 0) {
                destChi = "不 載 客 列 車";
                isNoop = true;
            } else if (currentStationCode && destCode === currentStationCode) {
                destChi = "不 載 客 列 車";
                isNoop = true;
            } else {
                var dest = stationByCode[destCode];
                if (dest) {
                    destChi = dest.name_chi;
                } else {
                    destChi = "回 廠 (" + destCode + ")";
                    isUnknownDest = true;
                }
            }

            var timeDisplay = formatTrainTime(train, isNoop || isUnknownDest);
            var tdHtml = renderTrainCode(train.td);
            var rowClass = (rowIndex % 2 === 0) ? 'eta-row-even' : 'eta-row-odd';
            var isDark = document.body.classList.contains('dark-mode');
            var evenBg = isDark ? darkenColor(colour, 0.80) : lightenColor(colour, 0.80);
            var rowStyle = (rowIndex % 2 === 0) ? ' style="background-color:' + evenBg + '"' : '';

            html += '<div class="eta-row ' + rowClass + '"' + rowStyle + '>';
            html += '<div class="eta-dest">';
            html += '<span class="eta-dest-chi' + (isNoop || isUnknownDest ? ' eta-dest-noop' : '') + '">' + destChi + '</span>';
            html += '</div>';
            html += tdHtml;
            html += '<div class="eta-platform-badge" style="background-color:' + colour + '">' + train.platform + '</div>';
            html += '<div class="eta-time' + (isNoop || isUnknownDest ? ' eta-time-muted' : '') + '">' + timeDisplay + '</div>';
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
    var offColor = '#333333';
    var paths = [
        'M1.8,0 L10.2,0 L8.8,1.5 L3.2,1.5 Z', // Top
        'M10.5,0.3 L10.5,8.6 L9,7.8 L9,1.8 Z', // Upper Right
        'M10.5,9.4 L10.5,17.7 L9,16.2 L9,10.2 Z', // Lower Right
        'M1.8,18 L10.2,18 L8.8,16.5 L3.2,16.5 Z', // Bottom
        'M1.5,9.4 L1.5,17.7 L3,16.2 L3,10.2 Z', // Lower Left
        'M1.5,0.3 L1.5,8.6 L3,7.8 L3,1.8 Z', // Upper Left
        'M1.6,9 L3.1,8.3 L8.9,8.3 L10.3,9 L8.9,9.8 L3.1,9.8 Z' // Middle
    ];
    var svg = '<svg viewBox="0 0 12 18" class="seven-seg-digit">';
    for (var i = 0; i < 7; i++) {
        svg += '<path d="' + paths[i] + '" fill="' + (s[i] ? onColor : offColor) + '"/>';
    }
    svg += '</svg>';
    return svg;
}

function renderTrainCode(td) {
    if (!td) return '<div class="train-code"></div>';
    var nums = td.replace(/[^0-9]/g, '');
    while (nums.length < 3) nums = '0' + nums;
    nums = nums.slice(-3);
    var html = '<div class="train-code">';
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
