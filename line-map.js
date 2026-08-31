/* ============================================
   Train position line map
   ============================================ */

(function () {
    'use strict';

    var activeLineCode = null;
    var overlay = null;
    var title = null;
    var mapContent = null;
    var refreshButton = null;
    var mapPositionTimer = null;
    var etaContainerObserver = null;
    var mapLoading = false;

    var MAP_VIEWBOX_WIDTH = 1000;
    var MAP_TOP_PADDING = 46;
    var MAP_BOTTOM_PADDING = 52;
    var MAP_STATION_GAP = 124;
    var MAP_STATION_ROW_HEIGHT = 64;
    var MAP_MARKER_LANE_OFFSET = 10;
    var MAP_MARKER_WIDTH = 108;

    function makeEdgeKey(firstCode, secondCode) {
        return firstCode < secondCode
            ? firstCode + '|' + secondCode
            : secondCode + '|' + firstCode;
    }

    // Keep visual branch geometry separate from linesData.stations because the
    // latter is also used by the ETA direction and distance calculations.
    function getLineMapModel(lineCode) {
        var line = lineByCode[lineCode];
        if (!line || !Array.isArray(line.stations)) return null;

        var topology = typeof lineMapTopology !== 'undefined' ? lineMapTopology[lineCode] : null;
        var configuredPositions = topology && topology.positions ? topology.positions : {};
        var positions = {};
        var sourceOrder = {};

        line.stations.forEach(function (code, index) {
            sourceOrder[code] = index;
            var configured = configuredPositions[code] || {};
            var configuredX = Number(configured.x);
            var configuredY = Number(configured.y);
            positions[code] = {
                x: isFinite(configuredX) ? configuredX : 0,
                y: isFinite(configuredY) ? configuredY : index,
                labelSide: configured.labelSide === 'left' ? 'left' : 'right'
            };
        });

        // Permit map-only branch stations to be added without changing ETA
        // station order. This is intentionally additive to the source dataset.
        Object.keys(configuredPositions).forEach(function (code) {
            if (positions[code]) return;
            var configured = configuredPositions[code] || {};
            var x = Number(configured.x);
            var y = Number(configured.y);
            sourceOrder[code] = Object.keys(sourceOrder).length;
            positions[code] = {
                x: isFinite(x) ? x : 0,
                y: isFinite(y) ? y : sourceOrder[code],
                labelSide: configured.labelSide === 'left' ? 'left' : 'right'
            };
        });

        var paths = topology && Array.isArray(topology.paths) && topology.paths.length
            ? topology.paths
            : [line.stations];
        var edges = [];
        var edgeKeys = {};
        var adjacency = {};

        Object.keys(positions).forEach(function (code) {
            adjacency[code] = [];
        });

        paths.forEach(function (path) {
            if (!Array.isArray(path)) return;
            for (var index = 1; index < path.length; index++) {
                var firstCode = path[index - 1];
                var secondCode = path[index];
                if (!positions[firstCode] || !positions[secondCode] || firstCode === secondCode) continue;

                var edgeKey = makeEdgeKey(firstCode, secondCode);
                if (edgeKeys[edgeKey]) continue;
                edgeKeys[edgeKey] = true;
                edges.push([firstCode, secondCode]);
                adjacency[firstCode].push(secondCode);
                adjacency[secondCode].push(firstCode);
            }
        });

        var branchRoutes = topology && Array.isArray(topology.branchRoutes)
            ? topology.branchRoutes.filter(function (route) {
            return route && Array.isArray(route.stations) && route.stations.length >= 2;
            })
            : [];
        var branchEdgeKeys = {};
        branchRoutes.forEach(function (route) {
            for (var routeIndex = 1; routeIndex < route.stations.length; routeIndex++) {
                var routeFirst = route.stations[routeIndex - 1];
                var routeSecond = route.stations[routeIndex];
                if (positions[routeFirst] && positions[routeSecond]) {
                    branchEdgeKeys[makeEdgeKey(routeFirst, routeSecond)] = true;
                }
            }
        });

        var stationCodes = Object.keys(positions).sort(function (firstCode, secondCode) {
            var first = positions[firstCode];
            var second = positions[secondCode];
            if (first.y !== second.y) return first.y - second.y;
            if (first.x !== second.x) return first.x - second.x;
            return sourceOrder[firstCode] - sourceOrder[secondCode];
        });
        var maxY = 0;
        var maxAbsX = 0;
        stationCodes.forEach(function (code) {
            maxY = Math.max(maxY, positions[code].y);
            maxAbsX = Math.max(maxAbsX, Math.abs(positions[code].x));
        });

        var configuredLanePercent = topology ? Number(topology.lanePercent) : NaN;
        var lanePercent = isFinite(configuredLanePercent)
            ? configuredLanePercent
            : (maxAbsX ? Math.min(20, 20 / maxAbsX) : 0);
        return {
            line: line,
            positions: positions,
            stationCodes: stationCodes,
            edges: edges,
            branchRoutes: branchRoutes,
            branchEdgeKeys: branchEdgeKeys,
            edgeKeys: edgeKeys,
            adjacency: adjacency,
            lanePercent: lanePercent,
            laneSvg: MAP_VIEWBOX_WIDTH * lanePercent / 100,
            height: Math.max(180, MAP_TOP_PADDING + maxY * MAP_STATION_GAP + MAP_BOTTOM_PADDING)
        };
    }

    function getMapPoint(model, code) {
        var position = model.positions[code];
        if (!position) return null;
        return {
            left: 50 + position.x * model.lanePercent,
            y: MAP_TOP_PADDING + position.y * MAP_STATION_GAP,
            svgX: MAP_VIEWBOX_WIDTH / 2 + position.x * model.laneSvg,
            svgY: MAP_TOP_PADDING + position.y * MAP_STATION_GAP
        };
    }

    function hasConnection(model, firstCode, secondCode) {
        return !!model.edgeKeys[makeEdgeKey(firstCode, secondCode)];
    }

    function getBranchRouteForSegment(model, firstCode, secondCode) {
        var edgeKey = makeEdgeKey(firstCode, secondCode);
        for (var index = 0; index < model.branchRoutes.length; index++) {
            var route = model.branchRoutes[index];
            for (var stationIndex = 1; stationIndex < route.stations.length; stationIndex++) {
                if (makeEdgeKey(route.stations[stationIndex - 1], route.stations[stationIndex]) === edgeKey) {
                    return route;
                }
            }
        }
        return null;
    }

    function getBranchSegmentPoint(model, route, firstCode, secondCode, progress) {
        var firstIndex = route.stations.indexOf(firstCode);
        var secondIndex = route.stations.indexOf(secondCode);
        if (firstIndex === -1 || secondIndex === -1 || Math.abs(firstIndex - secondIndex) !== 1) return null;

        var firstPoint = getMapPoint(model, firstCode);
        var secondPoint = getMapPoint(model, secondCode);
        var branchPoint = getMapPoint(model, route.stations.length > 2 ? route.stations[1] : secondCode);
        if (!firstPoint || !secondPoint || !branchPoint) return null;

        return {
            left: branchPoint.left,
            y: firstPoint.y + (secondPoint.y - firstPoint.y) * progress
        };
    }

    function getShortestDistance(model, fromCode, toCode) {
        if (!fromCode || !toCode || !model.positions[fromCode] || !model.positions[toCode]) return Infinity;
        if (fromCode === toCode) return 0;

        var visited = {};
        var queue = [{ code: fromCode, distance: 0 }];
        visited[fromCode] = true;

        while (queue.length) {
            var current = queue.shift();
            var neighbours = model.adjacency[current.code] || [];
            for (var index = 0; index < neighbours.length; index++) {
                var nextCode = neighbours[index];
                if (visited[nextCode]) continue;
                if (nextCode === toCode) return current.distance + 1;
                visited[nextCode] = true;
                queue.push({ code: nextCode, distance: current.distance + 1 });
            }
        }
        return Infinity;
    }

    function getNeighbourTowardDestination(model, currentCode, destinationCode) {
        if (!destinationCode || !model.positions[destinationCode]) return null;
        var currentDistance = getShortestDistance(model, currentCode, destinationCode);
        var closest = null;
        var closestDistance = currentDistance;

        (model.adjacency[currentCode] || []).forEach(function (candidateCode) {
            var candidateDistance = getShortestDistance(model, candidateCode, destinationCode);
            if (candidateDistance < closestDistance) {
                closest = candidateCode;
                closestDistance = candidateDistance;
            }
        });
        return closest;
    }

    function getApproachStation(model, nextCode, destinationCode, train, lineCode) {
        if (!destinationCode || !model.positions[destinationCode]) return null;
        var nextDistance = getShortestDistance(model, nextCode, destinationCode);
        var candidate = null;
        var candidateDistance = nextDistance;
        var preferredSide = getDirectionSide(model, train || {}, lineCode || '', '', nextCode, destinationCode);

        (model.adjacency[nextCode] || []).forEach(function (neighbourCode) {
            var neighbourDistance = getShortestDistance(model, neighbourCode, destinationCode);
            var neighbourPosition = model.positions[neighbourCode];
            var nextPosition = model.positions[nextCode];
            var followsDirection = !preferredSide || !neighbourPosition || !nextPosition ||
                (preferredSide === 'right' && nextPosition.y > neighbourPosition.y) ||
                (preferredSide === 'left' && nextPosition.y < neighbourPosition.y);
            if (neighbourDistance > candidateDistance && isFinite(neighbourDistance) && followsDirection) {
                candidate = neighbourCode;
                candidateDistance = neighbourDistance;
            }
        });
        return candidate;
    }

    function isDoorOpen(value) {
        return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
    }

    function isStoppedTrain(train, lineCode, currentCode, nextCode) {
        if (currentCode && nextCode && currentCode === nextCode) return true;
        if (currentCode && isDoorOpen(train.doorStatus)) return true;

        // EAL startDistance is zero when the train is reported at a station.
        if (lineCode === 'EAL' && currentCode) {
            var startDistance = parseFloat(train.startDistance);
            if (!isNaN(startDistance) && startDistance === 0) return true;
        }
        return false;
    }

    function getEalProgress(train, lineCode) {
        if (lineCode !== 'EAL') return null;

        var startDistance = parseFloat(train.startDistance);
        var targetDistance = parseFloat(train.targetDistance);
        if (isNaN(startDistance) || isNaN(targetDistance) ||
            startDistance < 0 || targetDistance <= 0) {
            return null;
        }

        var totalDistance = startDistance + targetDistance;
        if (totalDistance <= 0) return null;

        var speed = parseFloat(train.trainSpeed);
        var updatedTime = getTrainloadUpdatedTimeMilliseconds(getTrainloadUpdatedTimeValue(train));
        if (!isNaN(speed) && speed > 0 && updatedTime !== null) {
            var elapsedSeconds = Math.max(0, (Date.now() - updatedTime) / 1000);
            startDistance = Math.min(
                startDistance + elapsedSeconds * speed * 1000 / 3600,
                totalDistance
            );
        }
        return Math.max(0, Math.min(1, startDistance / totalDistance));
    }

    function getDirectionSide(model, train, lineCode, currentCode, nextCode, destinationCode) {
        var currentPosition = model.positions[currentCode];
        var nextPosition = model.positions[nextCode];
        if (currentPosition && nextPosition) {
            if (nextPosition.y > currentPosition.y) return 'right';
            if (nextPosition.y < currentPosition.y) return 'left';
            if (nextPosition.x > currentPosition.x) return 'right';
            if (nextPosition.x < currentPosition.x) return 'left';
        }

        if (train.isUpline === true || train.isUpline === false) {
            return train.isUpline ? 'left' : 'right';
        }

        // EAL's odd/even train sequence identifies its up/down direction.
        // In the map, EAL up-line runs from the top toward the bottom.
        if (lineCode === 'EAL' && typeof getEalTdDirection === 'function') {
            var ealDirection = getEalTdDirection(train.td || '');
            if (ealDirection) return ealDirection === 'up' ? 'right' : 'left';
        }

        // A train at a branch terminus may report the same current and next
        // station. Use its only neighbouring station to preserve the route
        // direction instead of dropping the marker.
        if (currentCode && currentCode === nextCode) {
            var neighbours = model.adjacency[currentCode] || [];
            if (neighbours.length === 1 && model.positions[neighbours[0]]) {
                return model.positions[neighbours[0]].y < model.positions[currentCode].y ? 'right' : 'left';
            }
        }

        var destinationPosition = model.positions[destinationCode];
        if (currentPosition && destinationPosition) {
            if (destinationPosition.y > currentPosition.y) return 'right';
            if (destinationPosition.y < currentPosition.y) return 'left';
        }
        return null;
    }

    function getMarkerLeft(point, side) {
        if (!point || !side) return null;
        var left = point.left + (side === 'right' ? MAP_MARKER_LANE_OFFSET : -MAP_MARKER_LANE_OFFSET);
        return Math.max(8, Math.min(92, left));
    }

    function interpolatePoints(firstPoint, secondPoint, progress) {
        return {
            left: firstPoint.left + (secondPoint.left - firstPoint.left) * progress,
            y: firstPoint.y + (secondPoint.y - firstPoint.y) * progress
        };
    }

    // Exact EAL distances are interpolated. All other moving trains use the
    // middle of their current/next station interval, avoiding false precision.
    function getTrainMapLocation(train, lineCode, model) {
        var currentCode = getMappedLineStationCode(lineCode, train.currentStationCode);
        var nextCode = getMappedLineStationCode(lineCode, train.nextStationCode);
        var destinationCode = getMappedLineStationCode(lineCode, train.destinationStationCode);
        var currentPoint = getMapPoint(model, currentCode);
        var nextPoint = getMapPoint(model, nextCode);
        var stopped = isStoppedTrain(train, lineCode, currentCode, nextCode);

        if (stopped) {
            var stoppedCode = currentPoint ? currentCode : (nextPoint ? nextCode : '');
            var stoppedPoint = stoppedCode ? getMapPoint(model, stoppedCode) : null;
            var stoppedSide = getDirectionSide(model, train, lineCode, currentCode, nextCode, destinationCode);
            if (!stoppedPoint || !stoppedSide) return null;
            return {
                left: getMarkerLeft(stoppedPoint, stoppedSide),
                y: stoppedPoint.y,
                side: stoppedSide,
                currentCode: currentCode,
                nextCode: nextCode,
                destinationCode: destinationCode,
                stopped: true,
                exact: true
            };
        }

        if (currentPoint && nextPoint && hasConnection(model, currentCode, nextCode)) {
            var progress = getEalProgress(train, lineCode);
            var segmentProgress = progress === null ? 0.5 : progress;
            var branchRoute = getBranchRouteForSegment(model, currentCode, nextCode);
            var point = branchRoute
                ? getBranchSegmentPoint(model, branchRoute, currentCode, nextCode, segmentProgress)
                : interpolatePoints(currentPoint, nextPoint, segmentProgress);
            var side = getDirectionSide(model, train, lineCode, currentCode, nextCode, destinationCode);
            if (!point) return null;
            if (!side) return null;
            return {
                left: getMarkerLeft(point, side),
                y: point.y,
                side: side,
                currentCode: currentCode,
                nextCode: nextCode,
                destinationCode: destinationCode,
                stopped: false,
                exact: progress !== null
            };
        }

        if (currentPoint && !nextPoint) {
            var inferredNextCode = getNeighbourTowardDestination(model, currentCode, destinationCode);
            var inferredNextPoint = getMapPoint(model, inferredNextCode);
            var inferredSide = getDirectionSide(model, train, lineCode, currentCode, inferredNextCode, destinationCode);
            if (inferredNextPoint && inferredSide) {
                var inferredPoint = interpolatePoints(currentPoint, inferredNextPoint, 0.5);
                return {
                    left: getMarkerLeft(inferredPoint, inferredSide),
                    y: inferredPoint.y,
                    side: inferredSide,
                    currentCode: currentCode,
                    nextCode: inferredNextCode,
                    destinationCode: destinationCode,
                    stopped: false,
                    exact: false
                };
            }
        }

        if (!currentPoint && nextPoint) {
            var inferredCurrentCode = getApproachStation(model, nextCode, destinationCode, train, lineCode);
            var inferredCurrentPoint = getMapPoint(model, inferredCurrentCode);
            var approachSide = getDirectionSide(model, train, lineCode, inferredCurrentCode, nextCode, destinationCode);
            if (inferredCurrentPoint && approachSide) {
                var approachPoint = interpolatePoints(inferredCurrentPoint, nextPoint, 0.5);
                return {
                    left: getMarkerLeft(approachPoint, approachSide),
                    y: approachPoint.y,
                    side: approachSide,
                    currentCode: inferredCurrentCode,
                    nextCode: nextCode,
                    destinationCode: destinationCode,
                    stopped: false,
                    exact: false
                };
            }
        }

        return null;
    }

    function getReadableTextColour(backgroundColour) {
        var colour = String(backgroundColour || '').replace('#', '');
        if (!/^[0-9a-f]{6}$/i.test(colour)) return '#ffffff';
        var rgb = [parseInt(colour.slice(0, 2), 16), parseInt(colour.slice(2, 4), 16), parseInt(colour.slice(4, 6), 16)];
        var luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
        return luminance > 165 ? '#111111' : '#ffffff';
    }

    function getStationBandStyle(colour) {
        var darkMode = document.body.classList.contains('dark-mode');
        var stationColour = typeof populateLineBackgroundColor === 'function' ? populateLineBackgroundColor(colour, darkMode) : colour;
        return '--line-map-station-colour:' + escapeHtml(stationColour) + ';--line-map-station-text:' +
            escapeHtml(getReadableTextColour(stationColour));
    }

    function getTrainCardText(train, lineCode, location) {
        var destination = getStationName(location.destinationCode);
        var next = getStationName(location.nextCode);
        var current = getStationName(location.currentCode);
        var code = getNormalizedTrainloadTd(train, lineCode);
        var trainType = typeof parseTrainTypeForLine === 'function'
            ? parseTrainTypeForLine(train, lineCode)
            : '';
        var directionText = location.stopped
            ? '停站中 · ' + (current || next || '未知車站')
            : '往 ' + (next || destination || '下一站');
        return {
            code: code,
            trainType: trainType,
            destination: destination || next || '—',
            direction: directionText
        };
    }

    function getTrainLoadDots(train, lineCode, isUpLine) {
        var cars = Array.isArray(train.carLoads) ? train.carLoads : [];
        if (!cars.length) return '<span class="line-map-load-unknown">—</span>';
        var orderedCars = cars.slice();

        // The APIs order carriage data from opposite ends on these lines.
        // Reverse only when needed so the leftmost dot always represents car 1.
        if ((lineCode === 'EAL' && !isUpLine) ||
            ((lineCode === 'KTL' || lineCode === 'TWL' || lineCode === 'ISL' || lineCode === 'TCL') && isUpLine)) {
            orderedCars.reverse();
        }

        var html = '';
        orderedCars.forEach(function (car, index) {
            var load = Number(car.passengerCount);
            if (!isFinite(load)) load = Number(car.passengerLoad);
            var loadClass = !isFinite(load) || load < 0 ? ' is-unknown' :
                (lineCode === 'EAL' || lineCode === 'TML'
                    ? (load < 120 ? ' is-low' : (load < 230 ? ' is-medium' : ' is-high'))
                    : (load <= 0 ? ' is-unknown' : (load === 1 ? ' is-low' : (load === 2 ? ' is-medium' : ' is-high'))));
            html += '<span class="line-map-load-dot' + loadClass + '" aria-label="第 ' + (index + 1) + ' 卡"></span>';
        });
        return '<span class="line-map-load-dots" aria-label="列車載客量，由左至右為第 1 卡起">' + html + '</span>';
    }

    function getMapMarkers(lineCode, model) {
        var markers = [];
        getVisibleLineTrainloadRecords(lineCode).forEach(function (train) {
            var location = getTrainMapLocation(train, lineCode, model);
            if (!location) return;
            markers.push({
                train: train,
                location: location,
                cardText: getTrainCardText(train, lineCode, location),
                offset: 0
            });
        });

        // Offset coincident cards along their own side of the line.
        var markerGroups = {};
        markers.forEach(function (marker) {
            var key = marker.location.side + ':' + Math.round(marker.location.y / 12);
            if (!markerGroups[key]) markerGroups[key] = [];
            markerGroups[key].push(marker);
        });
        Object.keys(markerGroups).forEach(function (key) {
            var group = markerGroups[key];
            group.forEach(function (marker, index) {
                marker.offset = (index - (group.length - 1) / 2) * Math.min(42, MAP_MARKER_WIDTH * 0.38);
            });
        });
        return markers;
    }

    function renderTrackSvg(model, colour) {
        var paths = model.edges.filter(function (edge) {
            return !model.branchEdgeKeys[makeEdgeKey(edge[0], edge[1])];
        }).map(function (edge) {
            var firstPoint = getMapPoint(model, edge[0]);
            var secondPoint = getMapPoint(model, edge[1]);
            return '<path class="row2-viz-line line-map-track" d="M ' + firstPoint.svgX + ' ' + firstPoint.svgY +
                ' L ' + secondPoint.svgX + ' ' + secondPoint.svgY + '"/>';
        }).join('');

        var branchPaths = model.branchRoutes.map(function (route) {
            var firstPoint = getMapPoint(model, route.stations[0]);
            var branchPoint = getMapPoint(model, route.stations[1]);
            var lastPoint = getMapPoint(model, route.stations[route.stations.length - 1]);
            if (!firstPoint || !branchPoint || !lastPoint) return '';

            var connectorStartY = firstPoint.y + MAP_STATION_GAP / 2;
            var lastStationIsTerminus = model.positions[route.stations[route.stations.length - 1]].x !== 0;
            var connectorEndY = lastStationIsTerminus
                ? lastPoint.y
                : lastPoint.y - MAP_STATION_GAP / 2;
            return '<path class="row2-viz-line line-map-track line-map-branch-track" d="M ' +
                firstPoint.svgX + ' ' + connectorStartY +
                ' H ' + branchPoint.svgX +
                ' V ' + connectorEndY +
                ' H ' + lastPoint.svgX + '"/>';
        }).join('');

        return '<svg class="line-map-track-svg" viewBox="0 0 ' + MAP_VIEWBOX_WIDTH + ' ' + model.height +
            '" preserveAspectRatio="none" aria-hidden="true" style="--line-map-colour:' + escapeHtml(colour) + '">' +
            paths + branchPaths + '</svg>';
    }

    function renderInternalRows(model) {
        var html = '';
        for (var index = 1; index < model.stationCodes.length; index++) {
            var previousPoint = getMapPoint(model, model.stationCodes[index - 1]);
            var currentPoint = getMapPoint(model, model.stationCodes[index]);
            var top = previousPoint.y + MAP_STATION_ROW_HEIGHT / 2;
            var height = currentPoint.y - previousPoint.y - MAP_STATION_ROW_HEIGHT;
            if (height <= 0) continue;
            html += '<div class="line-map-internal-row" style="top:' + top + 'px;height:' + height + 'px"></div>';
        }
        return html;
    }

    function renderStations(model, colour) {
        return model.stationCodes.map(function (code) {
            var point = getMapPoint(model, code);
            var station = stationByCode[code];
            var chineseName = station ? station.name_chi : code;
            var lineDots = typeof buildLineDotsHtml === 'function' && station
                ? buildLineDotsHtml(station)
                : '';
            return '<div class="line-map-station-row" style="top:' + (point.y - MAP_STATION_ROW_HEIGHT / 2) + 'px;' +
                getStationBandStyle(colour) + '">' +
                '<span class="line-map-station-name">' +
                    '<span class="line-map-station-chi">' + escapeHtml(chineseName) + '</span>' +
                    '<span class="line-map-station-lines">' + lineDots + '</span>' +
                '</span>' +
            '</div>' +
            '<span class="line-map-station-marker" style="left:' + point.left + '%;top:' +
                (point.y - MAP_STATION_ROW_HEIGHT / 2) + 'px" aria-hidden="true">' +
                '<span class="row2-viz-dot" style="left:50%"></span>' +
            '</span>';
        }).join('');
    }

    function renderTrainCard(marker, lineCode, colour) {
        var cardText = marker.cardText;
        var isUpLine = lineCode === 'EAL'
            ? marker.location.side === 'right'
            : marker.location.side === 'left';
        var directionClass = isUpLine ? ' line-map-train-up' : ' line-map-train-down';
        var stoppedClass = marker.location.stopped ? ' line-map-train-stopped' : '';
        var destinationStation = stationByCode[marker.location.destinationCode];
        var destinationStyle = destinationStation
            ? ' style="background-color:' + escapeHtml(destinationStation.station_colour || '') + ';color:' +
                escapeHtml(destinationStation.station_font_colour || '') + '"'
            : '';
        var readableColour = getReadableTextColour(colour);
        return '<span class="line-map-train' + directionClass + stoppedClass + '" role="img" title="' +
            escapeHtml(cardText.code + ' ' + cardText.direction) + '" aria-label="' +
            escapeHtml(cardText.code + ' ' + cardText.direction) + '" style="left:' + marker.location.left +
            '%;top:' + marker.location.y + 'px;margin-left:' + marker.offset + 'px;--line-map-train-colour:' +
            escapeHtml(colour) + ';--line-map-train-text:' + readableColour + '">' +
            '<span class="line-map-train-card">' +
                '<span class="line-map-train-band"><span>' + escapeHtml(cardText.code) + '</span>' +
                    (cardText.trainType ? '<span class="line-map-train-type train-type-badge train-type-' +
                        escapeHtml(cardText.trainType.toLowerCase()) + '">' + escapeHtml(cardText.trainType) + '</span>' : '') +
                '</span>' +
                '<span class="line-map-train-body">' +
                    getTrainLoadDots(marker.train, lineCode, isUpLine) +
                    '<span class="line-map-train-destination">往 <span class="line-map-train-destination-badge"' + destinationStyle + '>' +
                        escapeHtml(cardText.destination) + '</span></span>' +
                '</span>' +
            '</span>' +
        '</span>';
    }

    function renderMarkers(markers, lineCode, colour) {
        return markers.map(function (marker) {
            return renderTrainCard(marker, lineCode, colour);
        }).join('');
    }

    function updateTitle() {
        title.innerHTML = renderLineColourBadge(activeLineCode) + ' 列車位置';
    }

    function renderMap() {
        if (!mapContent || !activeLineCode) return;
        updateTitle();

        var model = getLineMapModel(activeLineCode);
        if (!model) {
            mapContent.innerHTML = '<p class="line-map-empty">沒有路線資料</p>';
            return;
        }

        var scrollTop = mapContent.scrollTop;
        var colour = getLineColour(activeLineCode);
        var cache = trainInfoCache[activeLineCode];
        var visibleTrains = getVisibleLineTrainloadRecords(activeLineCode);
        var markers = getMapMarkers(activeLineCode, model);
        var status = '';

        if (mapLoading) {
            status = '正在更新列車位置…';
        } else if (!cache) {
            status = '正在載入列車位置…';
        } else if (!visibleTrains.length) {
            status = '沒有列車資料';
        } else if (markers.length !== visibleTrains.length) {
            status = '顯示 ' + markers.length + ' / ' + visibleTrains.length + ' 班列車位置';
        } else {
            status = '顯示 ' + markers.length + ' 班列車位置';
        }

        mapContent.setAttribute('aria-busy', mapLoading ? 'true' : 'false');
        mapContent.innerHTML =
            '<div class="line-map-summary" aria-live="polite">' +
                '<span class="line-map-status">' + escapeHtml(status) + '</span>' +
            '</div>' +
            '<div class="line-map-route" style="height:' + model.height + 'px">' +
                renderInternalRows(model) +
                renderTrackSvg(model, colour) +
                renderStations(model, colour) +
                renderMarkers(markers, activeLineCode, colour) +
            '</div>';
        mapContent.scrollTop = scrollTop;
    }

    function startMapPositionTimer() {
        if (mapPositionTimer) clearInterval(mapPositionTimer);
        mapPositionTimer = setInterval(function () {
            if (activeLineCode && overlay && !overlay.classList.contains('hidden')) renderMap();
        }, 5000);
    }

    function stopMapPositionTimer() {
        if (!mapPositionTimer) return;
        clearInterval(mapPositionTimer);
        mapPositionTimer = null;
    }

    function finishMapLoad(lineCode) {
        if (activeLineCode !== lineCode) return;
        mapLoading = false;
        overlay.classList.remove('line-map-loading');
        renderMap();
    }

    function loadMapData(lineCode) {
        if (activeLineCode !== lineCode) return Promise.resolve(false);
        mapLoading = true;
        overlay.classList.add('line-map-loading');
        renderMap();

        return refreshLineTrainload(lineCode).then(function (success) {
            finishMapLoad(lineCode);
            return success;
        }).catch(function () {
            finishMapLoad(lineCode);
            return false;
        });
    }

    function openMap(lineCode) {
        if (!hasTrainloadApi(lineCode)) return;

        var lineChanged = activeLineCode !== lineCode;
        activeLineCode = lineCode;
        if (lineChanged && mapContent) mapContent.scrollTop = 0;
        overlay.classList.remove('hidden');
        renderMap();
        startMapPositionTimer();

        if (refreshButton.disabled) {
            if (lineChanged) loadMapData(lineCode);
            return;
        }
        refreshButtonWithTimeout(refreshButton, function () {
            return loadMapData(lineCode);
        });
    }

    function closeMap() {
        overlay.classList.add('hidden');
        overlay.classList.remove('line-map-loading');
        mapLoading = false;
        activeLineCode = null;
        stopMapPositionTimer();
    }

    function refreshMapData() {
        if (!activeLineCode || !refreshButton || refreshButton.disabled) return;
        var lineCode = activeLineCode;
        refreshButtonWithTimeout(refreshButton, function () {
            return loadMapData(lineCode);
        });
    }

    function switchToTrainTable() {
        var lineCode = activeLineCode;
        if (!lineCode) return;
        closeMap();
        if (typeof window.openTrainTableForLine === 'function') {
            window.openTrainTableForLine(lineCode);
        } else {
            document.dispatchEvent(new CustomEvent('train-table-open-request', {
                detail: { lineCode: lineCode }
            }));
        }
    }

    function addLineBarButtons() {
        document.querySelectorAll('.line-bar').forEach(function (lineBar) {
            addLineBarActionButton(
                lineBar,
                'line-map-open',
                '路線圖',
                function (lineCode) { return 'Show ' + lineCode + ' train position map'; },
                openMap
            );
        });
    }

    function createWindow() {
        overlay = document.createElement('div');
        overlay.id = 'line-map-overlay';
        overlay.className = 'hidden';
        overlay.innerHTML =
            '<section id="line-map-window" role="dialog" aria-modal="true" aria-labelledby="line-map-title">' +
                '<header class="line-map-header">' +
                    '<span id="line-map-title" class="line-map-title"></span>' +
                    '<button type="button" class="line-map-table-switch modal-view-switch" aria-label="Show train information table">車序表</button>' +
                    '<button type="button" class="btn-refresh line-map-refresh" aria-label="Refresh train positions">F5</button>' +
                    '<button type="button" class="line-map-close" aria-label="Close train position map">&times;</button>' +
                '</header>' +
                '<div id="line-map-content" class="line-map-scroll" aria-live="polite"></div>' +
            '</section>';
        document.body.appendChild(overlay);

        title = overlay.querySelector('#line-map-title');
        mapContent = overlay.querySelector('#line-map-content');
        refreshButton = overlay.querySelector('.line-map-refresh');
        overlay.querySelector('.line-map-close').addEventListener('click', closeMap);
        overlay.querySelector('.line-map-table-switch').addEventListener('click', switchToTrainTable);
        refreshButton.addEventListener('click', refreshMapData);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay) closeMap();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !overlay.classList.contains('hidden')) closeMap();
        });
    }

    function observeEtaContainer() {
        var etaContainer = document.getElementById('eta-container');
        if (!etaContainer || !window.MutationObserver) return;
        etaContainerObserver = new MutationObserver(function () {
            addLineBarButtons();
        });
        etaContainerObserver.observe(etaContainer, { childList: true });
    }

    document.addEventListener('DOMContentLoaded', function () {
        createWindow();
        window.openLineMapForLine = openMap;
        addLineBarButtons();
        observeEtaContainer();
        document.addEventListener('line-map-open-request', function (event) {
            var requestedLineCode = event.detail && event.detail.lineCode;
            if (requestedLineCode) openMap(requestedLineCode);
        });
        document.addEventListener('line-trainload-updated', function (event) {
            var updatedLineCode = event.detail && event.detail.lineCode;
            if (updatedLineCode === activeLineCode && !overlay.classList.contains('hidden')) {
                renderMap();
            }
        });
        document.addEventListener('theme-changed', function () {
            if (activeLineCode && !overlay.classList.contains('hidden')) renderMap();
        });
    });
}());
