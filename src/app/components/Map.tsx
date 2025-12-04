'use client';

import React, { useEffect, useRef } from 'react';
import L, { LayerGroup } from 'leaflet';
import 'leaflet-rotatedmarker';
import 'leaflet-rotate';
import 'leaflet/dist/leaflet.css';

interface NavData {
  latitude: number;
  longitude: number;
}

interface CogData {
  cog: number;
}

interface MapState {
  view_type: string;
  is_refreshed: boolean;
}

export interface Waypoints {
  start: [number, number];
  buoys: [number, number];
  finish: [number, number];
  image_surface: [number, number];
  image_underwater: [number, number];
}

interface MapProps {
  navData: NavData | null;
  cogData: CogData | null;
  mapState: MapState;
  missionWaypoints: { [key: string]: Waypoints };
  supabase: any;
}

/** ===================== ICONS ===================== */
const redBuoyIcon = L.icon({ iconUrl: '/merah.png', iconSize: [10, 10], iconAnchor: [12, 12] });
const greenBuoyIcon = L.icon({ iconUrl: '/hijau.png', iconSize: [10, 10], iconAnchor: [12, 12] });
const startIcon = L.icon({ iconUrl: '/start.png', iconSize: [40, 40], iconAnchor: [12, 24] });
const shipIcon = L.icon({ iconUrl: '/kapalasli3.png', iconSize: [50, 40], iconAnchor: [25, 20] });
const Object_surface = L.icon({ iconUrl: '/atas.jpeg', iconSize: [20, 20], iconAnchor: [12, 24] });
const Object_under = L.icon({ iconUrl: '/bawah.png', iconSize: [20, 20], iconAnchor: [12, 24] });
// const finish = L.icon({ iconUrl: '/finish.jpg', iconSize: [40, 15], iconAnchor: [12, 24] });

type MissionConfig = {
  center: [number, number];
  latLabels: string[];
  lonLabels: string[];
};

const MISSION_CONFIG: Record<string, MissionConfig> = {
  lintasan1: {
    // -7.765527144208408, 110.37035626576507 = bengkel
    // -7.769460228520795, 110.38284391635815 = Wisdom
    center: [-7.9154834, 112.5891244],
    latLabels: ['5', '4', '3', '2', '1'],
    lonLabels: ['A', 'B', 'C', 'D', 'E'],
  },
  lintasan2: {
    center: [-7.9150524, 112.5888965],
    latLabels: ['5', '4', '3', '2', '1'],
    lonLabels: ['E', 'D', 'C', 'B', 'A'],
  },
};

// Fallback ke lintasan1 jika tipe tak dikenal
const getConfig = (missionType: string): MissionConfig =>
  MISSION_CONFIG[missionType] ?? MISSION_CONFIG['lintasan1'];

// arah lintasan / grid (0 = utara, 90 = timur)
const GRID_BEARING_DEG = 150; // samakan dengan arah lintasanmu

// ukuran area tampilan (dekat grid)
const VIEW_HALF_SIZE_M = 12.5;

// ukuran area yang boleh di-drag (sedikit lebih luas)
const BOUNDS_HALF_SIZE_M = 15;

/** ===================== COMPONENT ===================== */
const Map: React.FC<MapProps> = ({ navData, cogData, mapState, missionWaypoints, supabase }) => {
  const mapRef = useRef<L.Map | null>(null);
  const shipMarkerRef = useRef<L.Marker | null>(null);
  const pathRef = useRef<L.Polyline | null>(null);
  const trackCoordinatesRef = useRef<[number, number][]>([]);
  const gridLayersRef = useRef<Record<string, LayerGroup>>({
    lintasan1: L.layerGroup(),
    lintasan2: L.layerGroup(),
  });
  const waypointLayersRef = useRef<LayerGroup>(L.layerGroup());

  const metersToLatLon = (centerLat: number, meters: number): { dLat: number; dLon: number } => {
    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
    return {
      dLat: meters / metersPerDegLat,
      dLon: meters / metersPerDegLon,
    };
  };

  // offset dalam meter (dx timur, dy utara) → LatLng
  const metersOffsetToLatLng = (
    center: [number, number],
    dxMeters: number,
    dyMeters: number
  ): L.LatLng => {
    const [lat, lon] = center;
    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);

    const dLat = dyMeters / metersPerDegLat;
    const dLon = dxMeters / metersPerDegLon;

    return L.latLng(lat + dLat, lon + dLon);
  };

  const drawGrid = (mapInstance: L.Map, missionType: string) => {
    const { center, latLabels, lonLabels } = getConfig(missionType);
    const layersToDraw =
      gridLayersRef.current[missionType] ??
      (gridLayersRef.current[missionType] = L.layerGroup());

    layersToDraw.clearLayers();

    const numDivisions = 5;
    const cellSizeM = 5; // 5 m per cell
    const totalSizeM = numDivisions * cellSizeM;
    const halfSizeM = totalSizeM / 2;

    // basis vector menurut bearing
    const headingRad = (GRID_BEARING_DEG * Math.PI) / 180;
    const sinH = Math.sin(headingRad);
    const cosH = Math.cos(headingRad);

    // u = arah heading (maju), v = kiri lintasan (heading - 90°)
    const ux = sinH; // meter → timur
    const uy = cosH; // meter → utara
    const vx = -cosH;
    const vy = sinH;

    const toLatLng = (aMeters: number, bMeters: number) => {
      // a sepanjang heading, b tegak lurus (kiri +)
      const dx = aMeters * ux + bMeters * vx;
      const dy = aMeters * uy + bMeters * vy;
      return metersOffsetToLatLng(center, dx, dy);
    };

    // garis "horizontal" (sepanjang heading)
    for (let row = 0; row <= numDivisions; row++) {
      const b = -halfSizeM + row * cellSizeM;
      const start = toLatLng(-halfSizeM, b);
      const end = toLatLng(+halfSizeM, b);

      L.polyline([start, end], { color: 'black', weight: 0.1 }).addTo(layersToDraw);
    }

    // garis "vertikal" (tegak lurus heading)
    for (let col = 0; col <= numDivisions; col++) {
      const a = -halfSizeM + col * cellSizeM;
      const start = toLatLng(a, -halfSizeM);
      const end = toLatLng(a, +halfSizeM);

      L.polyline([start, end], { color: 'black', weight: 0.1 }).addTo(layersToDraw);
    }

    // label di tengah kotak
    for (let row = 0; row < numDivisions; row++) {
      const b = -halfSizeM + (row + 0.5) * cellSizeM;
      for (let col = 0; col < numDivisions; col++) {
        const a = -halfSizeM + (col + 0.5) * cellSizeM;

        const cellCenter = toLatLng(a, b);
        const label = `${lonLabels[col]}${latLabels[row]}`;

        L.marker(cellCenter, {
          icon: L.divIcon({
            className: 'gridCellLabel',
            html: label,
            iconAnchor: [10, 10],
          }),
        }).addTo(layersToDraw);
      }
    }
  };

  const drawWaypoints = (mapInstance: L.Map, missionType: string) => {
    waypointLayersRef.current.clearLayers();
    const waypoints = missionWaypoints[missionType];
    if (!waypoints) return;

    L.marker(waypoints.start, { icon: startIcon, opacity: 1 })
      .addTo(waypointLayersRef.current)
      .bindPopup('Titik Start');

    L.marker(waypoints.image_surface, { icon: Object_surface, opacity: 1 })
      .addTo(waypointLayersRef.current)
      .bindPopup('image surface');

    L.marker(waypoints.image_underwater, { icon: Object_under, opacity: 1 })
      .addTo(waypointLayersRef.current)
      .bindPopup('image underwater');

    // L.marker(waypoints.finish, { icon: finish, opacity: 1 })
    //   .addTo(waypointLayersRef.current)
    //   .bindPopup('Titik Finish');

    waypointLayersRef.current.addTo(mapInstance);
  };

  const fetchBuoyData = async (mapInstance: L.Map) => {
    const { data: buoys, error } = await supabase.from('buoys').select('*');
    if (error) {
      console.error('Failed to fetch buoy data:', error);
      return;
    }
    buoys.forEach((buoy: { color: string; latitude: number; longitude: number }) => {
      const icon = buoy.color === 'red' ? redBuoyIcon : greenBuoyIcon;
      L.marker([buoy.latitude, buoy.longitude], { icon })
        .addTo(mapInstance)
        .bindPopup(`Pelampung ${buoy.color}`);
    });
  };

  /** ===================== INIT MAP ===================== */
  useEffect(() => {
    if (mapRef.current) return;

    const { center: initialCenter } = getConfig('lintasan1');

    // area tampilan awal (dekat grid)
    const viewDelta = metersToLatLon(initialCenter[0], VIEW_HALF_SIZE_M);
    const viewBounds = L.latLngBounds(
      [initialCenter[0] - viewDelta.dLat, initialCenter[1] - viewDelta.dLon],
      [initialCenter[0] + viewDelta.dLat, initialCenter[1] + viewDelta.dLon]
    );

    // area batas drag (lebih luas sedikit)
    const boundDelta = metersToLatLon(initialCenter[0], BOUNDS_HALF_SIZE_M);
    const allowedBounds = L.latLngBounds(
      [initialCenter[0] - boundDelta.dLat, initialCenter[1] - boundDelta.dLon],
      [initialCenter[0] + boundDelta.dLat, initialCenter[1] + boundDelta.dLon]
    );

    const mapInstance = (L as any).map('map', {
      center: initialCenter,
      zoom: 21,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false,
      zoomControl: false,

      maxBounds: allowedBounds,
      maxBoundsViscosity: 1.0,

      // opsi dari leaflet-rotate
      rotate: true,
      bearing: 0,
      touchRotate: false,
    });
    mapRef.current = mapInstance;

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 21.8,
        minZoom: 21.8,
      }
    ).addTo(mapInstance);

    // putar map sekali
    const desiredBearing = 120; // derajat, searah jarum jam dari utara
    (mapInstance as any).setBearing(desiredBearing);

    // tampilan awal fokus ke sekitar grid
    mapInstance.fitBounds(viewBounds);

    // gambar grid untuk kedua lintasan (layerGroup-nya disiapkan)
    drawGrid(mapInstance, 'lintasan1');
    drawGrid(mapInstance, 'lintasan2');

    fetchBuoyData(mapInstance);

    // Example rectangles around each mission center (opsional)
    const deltaLat = 0.1;
    const deltaLon = 0.1;
    const centers = Object.values(MISSION_CONFIG).map(({ center }) => ({
      x: center[0],
      y: center[1],
    }));

    centers.forEach(({ x, y }) => {
      const MaxgetBounds: L.LatLngBoundsExpression = [
        [x - (1 + deltaLat), y - (1 + deltaLon)],
        [x + 2 * deltaLat, y + 1 + deltaLon],
      ];
      L.rectangle(MaxgetBounds, {
        color: 'blue',
        weight: 1,
        fillColor: '#82d6fdff',
        fillOpacity: 1,
      }).addTo(mapInstance);
    });
  }, []);

  /** ===================== RESPOND TO STATE CHANGES ===================== */
  useEffect(() => {
    if (!mapRef.current || !mapState) return;

    const { center } = getConfig(mapState.view_type);

    // area tampilan (dekat grid)
    const viewDelta = metersToLatLon(center[0], VIEW_HALF_SIZE_M);
    const viewBounds = L.latLngBounds(
      [center[0] - viewDelta.dLat, center[1] - viewDelta.dLon],
      [center[0] + viewDelta.dLat, center[1] + viewDelta.dLon]
    );

    // area batas drag (lebih luas)
    const boundDelta = metersToLatLon(center[0], BOUNDS_HALF_SIZE_M);
    const allowedBounds = L.latLngBounds(
      [center[0] - boundDelta.dLat, center[1] - boundDelta.dLon],
      [center[0] + boundDelta.dLat, center[1] + boundDelta.dLon]
    );

    // batas drag pakai yang luas
    mapRef.current.setMaxBounds(allowedBounds);
    // tampilan fokus ke sekitar grid
    mapRef.current.fitBounds(viewBounds);

    // Toggle grid layers per view (layerGroup yang sudah diisi di drawGrid)
    Object.values(gridLayersRef.current).forEach((lg) => lg.remove());
    const activeGrid =
      gridLayersRef.current[mapState.view_type] ?? gridLayersRef.current['lintasan1'];
    activeGrid.addTo(mapRef.current);

    drawWaypoints(mapRef.current, mapState.view_type);

    if (mapState.is_refreshed) {
      if (pathRef.current) {
        mapRef.current.removeLayer(pathRef.current);
        pathRef.current = null;
      }
      if (shipMarkerRef.current) {
        mapRef.current.removeLayer(shipMarkerRef.current);
        shipMarkerRef.current = null;
      }
      trackCoordinatesRef.current = [];
    }
  }, [mapState]);

  /** ===================== NAV & COG ===================== */
  useEffect(() => {
    if (!mapRef.current || !navData) return;

    const latestPosition: [number, number] = [navData.latitude, navData.longitude];

    if (shipMarkerRef.current) {
      (shipMarkerRef.current as any).setLatLng(latestPosition);
    } else {
      shipMarkerRef.current = L.marker(latestPosition, { icon: shipIcon }).addTo(mapRef.current);
      if (cogData) (shipMarkerRef.current as any).setRotationAngle(cogData.cog);
    }

    if (cogData && shipMarkerRef.current) {
      (shipMarkerRef.current as any).setRotationAngle(cogData.cog);
    }

    trackCoordinatesRef.current.push(latestPosition);
    if (trackCoordinatesRef.current.length < 2) return;

    if (pathRef.current) {
      pathRef.current.setLatLngs(trackCoordinatesRef.current as [number, number][]);
    } else {
      pathRef.current = L.polyline(trackCoordinatesRef.current as [number, number][], {
        color: 'red',
        weight: 0.5,
        dashArray: '2, 1',
      }).addTo(mapRef.current);
    }
  }, [navData, cogData]);

  return <div id="map" className="map" style={{ width: '100%', height: '100%' }} />;
};

export default Map;
