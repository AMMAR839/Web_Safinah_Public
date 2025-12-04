import React from 'react';

interface MissionStatus {
  mission_persiapan: string;
  mission_start: string;
  mission_buoys: string;
  image_atas: string;
  image_bawah: string;
  mission_finish: string;
}

interface MissionLogProps {
  status: MissionStatus | null;
}

// mapping status string -> class CSS
const getStatusClass = (value?: string | null) => {
  const v = (value || '').toLowerCase().trim();

  // apapun yang status-nya proses / persiapan → kuning
  if (v === 'proses' || v === 'persiapan') return 'kotak-proses';

  // selesai → hijau
  if (v === 'selesai') return 'kotak-selesai';

  // default / belum / null / aneh-aneh → merah
  return 'kotak-belum';
};

const MissionLog: React.FC<MissionLogProps> = ({ status }) => {
  // kalau status masih null (belum ke-fetch), kasih default 'belum'
  const s: MissionStatus = status ?? {
    mission_persiapan: 'belum',
    mission_start: 'belum',
    mission_buoys: 'belum',
    image_atas: 'belum',
    image_bawah: 'belum',
    mission_finish: 'belum',
  };

  return (
    <section className="missionSection">
      <h2>Position Log</h2>
      <div className="dataMission">
        <div className={getStatusClass(s.mission_persiapan)}>
          <p>Persiapan</p>
        </div>
        <div className={getStatusClass(s.mission_start)}>
          <p>Start</p>
        </div>
        <div className={getStatusClass(s.mission_buoys)}>
          <p>Floating ball set</p>
        </div>
        <div className={getStatusClass(s.image_atas)}>
          <p>Surface Imaging</p>
        </div>
        <div className={getStatusClass(s.image_bawah)}>
          <p>Underwater Imaging</p>
        </div>
        <div className={getStatusClass(s.mission_finish)}>
          <p>Finish</p>
        </div>
      </div>
    </section>
  );
};

export default MissionLog;
