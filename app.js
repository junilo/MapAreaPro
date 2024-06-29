let map;
let markers = [];
let polygon;
let infoWindow;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8,
        // Enable drawing library
        gestureHandling: 'greedy'
    });

    infoWindow = new google.maps.InfoWindow();

    // Create a Drawing Manager to draw polygons
    const drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.MARKER,
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: ['marker']
        },
        markerOptions: {
            draggable: true
        }
    });
    drawingManager.setMap(map);

    google.maps.event.addListener(drawingManager, 'markercomplete', function (marker) {
        markers.push(marker);

        google.maps.event.addListener(marker, 'dragend', function () {
            redrawPolygon();
        });

        redrawPolygon();
    });

    document.getElementById('import-file').addEventListener('change', importJson);
}

function redrawPolygon() {
    // Ensure there are at least 3 markers
    if (markers.length < 3) {
        return;
    }

    if (polygon) {
        polygon.setMap(null);
    }

    // Get the marker positions
    const positions = markers.map(marker => marker.getPosition());

    // Sort markers to form a non-intersecting polygon
    const sortedPositions = sortPositionsClockwise(positions);

    // Create the polygon
    polygon = new google.maps.Polygon({
        paths: sortedPositions,
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#FF0000',
        fillOpacity: 0.35
    });
    polygon.setMap(map);

    // Calculate and display the area
    const area = google.maps.geometry.spherical.computeArea(polygon.getPath());
    const areaInSqKm = area / 1000000; // Convert from sq meters to sq km

    let contentString;
    if (areaInSqKm < 1) {
        // Display area in square meters if less than 1 sq km
        contentString = `Area: ${area.toFixed(2)} sq m`;
    } else {
        // Display area in square kilometers otherwise
        contentString = `Area: ${areaInSqKm.toFixed(2)} sq km`;
    }

    infoWindow.setContent(contentString);
    infoWindow.setPosition(sortedPositions[0]);
    infoWindow.open(map);
}

function sortPositionsClockwise(positions) {
    // Sort positions to form a non-intersecting polygon
    // Convert positions to array of LatLng objects and sort them
    const latLngs = positions.map(pos => new google.maps.LatLng(pos.lat(), pos.lng()));

    // Calculate the centroid
    const centroid = latLngs.reduce((acc, latLng) => {
        acc.lat += latLng.lat();
        acc.lng += latLng.lng();
        return acc;
    }, { lat: 0, lng: 0 });

    centroid.lat /= latLngs.length;
    centroid.lng /= latLngs.length;

    // Sort points based on angle from the centroid
    latLngs.sort((a, b) => {
        const angleA = Math.atan2(a.lng() - centroid.lng, a.lat() - centroid.lat);
        const angleB = Math.atan2(b.lng() - centroid.lng, b.lat() - centroid.lat);
        return angleA - angleB;
    });

    return latLngs;
}

function exportJson() {
    if (markers.length === 0 || !polygon) {
        alert('No data to export.');
        return;
    }

    const data = {
        markers: markers.map(marker => ({
            lat: marker.getPosition().lat(),
            lng: marker.getPosition().lng()
        })),
        polygon: polygon.getPath().getArray().map(latLng => ({
            lat: latLng.lat(),
            lng: latLng.lng()
        }))
    };

    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function chooseFile() {
    document.getElementById('import-file').click();
}

function importJson(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = JSON.parse(e.target.result);

        // Clear existing markers and polygon
        markers.forEach(marker => marker.setMap(null));
        markers = [];
        if (polygon) {
            polygon.setMap(null);
            polygon = null;
        }

        // Add markers
        data.markers.forEach(markerData => {
            const marker = new google.maps.Marker({
                position: new google.maps.LatLng(markerData.lat, markerData.lng),
                map: map,
                draggable: true
            });
            markers.push(marker);

            google.maps.event.addListener(marker, 'dragend', function () {
                redrawPolygon();
            });
        });

        // Draw polygon
        if (data.polygon.length >= 3) {
            const polygonPath = data.polygon.map(point => new google.maps.LatLng(point.lat, point.lng))
            polygon = new google.maps.Polygon({
                paths: polygonPath,
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.35
            });
            polygon.setMap(map);

            redrawPolygon();

            // Zoom into the polygon
            const bounds = new google.maps.LatLngBounds();
            polygonPath.forEach(latLng => bounds.extend(latLng));
            map.fitBounds(bounds);
        }
    };

    reader.readAsText(file);
}

// Initialize the map
google.maps.event.addDomListener(window, 'load', initMap);
