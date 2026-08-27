// ============================================================
// Eternalgy service-area pages - /agent/{state}/{town}
// Each town/sub-area becomes an SEO/AI-indexable page that tells
// residents to call our local agent for solar PV installation.
// ============================================================
// Dependency-free slug helper (mirrors slugify lower+strict):
// lowercase, non-alphanumerics become single dashes, trimmed.
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x';

// ------------------------------------------------------------
// Raw hierarchical data: state -> districts -> towns
// A town entry may be:
//   - a string  ("Kulai")
//   - an object { town, note?, subAreas? } where subAreas are
//     real localities that ALSO get their own pages, and note is
//     a short descriptor shown on the page (not a separate page).
// ------------------------------------------------------------
const STATES = [
  {
    state: 'Johor',
    districts: [
      {
        district: 'Johor Bahru District',
        towns: [
          { town: 'Johor Bahru', note: 'City' },
          'Skudai',
          { town: 'Iskandar Puteri', subAreas: ['Kota Iskandar', 'Medini', 'Puteri Harbour'] },
          'Gelang Patah',
          'Ulu Tiram',
          'Masai',
          'Pasir Gudang',
          'Permas Jaya',
          'Kempas',
          'Kangkar Pulai',
          'Tampoi'
        ]
      },
      {
        district: 'Kulai',
        towns: ['Kulai', 'Senai', 'Saleng', 'Kelapa Sawit', 'Bandar Indahpura']
      },
      {
        district: 'Batu Pahat',
        towns: [
          { town: 'Bandar Penggaram', note: 'Batu Pahat Town' },
          'Yong Peng', 'Ayer Hitam', 'Parit Raja', 'Senggarang', 'Rengit', 'Tongkang Pechah'
        ]
      },
      {
        district: 'Muar',
        towns: [
          { town: 'Bandar Maharani', note: 'Muar Town' },
          'Bakri', 'Bukit Pasir', 'Pagoh', 'Sungai Balang', 'Parit Jawa'
        ]
      },
      {
        district: 'Kluang',
        towns: ['Kluang', 'Simpang Renggam', 'Layang-Layang', 'Machap', 'Renggam', 'Kahang', 'Paloh']
      },
      {
        district: 'Segamat',
        towns: ['Segamat', 'Labis', 'Chaah', 'Jementah', 'Buloh Kasap', 'Bandar Putra', 'Tenang']
      },
      {
        district: 'Kota Tinggi',
        towns: ['Kota Tinggi', 'Bandar Penawar', 'Desaru', { town: 'Sungai Rengit', subAreas: ['Pengerang'] }, 'Teluk Sengat']
      },
      {
        district: 'Pontian',
        towns: ['Pontian Kechil', 'Pekan Nanas', 'Kukup', 'Benut']
      },
      {
        district: 'Tangkak',
        towns: ['Tangkak', 'Bukit Gambir', 'Sungai Mati', 'Sagil']
      },
      {
        district: 'Mersing',
        towns: ['Mersing', 'Endau', 'Jemaluang', 'Penyabong']
      }
    ]
  },
  {
    state: 'Selangor',
    districts: [
      {
        district: 'Petaling',
        towns: [
          'Petaling Jaya', 'Subang Jaya', { town: 'Shah Alam', note: 'partially' }, 'Puchong',
          'Damansara', 'Bandar Sunway', 'Seri Kembangan', { town: 'Sungai Buloh', note: 'partially' }
        ]
      },
      {
        district: 'Klang',
        towns: ['Klang', 'Port Klang', 'Bandar Bukit Tinggi', 'Bandar Baru Klang', 'Pandamaran', 'Kapar', 'Meru']
      },
      {
        district: 'Gombak',
        towns: ['Selayang', 'Rawang', 'Batu Caves', 'Gombak', { town: 'Ampang', note: 'partially' }, 'Kuang', 'Kundang']
      },
      {
        district: 'Hulu Langat',
        towns: ['Kajang', 'Bangi', 'Bandar Baru Bangi', 'Semenyih', { town: 'Cheras', note: 'Selangor side' }, 'Beranang', 'Hulu Langat']
      },
      {
        district: 'Sepang',
        towns: ['Cyberjaya', 'Sepang', 'Dengkil', 'Salak Tinggi', 'Sungai Pelek', 'KLIA area']
      },
      {
        district: 'Kuala Langat',
        towns: ['Banting', 'Telok Panglima Garang', 'Jenjarom', 'Morib', 'Carey Island', 'Jugra']
      },
      {
        district: 'Kuala Selangor',
        towns: ['Kuala Selangor', 'Ijok', { town: 'Bestari Jaya', subAreas: ['Batang Berjuntai'] }, 'Tanjung Karang', 'Jeram', 'Puncak Alam']
      },
      {
        district: 'Hulu Selangor',
        towns: ['Kuala Kubu Bharu', 'Serendah', 'Batang Kali', 'Bukit Beruntung', 'Rasa']
      },
      {
        district: 'Sabak Bernam',
        towns: ['Sabak', 'Sekinchan', 'Sungai Besar']
      }
    ]
  },
  {
    state: 'Penang',
    stateLabel: 'Pulau Pinang',
    districts: [
      {
        district: 'Penang Island (Timur Laut & Barat Daya)',
        towns: ['George Town', 'Bayan Lepas', 'Gelugor', 'Tanjung Tokong', 'Tanjung Bungah', 'Batu Ferringhi', 'Air Itam', 'Jelutong', 'Balik Pulau', 'Teluk Bahang', 'Batu Maung']
      },
      {
        district: 'Mainland / Seberang Perai',
        towns: ['Butterworth', 'Bukit Mertajam', 'Seberang Jaya', 'Perai', 'Nibong Tebal', 'Simpang Ampat', 'Kepala Batas', 'Sungai Bakap', 'Jawi', 'Bertam', 'Alma', 'Valdor']
      }
    ]
  },
  {
    state: 'Perak',
    districts: [
      {
        district: 'Kinta',
        towns: ['Ipoh', 'Batu Gajah', 'Lahat', 'Menglembu', 'Gopeng', 'Chemor', 'Bercham', 'Tambun']
      },
      {
        district: 'Larut, Matang & Selama',
        towns: ['Taiping', 'Kamunting', 'Simpang', 'Kuala Sepetang', 'Matang', 'Selama']
      },
      {
        district: 'Manjung',
        towns: ['Sitiawan', 'Seri Manjung', 'Lumut', 'Pangkor', 'Ayer Tawar', 'Pantai Remis']
      },
      {
        district: 'Hilir Perak & Bagan Datuk',
        towns: ['Teluk Intan', 'Langkap', 'Bagan Datuk', 'Hutan Melintang']
      },
      {
        district: 'Batang Padang & Muallim',
        towns: ['Tapah', 'Bidor', 'Tanjung Malim', 'Slim River', 'Sungkai', 'Proton City']
      },
      {
        district: 'Kuala Kangsar',
        towns: ['Kuala Kangsar', 'Sungai Siput', 'Padang Rengas', 'Enggor']
      },
      {
        district: 'Kampar',
        towns: ['Kampar', 'Malim Nawar', { town: 'Gopeng', note: 'partially' }]
      },
      {
        district: 'Kerian',
        towns: ['Parit Buntar', 'Bagan Serai', 'Kuala Kurau']
      },
      {
        district: 'Perak Tengah & Hulu Perak',
        towns: ['Seri Iskandar', 'Parit', 'Gerik', 'Lenggong', 'Pengkalan Hulu', 'Klian Intan']
      }
    ]
  },
  {
    state: 'Kedah',
    districts: [
      {
        district: 'Kota Setar & Pokok Sena',
        towns: ['Alor Setar', 'Pokok Sena', 'Kuala Kedah', 'Langgar']
      },
      {
        district: 'Kuala Muda',
        towns: ['Sungai Petani', 'Bedong', 'Gurun', 'Tikam Batu', 'Semeling']
      },
      {
        district: 'Kulim & Bandar Baharu',
        towns: ['Kulim', 'Kulim Hi-Tech Park', 'Lunas', 'Padang Serai', 'Bandar Baharu', 'Serdang']
      },
      {
        district: 'Kubang Pasu',
        towns: ['Jitra', 'Changlun', 'Bukit Kayu Hitam', 'Kodiang', 'Sintok']
      },
      {
        district: 'Langkawi',
        towns: ['Kuah', 'Padang Matsirat', 'Pantai Cenang']
      },
      {
        district: 'Baling, Sik, Yan, Padang Terap',
        towns: ['Baling', 'Kuala Ketil', 'Sik', 'Yan', 'Guar Chempedak', 'Kuala Nerang']
      }
    ]
  },
  {
    state: 'Negeri Sembilan',
    districts: [
      {
        district: 'Seremban',
        towns: ['Seremban', 'Seremban 2', 'Nilai', 'Bandar Enstek', 'Senawang', 'Mantin', 'Labu', 'Rantau']
      },
      {
        district: 'Port Dickson',
        towns: ['Port Dickson', 'Lukut', 'Teluk Kemang', 'Pasir Panjang', 'Linggi']
      },
      {
        district: 'Jempol & Kuala Pilah',
        towns: ['Bahau', 'Bandar Seri Jempol', 'Batu Kikir', 'Kuala Pilah', 'Juasseh']
      },
      {
        district: 'Tampin, Rembau & Jelebu',
        towns: ['Tampin', 'Gemas', 'Rembau', 'Pedas', 'Kuala Klawang', 'Titi']
      }
    ]
  },
  {
    state: 'Melaka',
    stateLabel: 'Melaka (Malacca)',
    districts: [
      {
        district: 'Melaka Tengah',
        towns: ['Melaka City', 'Ayer Keroh', 'Batu Berendam', 'Klebang', 'Bukit Baru', 'Tanjung Kling', 'Sungai Udang']
      },
      {
        district: 'Alor Gajah',
        towns: ['Alor Gajah', 'Masjid Tanah', 'Pulau Sebang', 'Durian Tunggal', { town: 'Simpang Ampat', note: 'Melaka' }, 'Lubok China']
      },
      {
        district: 'Jasin',
        towns: ['Jasin', 'Merlimau', 'Asahan', 'Bemban', 'Sungai Rambai']
      }
    ]
  },
  {
    state: 'Pahang',
    districts: [
      {
        district: 'Kuantan',
        towns: ['Kuantan', 'Indera Mahkota', 'Teluk Cempedak', 'Gambang', 'Beserah', 'Balok', 'Gebeng', 'Sungai Lembing']
      },
      {
        district: 'Temerloh & Bera',
        towns: ['Temerloh', 'Mentakab', 'Lanchang', 'Kuala Krau', 'Bandar Bera', 'Triang']
      },
      {
        district: 'Bentong',
        towns: ['Bentong', 'Genting Highlands', 'Karak', 'Telemong']
      },
      {
        district: 'Cameron Highlands',
        towns: ['Tanah Rata', 'Brinchang', 'Ringlet', 'Kampung Raja', 'Tringkap']
      },
      {
        district: 'Raub & Lipis',
        towns: ['Raub', 'Sungai Ruan', 'Tras', 'Kuala Lipis', 'Benta', 'Padang Tengku']
      },
      {
        district: 'Jerantut, Maran, Pekan & Rompin',
        towns: ['Jerantut', 'Maran', 'Pekan', 'Kuala Rompin', 'Tioman Island', 'Muadzam Shah']
      }
    ]
  },
  {
    state: 'Kelantan',
    districts: [
      {
        district: 'Kota Bharu',
        towns: ['Kota Bharu', 'Kubang Kerian', 'Pengkalan Chepa', 'Wakaf Che Yeh', 'Ketereh']
      },
      {
        district: 'Pasir Mas & Tumpat',
        towns: ['Pasir Mas', 'Rantau Panjang', 'Tumpat', 'Wakaf Bharu', 'Pengkalan Kubor']
      },
      {
        district: 'Tanah Merah, Machang & Kuala Krai',
        towns: ['Tanah Merah', 'Machang', 'Kuala Krai', 'Dabong']
      },
      {
        district: 'Pasir Puteh & Bachok',
        towns: ['Pasir Puteh', 'Cherang Ruku', 'Bachok', 'Jelawat']
      },
      {
        district: 'Gua Musang & Jeli',
        towns: ['Gua Musang', 'Jeli', 'Lojing']
      }
    ]
  },
  {
    state: 'Terengganu',
    districts: [
      {
        district: 'Kuala Terengganu & Kuala Nerus',
        towns: ['Kuala Terengganu', 'Gong Badak', 'Batu Rakit', 'Wakaf Tengah', 'Seberang Takir']
      },
      {
        district: 'Kemaman',
        towns: [{ town: 'Chukai', note: 'Kemaman Town' }, 'Kerteh', 'Kijal', 'Kemasik', 'Air Jernih']
      },
      {
        district: 'Dungun',
        towns: ['Kuala Dungun', 'Paka', 'Bandar Al-Muktafi Billah Shah', 'Rantau Abang']
      },
      {
        district: 'Besut & Setiu',
        towns: ['Jerteh', 'Kuala Besut', 'Bandar Permaisuri']
      },
      {
        district: 'Hulu Terengganu & Marang',
        towns: ['Kuala Berang', 'Ajil', 'Marang', 'Bukit Payung']
      }
    ]
  },
  {
    state: 'Perlis',
    districts: [
      {
        district: 'Perlis',
        towns: [
          { town: 'Kangar', note: 'State Capital' },
          { town: 'Arau', note: 'Royal Town' },
          'Padang Besar', 'Kuala Perlis', 'Simpang Empat', 'Kaki Bukit'
        ]
      }
    ]
  },
  {
    state: 'Federal Territories',
    districts: [
      {
        district: 'Kuala Lumpur (Major Suburbs / Sectors)',
        towns: ['KLCC / Golden Triangle', 'Bukit Bintang', 'Bangsar', 'Mont Kiara', 'Sri Hartamas', 'Kepong', 'Setapak', 'Wangsa Maju', { town: 'Cheras', note: 'KL side' }, 'OUG', 'Kuchai Lama', 'Bukit Jalil', 'Sungai Besi', 'Segambut', 'Sentul']
      },
      {
        district: 'Putrajaya (Precincts)',
        towns: Array.from({ length: 20 }, (_, i) => 'Presint ' + (i + 1))
      }
    ]
  }
];

// ------------------------------------------------------------
// Build a flat list of town records (each becomes a page).
// Sub-areas become their own pages too.
// ------------------------------------------------------------
const towns = [];

STATES.forEach((st) => {
  const stateName = st.stateLabel || st.state;
  st.districts.forEach((d) => {
    const pushTown = (display, extra) => {
      const rec = {
        state: st.state,
        stateName,
        stateSlug: slug(st.state),
        district: d.district,
        town: display,
        townSlug: slug(display),
        note: extra.note || '',
        parent: extra.parent || '',
        subAreas: extra.subAreas || []
      };
      towns.push(rec);
    };

    d.towns.forEach((t) => {
      if (typeof t === 'string') {
        pushTown(t, {});
      } else {
        const note = t.note || '';
        const subAreas = t.subAreas || [];
        pushTown(t.town, { note, subAreas });
        subAreas.forEach((sa) => pushTown(sa, { parent: t.town }));
      }
    });
  });
});

// ------------------------------------------------------------
// District-name pages: localities commonly searched by their
// district name that aren't already covered by a same-named town
// (e.g. "Batu Pahat", "Muar", "Langkawi", "Cameron Highlands").
// Skipped automatically when a town page already owns that slug.
// ------------------------------------------------------------
const DISTRICT_PAGES = [
  { state: 'Johor', district: 'Batu Pahat' },
  { state: 'Johor', district: 'Muar' },
  { state: 'Johor', district: 'Pontian' },
  { state: 'Selangor', district: 'Petaling' },
  { state: 'Selangor', district: 'Hulu Langat' },
  { state: 'Selangor', district: 'Hulu Selangor' },
  { state: 'Selangor', district: 'Kuala Langat' },
  { state: 'Selangor', district: 'Sabak Bernam' },
  { state: 'Kedah', district: 'Langkawi' },
  { state: 'Pahang', district: 'Cameron Highlands' },
  { state: 'Terengganu', district: 'Kemaman' },
  { state: 'Terengganu', district: 'Dungun' },
  { state: 'Terengganu', district: 'Besut' }
];

DISTRICT_PAGES.forEach((dp) => {
  const st = STATES.find((s) => s.state === dp.state);
  if (!st) return;
  const d = st.districts.find((dd) => dd.district === dp.district
    || dd.district.indexOf(dp.district) === 0);
  if (!d) return;
  const stateName = st.stateLabel || st.state;
  const stateSlug = slug(st.state);
  const townSlug = slug(dp.district);
  // Skip if a town page already owns this slug in the same state.
  if (towns.some((t) => t.stateSlug === stateSlug && t.townSlug === townSlug)) return;
  towns.push({
    state: st.state,
    stateName,
    stateSlug,
    district: d.district,
    town: dp.district,
    townSlug,
    note: 'District',
    parent: '',
    subAreas: [],
    isDistrict: true
  });
});

// ------------------------------------------------------------
// De-duplicate town pages (same state + town slug), merging notes
// so a town listed under two districts yields a single page.
// ------------------------------------------------------------
const seenKeys = new Set();
const deduped = [];
towns.forEach((t) => {
  const key = t.stateSlug + '/' + t.townSlug;
  if (seenKeys.has(key)) {
    const existing = deduped.find((x) => x.stateSlug + '/' + x.townSlug === key);
    if (existing) {
      if (!existing.note && t.note) existing.note = t.note;
      if (!existing.isDistrict && t.isDistrict) existing.isDistrict = true;
    }
    return;
  }
  seenKeys.add(key);
  deduped.push(t);
});
towns.length = 0;
towns.push(...deduped);

// ------------------------------------------------------------
// Agent assignment: distribute the agent list evenly across all
// town pages (round-robin). Falls back to the main line when the
// agents list is empty.
// ------------------------------------------------------------
const agents = require('./agents');

const toWa = (phone) => {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('60')) return digits;
  if (digits.startsWith('0')) return '60' + digits.slice(1);
  return '60' + digits;
};

if (agents.length > 0) {
  towns.forEach((t, i) => {
    const agent = agents[i % agents.length];
    t.agent = {
      name: agent.name || 'our solar agent',
      phone: agent.phone || '+60 11-2100 0099',
      wa: toWa(agent.phone) || '601121000099'
    };
  });
}

// ------------------------------------------------------------
// Lookup helpers
// ------------------------------------------------------------
const bySlug = (stateSlug, townSlug) =>
  towns.find((t) => t.stateSlug === stateSlug && t.townSlug === townSlug) || null;

const townsByState = (stateSlug) =>
  towns.filter((t) => t.stateSlug === stateSlug);

const states = [];
STATES.forEach((st) => {
  states.push({
    state: st.state,
    stateName: st.stateLabel || st.state,
    stateSlug: slug(st.state),
    townCount: towns.filter((t) => t.stateSlug === slug(st.state)).length,
    districts: st.districts.map((d) => ({
      district: d.district,
      towns: towns.filter((t) => t.stateSlug === slug(st.state) && t.district === d.district)
    }))
  });
});

module.exports = { STATES, towns, states, bySlug, townsByState };
