/* ============================================
   Train information table
   ============================================ */

(function () {
    'use strict';

    var activeLineCode = null;
    var overlay = null;
    var tableBody = null;
    var title = null;
    var refreshButton = null;
    var mapButton = null;
    var etaContainerObserver = null;
    var tableLoading = false;

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function stationName(code) {
        var resolvedCode = resolveStationCode(code || '');
        var station = stationByCode[resolvedCode];
        return station ? station.name_chi : (resolvedCode || '');
    }

    function resolveTrainStation(lineCode, code) {
        if (!code || code === 'NA' || code === '-') return '';
        var map = typeof stationCodeMap !== 'undefined' ? stationCodeMap[lineCode] : null;
        var mappedCode = map && map[code] ? map[code] : code;
        return stationName(mappedCode);
    }

    function getMappedTrainStationCode(lineCode, code) {
        return getMappedLineStationCode(lineCode, code);
    }

    function getTrainDirection(train, lineCode) {
        var currentCode = getMappedTrainStationCode(lineCode, train.currentStationCode);
        var nextCode = getMappedTrainStationCode(lineCode, train.nextStationCode);
        if (!currentCode || !nextCode || currentCode === nextCode) return null;

        // TML already provides a normalized direction flag.
        if (train.isUpline === true || train.isUpline === false) {
            return train.isUpline ? 'up' : 'down';
        }

        // For the other line APIs, moving toward a later station in linesData
        // is the down-line direction.
        var line = lineByCode[lineCode];
        if (!line || !Array.isArray(line.stations)) return null;
        var currentIndex = line.stations.indexOf(currentCode);
        var nextIndex = line.stations.indexOf(nextCode);
        if (currentIndex === -1 || nextIndex === -1) return null;
        return nextIndex > currentIndex ? 'down' : 'up';
    }

    function getLocation(train, lineCode) {
        var current = resolveTrainStation(lineCode, train.currentStationCode);
        var next = resolveTrainStation(lineCode, train.nextStationCode);
        if (!current && !next) return null;
        var direction = getTrainDirection(train, lineCode);

        var isStopped = train.doorStatus === true ||
            (lineCode === 'EAL' && (train.startDistance === 0 || train.startDistance === '0')) ||
            (train.currentStationCode && train.nextStationCode &&
                resolveStationCode(train.currentStationCode) === resolveStationCode(train.nextStationCode));

        var progress = null;
        if (lineCode === 'EAL' && !isStopped) {
            var startDistance = parseFloat(train.startDistance);
            var targetDistance = parseFloat(train.targetDistance);
            if (!isNaN(startDistance) && !isNaN(targetDistance) &&
                startDistance >= 0 && targetDistance >= 0 && startDistance + targetDistance > 0) {
                var speed = parseFloat(train.trainSpeed);
                var updatedTime = parseFloat(train.updatedTime);
                if (!isNaN(speed) && speed > 0 && !isNaN(updatedTime)) {
                    var elapsedSeconds = Math.max(0, (Date.now() - updatedTime * 1000) / 1000);
                    startDistance = Math.min(startDistance + Math.floor(elapsedSeconds * speed * 1000 / 3600), startDistance + targetDistance);
                }
                progress = (startDistance / (startDistance + targetDistance)) * 100;
            }
        }

        return {
            current: current,
            next: next,
            isStopped: isStopped,
            isDownLine: direction === 'down',
            progress: progress,
            text: isStopped ? (current || next) + ' (停站中)' : (current && next ? current + ' > ' + next : (current || '> ' + next))
        };
    }

    function renderLocationArrow() {
        var isMoving = typeof nextStationVizArrowMode === 'undefined' || nextStationVizArrowMode;
        if (!isMoving) {
            return '<div class="row2-viz-line-arrow" style="--arrow-pct:50%">' + arrowSvg + '</div>';
        }

        return '<div class="row2-viz-arrow-marquee" style="--arrow-pct:50%">' +
            '<div class="row2-viz-line-arrow row2-viz-arrow-move row2-viz-arrow-move-primary" style="--arrow-pct:50%">' + arrowSvg + '</div>' +
            '<div class="row2-viz-line-arrow row2-viz-arrow-move row2-viz-arrow-move-secondary" style="--arrow-pct:50%">' + arrowSvg + '</div>' +
            '</div>';
    }

    function renderLocation(train, lineCode) {
        var location = getLocation(train, lineCode);
        if (!location) return '<span class="train-table-location-unavailable">沒有列車位置資料</span>';

        var colour = typeof getLineColour === 'function' ? getLineColour(lineCode) : '';
        var directionClass = location.isDownLine ? ' row2-viz-direction-reverse' : '';
        var speed = parseFloat(train.trainSpeed);
        var speedHtml = '';
        if (!isNaN(speed) && speed > 0 && !location.isStopped) {
            speedHtml = '<span class="row2-viz-speed">' + speed + ' km/h</span>';
        }
        if (location.isStopped) {
            return '<div class="row2-viz train-table-viz' + directionClass + '" title="' + escapeHtml(location.text) + '">' +
                '<div class="row2-viz-group">' +
                    '<div class="row2-viz-line" style="background-color:' + escapeHtml(colour) + '"></div>' +
                    '<div class="row2-viz-dot row2-viz-dot-center"></div>' +
                '</div>' +
                '<span class="row2-viz-label row2-viz-label-center">' + escapeHtml(location.current || location.next) + ' (停站中)</span>' +
                '</div>';
        }
        var trainIcon = '';
        if (location.progress !== null && isFinite(location.progress)) {
            var trainProgress = location.isDownLine ? 100 - location.progress : location.progress;
            trainIcon = '<div class="row2-viz-train" style="--train-pct:' + trainProgress + ';color:' + escapeHtml(colour) + '">' + trainSvg + '</div>';
        }
        var leftDotClass = location.isDownLine ? 'row2-viz-dot row2-viz-dot-left row2-viz-dot-flash' : 'row2-viz-dot row2-viz-dot-left';
        var rightDotClass = location.isDownLine ? 'row2-viz-dot row2-viz-dot-right' : 'row2-viz-dot row2-viz-dot-right row2-viz-dot-flash';
        var leftLabel = location.isDownLine ? location.next : location.current;
        var rightLabel = location.isDownLine ? location.current : location.next;
        return '<div class="row2-viz train-table-viz' + directionClass + '" title="' + escapeHtml(location.text) + '">' +
            '<div class="row2-viz-group">' +
                '<div class="row2-viz-line" style="background-color:' + escapeHtml(colour) + '"></div>' +
                '<div class="' + leftDotClass + '"></div>' +
                '<div class="' + rightDotClass + '"></div>' +
                trainIcon +
                renderLocationArrow() +
                speedHtml +
            '</div>' +
            '<span class="row2-viz-label row2-viz-label-left">' + escapeHtml(leftLabel || '—') + '</span>' +
            '<span class="row2-viz-label row2-viz-label-right">' + escapeHtml(rightLabel || '—') + '</span>' +
            '</div>';
    }

    function renderDestinationBadge(train, lineCode) {
        var destinationCode = train.destinationStationCode || '';
        var map = typeof stationCodeMap !== 'undefined' ? stationCodeMap[lineCode] : null;
        var mappedCode = map && map[destinationCode] ? map[destinationCode] : destinationCode;
        var station = stationByCode[resolveStationCode(mappedCode)];
        if (!station) return '<span class="train-table-destination-badge">' + escapeHtml(stationName(mappedCode) || '—') + '</span>';

        return '<span class="train-table-destination-badge" style="background-color:' + escapeHtml(station.station_colour || '') + ';color:' + escapeHtml(station.station_font_colour || '') + '">' +
            escapeHtml(station.name_chi) +
            '</span>';
    }

    function updateTitle() {
        var line = lineByCode[activeLineCode];
        title.textContent = (line ? line.name_chi : activeLineCode || '') + ' 列車資訊';
    }

    function getNormalizedTrainTd(train, lineCode) {
        return getNormalizedTrainloadTd(train, lineCode);
    }

    function compareTrainsByTd(a, b) {
        var aTd = getNormalizedTrainTd(a, activeLineCode);
        var bTd = getNormalizedTrainTd(b, activeLineCode);
        var aNumber = getTrainTdFirstNumber(aTd);
        var bNumber = getTrainTdFirstNumber(bTd);

        if (aNumber === null && bNumber !== null) return 1;
        if (aNumber !== null && bNumber === null) return -1;
        if (aNumber === null && bNumber === null) return String(aTd).localeCompare(String(bTd));
        if (aNumber !== bNumber) return aNumber - bNumber;
        return String(aTd).localeCompare(String(bTd));
    }

    function renderTable() {
        if (!tableBody || !activeLineCode) return;
        updateTitle();

        if (tableLoading) {
            if (tableBody.children.length > 0) return;
            tableBody.innerHTML = '<tr><td class="train-table-loading-message" colspan="3">載入中...</td></tr>';
            return;
        }

        var html = '';

        getVisibleLineTrainloadRecords(activeLineCode).sort(compareTrainsByTd).forEach(function (train) {
            var td = String(train.td || '');
            var normalizedTd = getNormalizedTrainTd(train, activeLineCode);
            // renderTrainCode() uses the same normalized TD and ISL suffix
            // fallback as the main ETA rows.
            html += '<tr>' +
                '<td class="train-table-code-cell">' +
                    '<div class="train-table-code">' + renderTrainCode(normalizedTd, activeLineCode) + '</div>' +
                    '<div class="train-table-consist">' + escapeHtml(getTrainIdConsistText(train, activeLineCode, td)) + '</div>' +
                '</td>' +
                '<td>' + renderLocation(train, activeLineCode) + '</td>' +
                '<td class="train-table-destination-cell">' + renderDestinationBadge(train, activeLineCode) + '</td>' +
                '</tr>';
        });

            tableBody.innerHTML = html || '<tr><td class="train-table-empty" colspan="3">沒有列車資料</td></tr>';
    }

    function finishTableLoad(lineCode, success) {
        if (activeLineCode !== lineCode) return;
        tableLoading = false;
        overlay.classList.remove('train-table-loading');
        renderTable();
    }

    function loadTableData(lineCode) {
        if (activeLineCode !== lineCode) return Promise.resolve(false);
        tableLoading = true;
        overlay.classList.add('train-table-loading');
        renderTable();

        return new Promise(function (resolve) {
            if (typeof refreshTrainTableLine !== 'function') {
                finishTableLoad(lineCode, false);
                resolve(false);
                return;
            }

            refreshTrainTableLine(lineCode, function (success) {
                finishTableLoad(lineCode, success);
                resolve(success);
            });
        });
    }

    function openTable(lineCode) {
        var lineChanged = activeLineCode !== lineCode;
        activeLineCode = lineCode;
        if (lineChanged && tableBody) tableBody.innerHTML = '';
        overlay.classList.remove('hidden');
        if (lineChanged && refreshButton && refreshButton.disabled) {
            loadTableData(lineCode);
            return;
        }
        refreshButtonWithTimeout(refreshButton, function () {
            return loadTableData(lineCode);
        });
    }

    function closeTable() {
        overlay.classList.add('hidden');
        overlay.classList.remove('train-table-loading');
        tableLoading = false;
        activeLineCode = null;
    }

    function refreshTableData() {
        if (!activeLineCode || !refreshButton || refreshButton.disabled) return;

        var lineCode = activeLineCode;
        refreshButtonWithTimeout(refreshButton, function () {
            return loadTableData(lineCode);
        });
    }

    function switchToLineMap() {
        var lineCode = activeLineCode;
        if (!lineCode) return;
        closeTable();
        if (typeof window.openLineMapForLine === 'function') {
            window.openLineMapForLine(lineCode);
        } else {
            document.dispatchEvent(new CustomEvent('line-map-open-request', {
                detail: { lineCode: lineCode }
            }));
        }
    }

    function addLineBarButtons() {
        document.querySelectorAll('.line-bar').forEach(function (lineBar) {
            addLineBarActionButton(
                lineBar,
                'train-table-open',
                '車序表',
                function (lineCode) { return 'Show ' + lineCode + ' train information table'; },
                openTable
            );
        });
    }

    function createWindow() {
        overlay = document.createElement('div');
        overlay.id = 'train-table-overlay';
        overlay.className = 'hidden';
        overlay.innerHTML =
            '<section id="train-table-window" role="dialog" aria-modal="true" aria-labelledby="train-table-title">' +
                '<header class="train-table-header">' +
                    '<span id="train-table-title" class="train-table-title"></span>' +
                    '<button type="button" class="train-table-switch modal-view-switch" aria-label="Show train position map">路線圖</button>' +
                    '<button type="button" class="btn-refresh train-table-refresh" aria-label="Refresh train information">F5</button>' +
                    '<button type="button" class="train-table-close" aria-label="Close train information">&times;</button>' +
                '</header>' +
                '<div class="train-table-scroll"><table class="train-table">' +
                    '<tbody></tbody>' +
                '</table></div>' +
            '</section>';
        document.body.appendChild(overlay);

        tableBody = overlay.querySelector('tbody');
        title = overlay.querySelector('#train-table-title');
        refreshButton = overlay.querySelector('.train-table-refresh');
        mapButton = overlay.querySelector('.train-table-switch');
        overlay.querySelector('.train-table-close').addEventListener('click', closeTable);
        refreshButton.addEventListener('click', refreshTableData);
        mapButton.addEventListener('click', switchToLineMap);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeTable();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !overlay.classList.contains('hidden')) closeTable();
        });
    }

    function observeEtaContainer() {
        var etaContainer = document.getElementById('eta-container');
        if (!etaContainer || !window.MutationObserver) return;
        etaContainerObserver = new MutationObserver(function () {
            addLineBarButtons();
            if (activeLineCode && !overlay.classList.contains('hidden')) renderTable();
        });
        etaContainerObserver.observe(etaContainer, { childList: true });
    }

    document.addEventListener('DOMContentLoaded', function () {
        createWindow();
        window.openTrainTableForLine = openTable;
        addLineBarButtons();
        observeEtaContainer();
        document.addEventListener('train-table-open-request', function (event) {
            var requestedLineCode = event.detail && event.detail.lineCode;
            if (requestedLineCode) openTable(requestedLineCode);
        });
        document.addEventListener('train-table-viz-settings-changed', function () {
            if (activeLineCode && !overlay.classList.contains('hidden')) renderTable();
        });
    });
}());