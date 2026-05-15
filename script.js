/* ============================================
   MTR ETA Web App - script.js
   地下鐵到站時間關注組
   ============================================ */

const APP_VERSION = "v0.03";
const API_URL = "https://408tq84duh.execute-api.ap-east-1.amazonaws.com/api/service/GetNextTrainData";
const MAX_TRAINS_PER_GROUP = 4;

// ============================================
// Data stores — defined in data.js
// ============================================
// stationsData, linesData, HOME_STATION are declared in data.js (loaded before this file)

// Lookup maps built after loading
let stationByCode = {};   // station_code -> station object
let lineByCode = {};      // line_code -> line object

// State
let currentStationCode = null;
let refreshTimer = null;
let clockTimer = null;
let activeLineFilter = null; // null = show all

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
    } else if (typeof HOME_STATION !== "undefined" && stationByCode[HOME_STATION]) {
        selectStation(HOME_STATION);
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
            fetchETA(currentStationCode);
        }
    });

    // Clear button
    document.getElementById("btn-clear-search").addEventListener("click", function () {
        document.getElementById("station-search").value = "";
        document.getElementById("station-search").focus();
        openStationList();
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
    // Sort by station_code ascending
    const sorted = stationsData.slice().sort(function (a, b) {
        return a.station_code.localeCompare(b.station_code);
    });
    let html = "";
    sorted.forEach(function (s) {
        html +=
            '<div class="station-item" data-code="' + s.station_code + '" onclick="selectStation(\'' + s.station_code + '\')">' +
            '<span class="station-colour-dot" style="background-color:' + s.station_colour + ';color:' + (s.station_font_colour || '#fff') + '">' + s.station_code + '</span>' + ' ' + 
            '<span class="station-item-chi">' + s.name_chi + '</span>' +
            '<span class="station-item-eng">' + s.name_eng + '</span>' +
            '</div>';
    });
    listEl.innerHTML = html;
}

function openStationList() {
    var input = document.getElementById("station-search");
    input.select();
    document.getElementById("station-dropdown").classList.remove("hidden");
    // Show all items unfiltered when opening
    var items = document.querySelectorAll(".station-item");
    items.forEach(function (el) { el.style.display = ""; });
}

function closeStationList() {
    document.getElementById("station-dropdown").classList.add("hidden");
}

function filterStationList() {
    const keyword = document.getElementById("station-search").value.trim().toLowerCase();
    const items = document.querySelectorAll(".station-item");
    items.forEach(function (el) {
        const code = el.getAttribute("data-code").toLowerCase();
        const text = el.textContent.toLowerCase();
        if (!keyword || code.indexOf(keyword) !== -1 || text.indexOf(keyword) !== -1) {
            el.style.display = "";
        } else {
            el.style.display = "none";
        }
    });
}

function selectStation(code) {
    currentStationCode = code;
    const station = stationByCode[code];
    if (station) {
        document.getElementById("station-search").value =
            code + " - " + station.name_chi + " " + station.name_eng;
    }
    closeStationList();
    showStationInfoBar(code);
    fetchETA(code);
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

    // Line filter badges (second row)
    activeLineFilter = null;
    //document.getElementById("btn-show-all").classList.add("hidden");
    let badgesHtml = "";
    station.lines.forEach(function (lineCode) {
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
        const hh = String(t.getHours()).padStart(2, "0");
        const mm = String(t.getMinutes()).padStart(2, "0");
        const ss = String(t.getSeconds()).padStart(2, "0");
        document.getElementById("last-update-time").textContent = hh + ":" + mm + ":" + ss;
    }

    if (!data.line) {
        document.getElementById("eta-container").innerHTML =
            '<div style="padding:20px;color:#fff;text-align:center;">沒有列車資料</div>';
        return;
    }

    // Collect all trains grouped by line then platform
    // Structure: { lineCode: [ { platform, destination, ttnt, tta, ttd, td, ... } ] }
    const lineGroups = {};

    Object.keys(data.line).forEach(function (lineCode) {
        // Map legacy line codes
        const mappedLine = mapLineCode(lineCode);
        if (!lineByCode[mappedLine]) return; // skip unknown

        if (!lineGroups[mappedLine]) {
            lineGroups[mappedLine] = [];
        }

        const platforms = data.line[lineCode];
        Object.keys(platforms).forEach(function (platformNum) {
            const trains = platforms[platformNum];
            if (!Array.isArray(trains)) return;
            trains.forEach(function (train) {
                lineGroups[mappedLine].push({
                    line: mappedLine,
                    platform: parseInt(platformNum, 10),
                    destination: train.destination || train.dest || "",
                    ttnt: train.ttnt,
                    tta: train.tta,
                    ttd: train.ttd,
                    td: train.td || ""
                });
            });
        });
    });

    // Sort lines alphabetically, then trains within each line by platform, then by time
    const sortedLineKeys = Object.keys(lineGroups).sort();

    let html = "";

    sortedLineKeys.forEach(function (lineCode) {
        const trains = lineGroups[lineCode];

        // Sort by platform ascending, then by time (ttnt)
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

        // Line colour bar
        const colour = getLineColour(lineCode);
        const lineInfo = lineByCode[lineCode];
        const lineChi = lineInfo ? lineInfo.name_chi : lineCode;
        const lineEng = lineInfo ? lineInfo.name_eng : "";

        html += '<div class="line-section" data-line="' + lineCode + '">';
        html += '<div class="line-bar" style="background-color:' + colour + '">';
        html += '<span class="line-bar-chi">' + lineChi + '</span>';
        html += '<span class="line-bar-eng">' + lineEng + '</span>';
        html += '</div>';

        // Render each train
        var prevPlatform = null;
        var rowIndex = 1;
        limitedTrains.forEach(function (train) {
            // Platform separator
            if (prevPlatform !== null && train.platform !== prevPlatform) {
                html += '<div class="platform-separator"></div>';
            }
            prevPlatform = train.platform;

            var destCode = train.destination;
            var destChi, isNoop = false;
            if (destCode && destCode.indexOf("NO_") === 0) {
                destChi = "不 載 客 列 車";
                isNoop = true;
            } else {
                var dest = stationByCode[destCode];
                destChi = dest ? dest.name_chi : destCode;
            }
            var timeDisplay = formatTrainTime(train);
            var tdHtml = renderTrainCode(train.td);
            var rowClass = (rowIndex % 2 === 0) ? 'eta-row-even' : 'eta-row-odd';

            html += '<div class="eta-row ' + rowClass + '">';
            html += '<div class="eta-dest">';
            html += '<span class="eta-dest-chi' + (isNoop ? ' eta-dest-noop' : '') + '">' + destChi + '</span>';
            html += '</div>';
            html += tdHtml;
            html += '<div class="eta-platform-badge" style="background-color:' + colour + '">' + train.platform + '</div>';
            html += '<div class="eta-time">' + timeDisplay + '</div>';
            html += '</div>';
            rowIndex++;
        });

        html += '</div>'; // close .line-section
    });

    if (!html) {
        html = '<div style="padding:20px;color:#fff;text-align:center;">沒有列車資料</div>';
    }

    document.getElementById("eta-container").innerHTML = html;

    // Re-apply line filter if active
    if (activeLineFilter) {
        filterByLine(activeLineFilter);
    }
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
function formatTrainTime(train) {
    var val = train.ttnt;
    // Check if departing (0)
    if (val === 0 || val === "0") {
        return '<span class="eta-time-departing">已到站</span>';
    }
    // Check if arriving (1)
    //if (val === 1 || val === "1") {
    //    return '<span class="eta-time-departing">Arriving</span>';
    //}
    // Otherwise show minutes
    var mins = parseInt(val, 10);
    if (isNaN(mins)) {
        return '<span class="eta-time-departing">' + escapeHtml(String(val)) + '</span>';
    }
    return '<span class="eta-time-value">' + mins + '</span><span class="eta-time-unit"> min</span>';
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
