'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isNear } from './components/Near';

import NavData from './components/NavData';
import MissionLog from './components/MissionLog';
import ImageSection from './components/ImageSection';
import './styles.css';

const Map = dynamic(() => import('./components/Map'), { ssr: false });

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key environment variables');
}
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

import { Waypoints } from './components/Map';

type WaypointType = 'start' | 'buoys' | 'finish' | 'image_surface' | 'image_underwater';

function buildWaypointMap(rows: Array<{
  mission_name: string;
  waypoint_type: WaypointType;
  latitude: number;
  longitude: number;
}>): Record<string, Waypoints> {
  return rows.reduce((acc, r) => {
    (acc[r.mission_name] ??= {} as Waypoints)[r.waypoint_type] = [r.latitude, r.longitude];
    return acc;
  }, {} as Record<string, Waypoints>);
}

interface NavDataType {
  latitude: number;
  longitude: number;
  timestamp: string;
  sog_ms: number;
}

interface CogData {
  cog: number;
}

interface MissionImage {
  image_url: string;
  image_slot_name: string;
}

interface MissionStatus {
  mission_persiapan: string;
  mission_start: string;
  mission_buoys: string;
  image_atas: string;
  image_bawah: string;
  mission_finish: string;
}

interface MapState {
  view_type: string;
  is_refreshed: boolean;
}

type CenterMap = Record<string, [number, number]>;

async function resetMissionStatus() {
  try {
    const { data, error } = await supabase
      .from('data_mission')
      .update({
        mission_persiapan: 'belum',
        mission_start: 'belum',
        mission_buoys: 'belum',
        image_atas: 'belum',
        image_bawah: 'belum',
        mission_finish: 'belum',
      })
      .eq('id', 1)
      .select();

    if (error) {
      console.error('[resetMissionStatus] UPDATE gagal (cek RLS?):', error);
      return;
    }
    console.log('[resetMissionStatus] OK:', data);
  } catch (error) {
    console.error('Gagal mereset status misi:', error);
  }
}

export default function HomePage() {
  const [navData, setNavData] = useState<NavDataType | null>(null);
  const [cogData, setCogData] = useState<CogData | null>(null);
  const [missionImages, setMissionImages] = useState<MissionImage[]>([]);
  const [missionStatus, setMissionStatus] = useState<MissionStatus | null>(null);
  const [mapState, setMapState] = useState<MapState>({
    view_type: 'lintasan1',
    is_refreshed: false,
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [updateIntervalMs, setUpdateIntervalMs] = useState<number | null>(null);
  const [missionWaypoints, setMissionWaypoints] = useState<Record<string, Waypoints>>({});
  const [controlsEnabled, setControlsEnabled] = useState<boolean>(false);

  // center dari Supabase
  const [centers, setCenters] = useState<CenterMap>({});

  const missionWaypointsRef = useRef<Record<string, Waypoints>>({});
  const mapStateRef = useRef<MapState>(mapState);
  const missionStatusRef = useRef<MissionStatus | null>(missionStatus);

  useEffect(() => {
    missionWaypointsRef.current = missionWaypoints;
  }, [missionWaypoints]);
  useEffect(() => {
    mapStateRef.current = mapState;
  }, [mapState]);
  useEffect(() => {
    missionStatusRef.current = missionStatus;
  }, [missionStatus]);

  const updateMissionStatusInSupabase = async (missionId: keyof MissionStatus, status: string) => {
    try {
      const updateData = { [missionId]: status };
      const { data, error } = await supabase
        .from('data_mission')
        .update(updateData)
        .eq('id', 1)
        .select();
      if (error) {
        console.error(
          `[updateMissionStatus] UPDATE gagal (cek RLS?) ${missionId} -> ${status}`,
          error
        );
        return;
      }
      console.log(`[updateMissionStatus] OK ${missionId} -> ${status}`, data);
    } catch (error) {
      console.error('Gagal memperbarui status misi:', error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const { data: nav, error: navError } = await supabase
          .from('nav_data')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(2);
        if (navError) throw navError;
        setNavData(nav?.[0] || null);
        if (nav && nav.length >= 2) {
          const last = new Date(nav[0].timestamp).getTime();
          const prev = new Date(nav[1].timestamp).getTime();
          setUpdateIntervalMs(last - prev);
        }

        const { data: cog, error: cogError } = await supabase
          .from('cog_data')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(1);
        if (cogError) throw cogError;
        setCogData(cog?.[0] || null);

        const { data: images, error: imagesError } = await supabase
          .from('image_mission')
          .select('*');
        if (imagesError) throw imagesError;
        setMissionImages(images || []);

        const { data: mission, error: missionError } = await supabase
          .from('data_mission')
          .select('*')
          .eq('id', 1)
          .single();
        if (missionError) throw missionError;
        setMissionStatus(mission);

        const { data: map, error: mapError } = await supabase
          .from('map_state')
          .select('*')
          .eq('id', 1)
          .single();
        if (mapError) throw mapError;
        setMapState(map);

        setErrorMessage('');
      } catch (error: any) {
        setErrorMessage(`Failed to fetch initial data: ${error.message}`);
        console.error('Error fetching initial data:', error);
      }
    };

    const fetchWaypoints = async () => {
      try {
        const { data, error } = await supabase
          .from('mission_waypoints')
          .select('mission_name, waypoint_type, latitude, longitude');
        if (error) throw error;
        setMissionWaypoints(buildWaypointMap((data ?? []) as any));
      } catch (err) {
        console.error('Gagal memuat mission_waypoints:', err);
      }
    };

    const fetchCenters = async () => {
      try {
        const { data, error } = await supabase
          .from('Center_Lintasan')
          .select('"Lintasan", "Latitude", "Longititude"');

        if (error) throw error;

        const nextCenters: CenterMap = {};

        if (data && data.length > 0) {
          data.forEach((row: any) => {
            const key = row.Lintasan as string; // contoh: 'lintasan1'
            const lat = row.Latitude as number | null;
            const lon = row.Longititude as number | null;
            if (lat != null && lon != null) {
              nextCenters[key] = [lat, lon];
            }
          });
        }

        // fallback kalau belum ada data sama sekali
        if (!nextCenters['lintasan1']) {
          nextCenters['lintasan1'] = [-7.9154834, 112.5891244];
        }
        if (!nextCenters['lintasan2']) {
          nextCenters['lintasan2'] = [-7.9150524, 112.5888965];
        }

        setCenters(nextCenters);
      } catch (err) {
        console.error('Gagal memuat Center_Lintasan:', err);
      }
    };

    // Fetch awal
    fetchWaypoints();
    fetchCenters();
    fetchInitialData();

    // Realtime: mission_waypoints
    const waypointsSub = supabase
      .channel('mission_waypoints_changes_user')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mission_waypoints' },
        async () => {
          const { data, error } = await supabase
            .from('mission_waypoints')
            .select('mission_name, waypoint_type, latitude, longitude');
          if (!error) setMissionWaypoints(buildWaypointMap((data ?? []) as any));
        }
      )
      .subscribe();

    // Realtime: center lintasan
    const centersSub = supabase
      .channel('center_lintasan_changes_user')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Center_Lintasan' },
        async () => {
          await fetchCenters();
        }
      )
      .subscribe();

    // Realtime: nav_data → evaluasi waypoint
    const navSubscription = supabase
      .channel('nav_data_changes_user')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nav_data' }, (payload) => {
        setNavData((prev) => {
          if (prev?.timestamp) {
            const prevTime = new Date(prev.timestamp).getTime();
            const newTime = new Date(payload.new.timestamp).getTime();
            setUpdateIntervalMs(newTime - prevTime);
          }
          return payload.new as NavDataType;
        });

        const currentPosition: [number, number] = [
          payload.new.latitude,
          payload.new.longitude,
        ];
        const tolerance = 1.5;

        const map = mapStateRef.current;
        const ms = missionStatusRef.current;
        const wpAll = missionWaypointsRef.current;
        const waypoints = wpAll?.[map?.view_type];

        console.log('[NAV] pos:', currentPosition, 'view:', map?.view_type, 'wp:', waypoints);

        if (!waypoints) return;

        if (ms?.mission_persiapan === 'belum') {
          console.log('[NEAR] PERSIAPAN (auto proses)');
          updateMissionStatusInSupabase('mission_persiapan', 'proses');
        }

        if (waypoints.start && isNear(currentPosition, waypoints.start, tolerance)) {
          console.log('[NEAR] START');
          updateMissionStatusInSupabase('mission_persiapan', 'selesai');
          updateMissionStatusInSupabase('mission_start', 'selesai');
          updateMissionStatusInSupabase('mission_buoys', 'proses');
        }

        if (waypoints.buoys && isNear(currentPosition, waypoints.buoys, tolerance)) {
          console.log('[NEAR] BUOYS');
          updateMissionStatusInSupabase('mission_buoys', 'selesai');
        }

        if (
          waypoints.image_surface &&
          isNear(currentPosition, waypoints.image_surface, tolerance)
        ) {
          console.log('[NEAR] IMAGE_SURFACE');
          updateMissionStatusInSupabase('image_atas', 'proses');
        }

        if (
          waypoints.finish &&
          isNear(currentPosition, waypoints.finish, tolerance) &&
          ms?.image_bawah === 'selesai'
        ) {
          console.log('[NEAR] FINISH (image_bawah sudah selesai)');
          updateMissionStatusInSupabase('mission_finish', 'selesai');
        }
      })
      .subscribe();

    const cogSubscription = supabase
      .channel('cog_data_changes_user')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cog_data' }, (payload) => {
        setCogData(payload.new as CogData);
      })
      .subscribe();

    const imageSubscription = supabase
      .channel('mission_images_changes_user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'image_mission' }, async () => {
        const { data: images, error } = await supabase.from('image_mission').select('*');
        if (!error) setMissionImages((images || []) as MissionImage[]);
      })
      .subscribe();

    const missionSubscription = supabase
      .channel('mission_log_changes_user')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'data_mission' }, (payload) => {
        setMissionStatus(payload.new as MissionStatus);
      })
      .subscribe();

    const mapSubscription = supabase
      .channel('map_state_changes_user')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'map_state' }, (payload) => {
        setMapState(payload.new as MapState);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(waypointsSub);
      supabase.removeChannel(centersSub);
      supabase.removeChannel(navSubscription);
      supabase.removeChannel(cogSubscription);
      supabase.removeChannel(imageSubscription);
      supabase.removeChannel(missionSubscription);
      supabase.removeChannel(mapSubscription);
    };
  }, []);

  const handleSelectLintasan = async (lintasan: string) => {
    try {
      // user tidak boleh ubah, jadi kondisi pakai controlsEnabled
      if (!controlsEnabled) return;
      const { error } = await supabase.from('map_state').update({ view_type: lintasan }).eq('id', 1);
      if (error) throw error;
    } catch (error: any) {
      console.error('Failed to update map state:', error);
    }
  };

  const [clicked, setClicked] = useState(false);

  const handleRefresh = async () => {
    if (!controlsEnabled) return;
    setClicked(true);
    setTimeout(() => setClicked(false), 300);
    resetMissionStatus();
    try {
      const { error } = await supabase
        .from('map_state')
        .update({ is_refreshed: true })
        .eq('id', 1);
      if (error) throw error;
    } catch (error: any) {
      console.error('Failed to trigger refresh:', error);
    }
  };

  return (
    <main className="main">
      <section className="gabungan">
        <div className="gabungan-scroll">
          <NavData
            data={navData}
            cogData={cogData}
            errorMessage={errorMessage}
            updateIntervalMs={updateIntervalMs}
          />
          <MissionLog status={missionStatus} />
        </div>

        <img src="/ornamen.png" alt="hiasan" className="ornamen" />
      </section>

      <ImageSection missionImages={missionImages} />

      <section className="mapSection">
        <h2>Lokasi Misi</h2>

        <Map
          navData={navData}
          cogData={cogData}
          mapState={mapState}
          missionWaypoints={missionWaypoints}
          supabase={supabase}
          centers={centers}
        />

        <div className={`mapControls ${!controlsEnabled ? 'no-refresh' : ''}`}>
          <button
            id="lintasan1"
            className={`tombolLintasan ${mapState.view_type === 'lintasan1' ? 'aktif' : ''}`}
            onClick={controlsEnabled ? () => handleSelectLintasan('lintasan1') : undefined}
          >
            Lintasan A
          </button>

          <button
            id="lintasan2"
            className={`tombolLintasan ${mapState.view_type === 'lintasan2' ? 'aktif' : ''}`}
            onClick={controlsEnabled ? () => handleSelectLintasan('lintasan2') : undefined}
          >
            Lintasan B
          </button>

          {controlsEnabled && (
            <button
              id="tombol_refresh"
              className={`tombolRefresh ${clicked ? 'clicked' : ''}`}
              onClick={handleRefresh}
            >
              Refresh
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
