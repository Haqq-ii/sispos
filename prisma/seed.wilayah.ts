/**
 * prisma/seed.wilayah.ts
 *
 * Seed data wilayah lengkap: DI Yogyakarta, Jawa Tengah, Jawa Timur
 * sampai level kelurahan (target >= 1500 records).
 *
 * Cara jalankan (dari dalam container backend):
 *   docker compose exec sispos-backend npx ts-node --project tsconfig.json prisma/seed.wilayah.ts
 * atau:
 *   docker compose exec sispos-backend npx tsx prisma/seed.wilayah.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================
// Tipe data hierarki
// ============================================================

type KelurahanList = string[]
type KecamatanMap = Record<string, KelurahanList>
type KabupatenMap = Record<string, KecamatanMap>
type WilayahTree = Record<string, KabupatenMap>

interface WilayahRecord {
  provinsi: string
  kabupaten: string
  kecamatan: string
  kelurahan: string
}

function flattenTree(tree: WilayahTree): WilayahRecord[] {
  const records: WilayahRecord[] = []
  for (const [provinsi, kabupatenMap] of Object.entries(tree)) {
    for (const [kabupaten, kecamatanMap] of Object.entries(kabupatenMap)) {
      for (const [kecamatan, kelurahanList] of Object.entries(kecamatanMap)) {
        for (const kelurahan of kelurahanList) {
          records.push({ provinsi, kabupaten, kecamatan, kelurahan })
        }
      }
    }
  }
  return records
}

// ============================================================
// DI YOGYAKARTA
// ============================================================

const diyTree: WilayahTree = {
  'DI Yogyakarta': {
    'Kota Yogyakarta': {
      'Mantrijeron': ['Mantrijeron', 'Gedongkiwo', 'Suryodiningratan'],
      'Kraton': ['Panembahan', 'Kadipaten', 'Patehan'],
      'Mergangsan': ['Wirogunan', 'Brontokusuman', 'Keparakan'],
      'Umbulharjo': ['Semaki', 'Muja Muju', 'Tahunan', 'Sorosutan', 'Pandeyan', 'Warungboto', 'Giwangan'],
      'Kotagede': ['Prenggan', 'Purbayan', 'Rejowinangun'],
      'Gondokusuman': ['Baciro', 'Demangan', 'Kotabaru', 'Klitren', 'Terban'],
      'Danurejan': ['Bausasran', 'Suryatmajan', 'Tegalpanggung'],
      'Pakualaman': ['Gunungketur', 'Purwokinanti'],
      'Gondomanan': ['Ngupasan', 'Prawirodirjan'],
      'Ngampilan': ['Ngampilan', 'Notoprajan'],
      'Wirobrajan': ['Patangpuluhan', 'Wirobrajan', 'Pakuncen'],
      'Gedongtengen': ['Pringgokusuman', 'Sosromenduran'],
      'Jetis': ['Bumijo', 'Cokrodiningratan', 'Gowongan'],
      'Tegalrejo': ['Bener', 'Karangwaru', 'Kricak', 'Tegalrejo'],
    },
    'Kabupaten Sleman': {
      'Depok': ['Caturtunggal', 'Condongcatur', 'Maguwoharjo'],
      'Mlati': ['Sinduadi', 'Sumberadi', 'Tlogoadi', 'Sendangadi', 'Tirtoadi'],
      'Gamping': ['Ambarketawang', 'Banyuraden', 'Nogotirto', 'Trihanggo', 'Balecatur'],
      'Godean': ['Sidoagung', 'Sidokarto', 'Sidomoyo', 'Sidorejo', 'Sidomulyo', 'Sidoluhur', 'Sidorahayu', 'Sidoarum'],
      'Sleman': ['Caturharjo', 'Triharjo', 'Tridadi', 'Pandowoharjo', 'Sumberrejo'],
      'Ngaglik': ['Donoharjo', 'Sardonoharjo', 'Sukoharjo', 'Minomartani', 'Sariharjo', 'Sinduharjo'],
      'Kalasan': ['Purwomartani', 'Selomartani', 'Tirtomartani', 'Tamanmartani'],
      'Berbah': ['Jogotirto', 'Tegaltirto', 'Sendangtirto', 'Kalitirto'],
      'Moyudan': ['Sumberrahayu', 'Sumberarum', 'Sumbersari', 'Sumberagung'],
      'Minggir': ['Sendangagung', 'Sendangmulyo', 'Sendangrejo', 'Sendangarum', 'Sendangsari'],
      'Seyegan': ['Margomulyo', 'Margodadi', 'Margoagung', 'Margoluwih', 'Margokaton'],
      'Tempel': ['Merdikorejo', 'Lumbungrejo', 'Pondokrejo', 'Sumberrejo', 'Tambakrejo', 'Banyurejo', 'Mororejo', 'Margorejo'],
      'Turi': ['Bangunkerto', 'Donokerto', 'Girikerto', 'Wonokerto'],
      'Pakem': ['Candibinangun', 'Harjobinangun', 'Hargobinangun', 'Pakembinangun', 'Purwobinangun'],
      'Cangkringan': ['Argomulyo', 'Wukirsari', 'Glagaharjo', 'Kepuharjo', 'Umbulharjo'],
      'Ngemplak': ['Wedomartani', 'Sindumartani', 'Umbulmartani', 'Widodomartani', 'Bimomartani'],
      'Prambanan': ['Bokoharjo', 'Gayamharjo', 'Madurejo', 'Sumberharjo', 'Wukirharjo', 'Sambirejo'],
    },
    'Kabupaten Bantul': {
      'Bantul': ['Bantul', 'Trirenggo', 'Ringinharjo', 'Palbapang', 'Sabdodadi'],
      'Sewon': ['Pendowoharjo', 'Panggungharjo', 'Timbulharjo', 'Bangunharjo'],
      'Kasihan': ['Bangunjiwo', 'Ngestiharjo', 'Tamantirto', 'Tirtonirmolo'],
      'Pajangan': ['Sendangsari', 'Triwidadi', 'Guwosari'],
      'Pandak': ['Gilangharjo', 'Caturharjo', 'Triharjo', 'Wijirejo'],
      'Bambanglipuro': ['Mulyodadi', 'Sidomulyo', 'Sumbermulyo'],
      'Pundong': ['Seloharjo', 'Srihardono', 'Panjangrejo'],
      'Imogiri': ['Imogiri', 'Sriharjo', 'Girirejo', 'Selopamioro', 'Karangtalun', 'Karangtengah', 'Wukirsari', 'Kebonagung'],
      'Dlingo': ['Dlingo', 'Mangunan', 'Muntuk', 'Terong', 'Temuwuh', 'Jatimulyo'],
      'Pleret': ['Pleret', 'Bawuran', 'Wonokromo', 'Segoroyoso', 'Wonolelo'],
      'Piyungan': ['Sitimulyo', 'Srimulyo', 'Sitimulyo'],
      'Banguntapan': ['Banguntapan', 'Baturetno', 'Jagalan', 'Jambidan', 'Singosaren', 'Tamanan', 'Wirokerten'],
      'Jetis': ['Canden', 'Patalan', 'Sumberagung', 'Trimulyo'],
      'Sedayu': ['Argodadi', 'Argomulyo', 'Argorejo', 'Argosari'],
      'Kretek': ['Tirtomulyo', 'Donotirto', 'Parangtritis', 'Sindumartani', 'Tirtosari'],
      'Sanden': ['Gadingharjo', 'Murtigading', 'Gadingsari', 'Srigading'],
      'Srandakan': ['Trimurti', 'Poncosari'],
    },
    'Kabupaten Kulonprogo': {
      'Wates': ['Wates', 'Triharjo', 'Bendungan', 'Giripeni', 'Sogan', 'Kulwaru', 'Ngestiharjo', 'Karangpoci'],
      'Pengasih': ['Pengasih', 'Sendangsari', 'Kedungsari', 'Karangsari', 'Margosari', 'Sidomulyo', 'Clereng', 'Tawangsari'],
      'Sentolo': ['Sentolo', 'Demangrejo', 'Sukoreno', 'Banguncipto', 'Kaliagung', 'Tuksono'],
      'Nanggulan': ['Wijimulyo', 'Donomulyo', 'Jatisarono', 'Kembang', 'Banyuroto', 'Tanjungharjo'],
      'Galur': ['Tirtorahayu', 'Nomporejo', 'Banaran', 'Brosot', 'Karangsewu', 'Kranggan', 'Pandowan', 'Pulo'],
      'Panjatan': ['Gotakan', 'Panjatan', 'Bojong', 'Bugel', 'Cerme', 'Depok', 'Garongan', 'Tayuban', 'Kanoman', 'Pleret'],
      'Temon': ['Temon Kulon', 'Temon Wetan', 'Jangkaran', 'Sindutan', 'Palihan', 'Kebonrejo', 'Glagah'],
      'Kokap': ['Hargomulyo', 'Hargotirto', 'Hargorejo', 'Hargowilis', 'Kalirejo'],
      'Girimulyo': ['Giripurwo', 'Purwosari', 'Pendoworejo', 'Jatimulyo'],
      'Samigaluh': ['Kebonharjo', 'Sidoharjo', 'Banjarsari', 'Gerbosari', 'Ngargosari', 'Purwoharjo', 'Pagerharjo'],
      'Kalibawang': ['Banjarharjo', 'Banjararum', 'Banjarasri', 'Banjarsari'],
      'Lendah': ['Gulurejo', 'Jatirejo', 'Sidorejo', 'Wahyuharjo', 'Bumirejo', 'Ngentakrejo'],
    },
    'Kabupaten Gunungkidul': {
      'Wonosari': ['Wonosari', 'Kepek', 'Karangrejek', 'Desa Wonosari', 'Baleharjo', 'Selang', 'Siraman', 'Pulutan', 'Wunung', 'Karangmojo'],
      'Playen': ['Playen', 'Dengok', 'Bleberan', 'Bunder', 'Getas', 'Gading', 'Logandeng', 'Ngleri', 'Ngunut', 'Plembutan', 'Salam', 'Bandung'],
      'Patuk': ['Patuk', 'Semoyo', 'Ngoro-Oro', 'Nglanggeran', 'Terbah', 'Beji', 'Bunder', 'Pengkok', 'Salam'],
      'Paliyan': ['Giring', 'Paliyan', 'Mulusan', 'Karangduwet', 'Karangasem', 'Sodo'],
      'Saptosari': ['Jetis', 'Ngloro', 'Planjan', 'Pringapus', 'Krambilsawit', 'Kepek', 'Monggol'],
      'Tepus': ['Tepus', 'Giripanggung', 'Sidoharjo', 'Sumberwungu', 'Purwodadi'],
      'Tanjungsari': ['Kemadang', 'Ngestirejo', 'Banjarejo', 'Hargosari'],
      'Semanu': ['Semanu', 'Candirejo', 'Ngeposari', 'Pacarejo', 'Dadapayu'],
      'Karangmojo': ['Karangmojo', 'Bejiharjo', 'Ngipak', 'Gedangrejo', 'Wiladeg', 'Kelor', 'Bendungan'],
      'Nglipar': ['Nglipar', 'Kedungpoh', 'Pilangrejo', 'Pengkol', 'Natah', 'Katongan'],
      'Semin': ['Semin', 'Kalitekuk', 'Rejosari', 'Bulurejo', 'Candirejo', 'Pundungsari', 'Kemejing', 'Bendung'],
      'Ponjong': ['Ponjong', 'Bedoyo', 'Genjahan', 'Kenteng', 'Umbulrejo', 'Sawahan', 'Sidorejo', 'Karangasem'],
      'Rongkop': ['Melikan', 'Semugih', 'Petir', 'Botodayaan', 'Bohol', 'Pringombo'],
      'Purwosari': ['Giritirto', 'Giriasih', 'Giripurwo', 'Giricahyo'],
      'Panggang': ['Girimulyo', 'Giriharjo', 'Giriasih', 'Girisuko', 'Girisekar', 'Giriwungu'],
      'Gedangsari': ['Tegalrejo', 'Sampang', 'Mertelu', 'Watugajah', 'Ngalang', 'Hargomulyo', 'Serut'],
      'Ngawen': ['Kampung', 'Jurangjero', 'Tancep', 'Sambirejo', 'Beji', 'Watusigar'],
    },
  },
}

// ============================================================
// JAWA TENGAH
// ============================================================

const jatengTree: WilayahTree = {
  'Jawa Tengah': {
    'Kota Semarang': {
      'Semarang Tengah': ['Sekayu', 'Miroto', 'Kauman', 'Bangunharjo', 'Jagalan'],
      'Semarang Selatan': ['Pleburan', 'Lamper Lor', 'Mugassari', 'Bulustalan', 'Lamper Tengah'],
      'Semarang Utara': ['Bulu Lor', 'Panggung Lor', 'Plombokan', 'Kuningan', 'Dadapsari'],
      'Gajahmungkur': ['Gajahmungkur', 'Karangrejo', 'Bendan Ngisor', 'Bendan Duwur', 'Lempongsari'],
      'Candisari': ['Candi', 'Jatingaleh', 'Kaliwiru', 'Jomblang', 'Karanganyar Gunung'],
      'Tembalang': ['Tembalang', 'Bulusan', 'Kramas', 'Sendangmulyo', 'Mangunharjo'],
      'Banyumanik': ['Banyumanik', 'Srondol Wetan', 'Pudakpayung', 'Jabungan', 'Padangsari'],
      'Pedurungan': ['Pedurungan Tengah', 'Tlogosari Wetan', 'Kalicari', 'Gemah', 'Muktiharjo Kidul'],
    },
    'Kabupaten Semarang': {
      'Ungaran Barat': ['Ungaran', 'Genuk', 'Bandarjo', 'Langensari', 'Candirejo'],
      'Ungaran Timur': ['Leyangan', 'Sidomulyo', 'Kalongan', 'Susukan', 'Mluweh'],
      'Banyubiru': ['Banyubiru', 'Kebondowo', 'Banyukuning', 'Gedong', 'Rowoboni'],
      'Ambarawa': ['Panjang', 'Lodoyong', 'Pojoksari', 'Kupang', 'Kranggan'],
    },
    'Kota Surakarta': {
      'Banjarsari': ['Banyuanyar', 'Sumber', 'Nusukan', 'Kadipiro', 'Joglo'],
      'Laweyan': ['Laweyan', 'Pajang', 'Bumi', 'Sriwedari', 'Penumping'],
      'Serengan': ['Kemlayan', 'Serengan', 'Kratonan', 'Jayengan', 'Tipes'],
      'Pasar Kliwon': ['Kampung Baru', 'Pasar Kliwon', 'Joyontakan', 'Kedunglumbu', 'Gajahan'],
      'Jebres': ['Jebres', 'Mojosongo', 'Pucang Sawit', 'Tegalharjo', 'Sudiroprajan'],
    },
    'Kabupaten Klaten': {
      'Klaten Tengah': ['Klaten', 'Tonggalan', 'Bareng', 'Gergunung', 'Gayamprit'],
      'Klaten Selatan': ['Merbung', 'Trunuh', 'Tegalyoso', 'Glodogan', 'Joho'],
      'Klaten Utara': ['Gergunung', 'Bareng', 'Sekarsuli', 'Dengkeng', 'Ngerangan'],
      'Prambanan': ['Prambanan', 'Bugisan', 'Bojongan', 'Kebondalem Kidul', 'Pereng'],
    },
    'Kabupaten Magelang': {
      'Mertoyudan': ['Mertoyudan', 'Pasuruhan', 'Danurejo', 'Jogonegoro', 'Banyuurip'],
      'Muntilan': ['Muntilan', 'Gunungpring', 'Congkrang', 'Pucungrejo', 'Sedangagung'],
      'Mungkid': ['Mungkid', 'Progowati', 'Paremono', 'Rambeanak', 'Sumberrejo'],
    },
    'Kota Magelang': {
      'Magelang Tengah': ['Cacaban', 'Magelang', 'Kemirirejo', 'Panjang', 'Rejowinangun Selatan'],
      'Magelang Selatan': ['Tidar Selatan', 'Jurang Ombo Utara', 'Rejowinangun Utara', 'Tidar Utara'],
      'Magelang Utara': ['Kedungsari', 'Potrobangsan', 'Kramat Selatan', 'Kramat Utara'],
    },
    'Kabupaten Purworejo': {
      'Purworejo': ['Purworejo', 'Sindurjan', 'Pangen Gudang', 'Pangen Juru Tengah', 'Baledono'],
      'Kutoarjo': ['Kutoarjo', 'Semawung Daleman', 'Karangduwur', 'Suren', 'Wirun'],
      'Bayan': ['Bayan', 'Krandegan', 'Kwarasan', 'Ketawangrejo'],
    },
    'Kabupaten Temanggung': {
      'Temanggung': ['Temanggung I', 'Temanggung II', 'Tlogorejo', 'Kowangan', 'Jurang'],
      'Parakan': ['Parakan Kauman', 'Parakan Wetan', 'Campursari', 'Depok', 'Traji'],
      'Kedu': ['Kedu', 'Candirejo', 'Mergowati', 'Ngadimulyo'],
    },
    'Kabupaten Kebumen': {
      'Kebumen': ['Kebumen', 'Tamanwinangun', 'Muktisari', 'Bumirejo', 'Kalirejo'],
      'Gombong': ['Gombong', 'Semanding', 'Wero', 'Klopogoro', 'Banjarsari'],
      'Karanganyar': ['Karanganyar', 'Tersobo', 'Kalibening', 'Wonokerto', 'Plarangan'],
    },
    'Kabupaten Boyolali': {
      'Boyolali': ['Boyolali', 'Kiringan', 'Banaran', 'Karanggeneng', 'Siswodipuran'],
      'Ngemplak': ['Ngargorejo', 'Donohudan', 'Sawahan', 'Gagaksipat', 'Mangu'],
      'Banyudono': ['Trayu', 'Bendan', 'Cangkringan', 'Banyudono', 'Bangak'],
    },
    'Kabupaten Sukoharjo': {
      'Sukoharjo': ['Begajah', 'Jetis', 'Kenep', 'Mandan', 'Gayam'],
      'Kartasura': ['Kartasura', 'Ngadirejo', 'Pucangan', 'Ngabeyan', 'Singopuran'],
      'Grogol': ['Grogol', 'Madegondo', 'Manang', 'Gedangan', 'Parangjoro'],
    },
    'Kabupaten Wonogiri': {
      'Wonogiri': ['Wonokarto', 'Pokoh Kidul', 'Wonoboyo', 'Nambangan Lor', 'Giripurwo'],
      'Selogiri': ['Jendi', 'Pule', 'Kaliancar', 'Gemantar', 'Kepatihan'],
      'Jatipurno': ['Jatipurno', 'Girimargo', 'Balepanjang', 'Slogohimo'],
    },
    'Kabupaten Karanganyar': {
      'Karanganyar': ['Karanganyar', 'Tegalgede', 'Jantiharjo', 'Popongan', 'Bejen'],
      'Colomadu': ['Gawanan', 'Malangjiwan', 'Tohudan', 'Blulukan', 'Bolon'],
      'Jaten': ['Jaten', 'Dagen', 'Jetis', 'Ngringo', 'Sroyo'],
    },
    'Kabupaten Sragen': {
      'Sragen': ['Sragen Kulon', 'Sragen Tengah', 'Nglorog', 'Sine', 'Kroyo'],
      'Sidoharjo': ['Jati', 'Setren', 'Kacangan', 'Purwosuman', 'Patihan'],
      'Gemolong': ['Gemolong', 'Brangkal', 'Nganti', 'Tegaldowo', 'Purworejo'],
    },
    'Kabupaten Kudus': {
      'Kudus': ['Kauman', 'Demaan', 'Panjunan', 'Janggalan', 'Langgardalem'],
      'Jati': ['Jati Wetan', 'Getas Pejaten', 'Pasuruhan Lor', 'Loram Wetan', 'Loram Kulon'],
      'Mejobo': ['Mejobo', 'Hadiwarno', 'Kesambi', 'Golantepus', 'Temulus'],
    },
    'Kabupaten Jepara': {
      'Jepara': ['Saripan', 'Demaan', 'Panggang', 'Potroyudan', 'Bapangan'],
      'Tahunan': ['Tahunan', 'Mantingan', 'Krapyak', 'Ngabul', 'Petekeyan'],
      'Mlonggo': ['Mlonggo', 'Jambu', 'Suwawal', 'Blingoh', 'Telukawur'],
    },
    'Kabupaten Pati': {
      'Pati': ['Pati Kidul', 'Pati Lor', 'Plangitan', 'Winong', 'Parenggan'],
      'Gabus': ['Tlogoayu', 'Gabus', 'Babalan', 'Kosekan', 'Kayen'],
      'Jakenan': ['Jakenan', 'Tondomulyo', 'Trimulyo', 'Gosono', 'Bungasrejo'],
    },
    'Kabupaten Demak': {
      'Demak': ['Bintoro', 'Mangunjiwan', 'Mulyorejo', 'Turirejo', 'Katonsari'],
      'Mranggen': ['Mranggen', 'Bandungrejo', 'Batursari', 'Brumbungan', 'Kebonbatur'],
      'Karangawen': ['Karangawen', 'Sidomulyo', 'Rejosari', 'Bumirejo', 'Margohayu'],
    },
    'Kabupaten Grobogan': {
      'Purwodadi': ['Purwodadi', 'Danyang', 'Kuripan', 'Kalongan', 'Pohsari'],
      'Wirosari': ['Wirosari', 'Karangasem', 'Tambahrejo', 'Gedangan', 'Dokoro'],
      'Godong': ['Godong', 'Bugel', 'Tumbrep', 'Harjowinangun', 'Manggarmas'],
    },
    'Kabupaten Blora': {
      'Blora': ['Kauman', 'Mlangsen', 'Bangkle', 'Blorabaru', 'Kunden'],
      'Cepu': ['Cepu', 'Balun', 'Karang Boyo', 'Ngraho', 'Mulyorejo'],
      'Randublatung': ['Randublatung', 'Pilang', 'Wado', 'Ngliron', 'Bodeh'],
    },
    'Kabupaten Rembang': {
      'Rembang': ['Magersari', 'Leteh', 'Pasar Banggi', 'Kabongan Kidul', 'Tasikagung'],
      'Lasem': ['Lasem', 'Soditan', 'Sumbergirang', 'Karangtengah', 'Jolotundo'],
      'Kragan': ['Kragan', 'Tegalmulyo', 'Pandangan Wetan', 'Pambon', 'Terjan'],
    },
    'Kota Salatiga': {
      'Argomulyo': ['Cebongan', 'Ledok', 'Tegalrejo', 'Randuacir', 'Kumpulrejo'],
      'Tingkir': ['Tingkir Lor', 'Tingkir Tengah', 'Kalibening', 'Sidorejo Kidul', 'Gendongan'],
      'Sidorejo': ['Blotongan', 'Bugel', 'Sidorejo Lor', 'Pulutan', 'Kauman Kidul'],
    },
    'Kabupaten Wonosobo': {
      'Wonosobo': ['Wonosobo Timur', 'Wonosobo Barat', 'Jaraksari', 'Sambek', 'Kalibeber'],
      'Mojotengah': ['Mojosari', 'Kejajar', 'Blederan', 'Bumirejo', 'Tirto'],
      'Selomerto': ['Selomerto', 'Mlipak', 'Tegalgot', 'Krasak'],
    },
    'Kabupaten Banjarnegara': {
      'Banjarnegara': ['Parakancanggah', 'Kutabanjarnegara', 'Ampelsari', 'Krandegan', 'Sokanandi'],
      'Purwareja Klampok': ['Kaliori', 'Pagak', 'Kecitran', 'Gumelem Kulon', 'Gumelem Wetan'],
      'Purwanegara': ['Purwanegara', 'Kalimandi', 'Bandingan', 'Merden', 'Karanganyar'],
      'Sigaluh': ['Sigaluh', 'Kendaga', 'Karangjambe', 'Bandingan'],
      'Mandiraja': ['Mandiraja Kulon', 'Mandiraja Wetan', 'Kebakalan', 'Sumberejo'],
    },
    'Kabupaten Cilacap': {
      'Cilacap Selatan': ['Cilacap', 'Donan', 'Tegalreja', 'Kutawaru', 'Tambakreja'],
      'Cilacap Tengah': ['Gunung Simping', 'Lomanis', 'Sidakaya', 'Gumilir', 'Kebonmanis'],
      'Cilacap Utara': ['Gumilir', 'Karangtalun', 'Mertasinga', 'Tritih Kulon'],
    },
    'Kabupaten Banyumas': {
      'Purwokerto Timur': ['Arcawinangun', 'Mersi', 'Purwokerto Wetan', 'Sokanegara', 'Bancarkembar'],
      'Purwokerto Selatan': ['Tanjung', 'Karangpucung', 'Berkoh', 'Sumampir', 'Teluk'],
      'Purwokerto Utara': ['Grendeng', 'Bobosan', 'Pabuaran', 'Purwanegara', 'Kranji'],
    },
    'Kabupaten Pemalang': {
      'Pemalang': ['Mulyoharjo', 'Pelutan', 'Bojongbata', 'Sugihwaras', 'Kebondalem'],
      'Taman': ['Taman', 'Kejambon', 'Sitemu', 'Banjardawa', 'Kabunan'],
      'Comal': ['Comal', 'Sarwodadi', 'Purwoharjo', 'Kauman', 'Kaligelang'],
    },
    'Kabupaten Pekalongan': {
      'Pekalongan Barat': ['Medono', 'Podosugih', 'Sapuro Kebulen', 'Bendan Kergon', 'Tirto'],
      'Kedungwuni': ['Kedungwuni Timur', 'Kedungwuni Barat', 'Podo', 'Pajomblangan', 'Langkap'],
      'Wiradesa': ['Wiradesa', 'Pecakaran', 'Pekuncen', 'Sijambe', 'Rowoyoso'],
    },
    'Kota Pekalongan': {
      'Pekalongan Barat': ['Medono', 'Podosugih', 'Sapuro Kebulen', 'Bendan Kergon'],
      'Pekalongan Timur': ['Gamer', 'Kauman', 'Landungsari', 'Noyontaansari', 'Setono'],
      'Pekalongan Selatan': ['Jenggot', 'Banyurip Alit', 'Banyurip Ageng', 'Yosorejo'],
    },
    'Kota Tegal': {
      'Tegal Barat': ['Muarareja', 'Debong Lor', 'Kemandungan', 'Pesurungan Lor', 'Keturen'],
      'Tegal Timur': ['Panggung', 'Tegalsari', 'Mintaragen', 'Kejambon', 'Slerok'],
      'Margadana': ['Margadana', 'Cabawan', 'Kalinyamat Wetan', 'Pesurungan Kidul'],
    },
    'Kabupaten Tegal': {
      'Slawi': ['Slawi Kulon', 'Slawi Wetan', 'Kagok', 'Kudaile', 'Dukuhsalam'],
      'Adiwerna': ['Adiwerna', 'Kaliwadas', 'Dampyak', 'Debong Kulon', 'Lembasari'],
      'Talang': ['Talang', 'Pesarean', 'Cangkring', 'Kebasen', 'Langgen'],
    },
    'Kabupaten Brebes': {
      'Brebes': ['Limbangan Kulon', 'Limbangan Wetan', 'Brebes', 'Gandasuli', 'Pasar Batang'],
      'Tanjung': ['Tanjung', 'Sengon', 'Krakahan', 'Pejagan', 'Kemurang Kulon'],
      'Bumiayu': ['Bumiayu', 'Kalinusu', 'Kalilangkap', 'Laren', 'Dukuhturi'],
    },
    'Kabupaten Purbalingga': {
      'Purbalingga': ['Purbalingga Wetan', 'Purbalingga Kulon', 'Purbalingga Kidul', 'Purbalingga Lor', 'Bancar'],
      'Kalimanah': ['Kalimanah', 'Sidanegara', 'Blater', 'Kembaran Kulon', 'Selabaya'],
      'Padamara': ['Padamara', 'Prigi', 'Banjaran', 'Karangjoho', 'Kalimandi'],
    },
  },
}

// ============================================================
// JAWA TIMUR
// ============================================================

const jatimTree: WilayahTree = {
  'Jawa Timur': {
    'Kota Surabaya': {
      'Gubeng': ['Mojo', 'Airlangga', 'Kertajaya', 'Pucangsewu', 'Baratajaya', 'Pucang Sewu'],
      'Tambaksari': ['Tambaksari', 'Kapas Madya Baru', 'Ploso', 'Pacarkembang', 'Gading', 'Rangkah', 'Dukuh Setro'],
      'Rungkut': ['Kedung Baruk', 'Penjaringan Sari', 'Rungkut Kidul', 'Kalirungkut', 'Medokan Ayu', 'Wonorejo'],
      'Sukolilo': ['Keputih', 'Klampis Ngasem', 'Gebang Putih', 'Medokan Semampir', 'Semolowaru', 'Nginden Jangkungan'],
      'Mulyorejo': ['Mulyorejo', 'Kalijudan', 'Dukuh Sutorejo', 'Kejawan Putih Tambak', 'Kalisari', 'Manyar Sabrangan'],
      'Kenjeran': ['Sidotopo Wetan', 'Tanah Kali Kedinding', 'Bulak Banteng', 'Tambak Wedi'],
      'Semampir': ['Ampel', 'Pegirian', 'Ujung', 'Wonokusumo', 'Sidotopo'],
      'Bubutan': ['Bubutan', 'Tembok Dukuh', 'Jepara', 'Gundih', 'Alun-Alun Contong'],
      'Genteng': ['Genteng', 'Ketabang', 'Tegalsari', 'Kapasari', 'Embong Kaliasin'],
      'Sawahan': ['Sawahan', 'Putat Jaya', 'Banyu Urip', 'Kupang Krajan', 'Petemon', 'Pakis'],
      'Wonokromo': ['Wonokromo', 'Ngagelrejo', 'Ngagel', 'Darmo', 'Jagir', 'Jagiran'],
      'Gayungan': ['Gayungan', 'Dukuh Menanggal', 'Ketintang', 'Menanggal'],
      'Sukomanunggal': ['Sukomanunggal', 'Tandes Lor', 'Simo Mulyo', 'Simomulyo Baru', 'Simohilir'],
      'Tegalsari': ['Tegalsari', 'Dr Soetomo', 'Keputran', 'Kedungdoro', 'Wonorejo'],
      'Krembangan': ['Dupak', 'Krembangan Selatan', 'Krembangan Utara', 'Kemayoran', 'Perak Utara'],
    },
    'Kota Malang': {
      'Klojen': ['Klojen', 'Kauman', 'Kiduldalem', 'Sukoharjo', 'Oro-Oro Dowo', 'Samaan', 'Bareng', 'Gadingkasri', 'Penanggungan', 'Rampalcelaket'],
      'Blimbing': ['Blimbing', 'Purwantoro', 'Polowijen', 'Arjosari', 'Balearjosari', 'Bunulrejo', 'Kesatrian', 'Polehan', 'Ksatrian'],
      'Kedungkandang': ['Kedungkandang', 'Cemorokandang', 'Arjowinangun', 'Mergosono', 'Kotalama', 'Bumiayu', 'Tlogowaru', 'Buring', 'Wonokoyo'],
      'Sukun': ['Sukun', 'Bandungrejosari', 'Ciptomulyo', 'Pisangcandi', 'Tanjungrejo', 'Bakalan Krajan', 'Karang Besuki', 'Kebonsari', 'Mulyorejo'],
      'Lowokwaru': ['Lowokwaru', 'Sumbersari', 'Ketawanggede', 'Jatimulyo', 'Tasikmadu', 'Tunggulwulung', 'Mojolangu', 'Tulusrejo', 'Merjosari', 'Dinoyo'],
    },
    'Kabupaten Malang': {
      'Kepanjen': ['Kepanjen', 'Penarukan', 'Ardirejo', 'Panggungrejo', 'Jenggolo'],
      'Singosari': ['Pagentan', 'Wonorejo', 'Ardimulyo', 'Klampok', 'Randuagung'],
      'Lawang': ['Lawang', 'Sidodadi', 'Kalirejo', 'Bedali', 'Mulyoarjo'],
      'Turen': ['Turen', 'Talok', 'Gedok', 'Sananrejo', 'Undaan'],
    },
    'Kota Kediri': {
      'Kota': ['Kemasan', 'Ngronggo', 'Pakelan', 'Dandangan', 'Banjaran', 'Setonopande', 'Ringinanom'],
      'Pesantren': ['Pesantren', 'Tosaren', 'Betet', 'Ngletih', 'Ketami'],
      'Mojoroto': ['Mojoroto', 'Lirboyo', 'Bandar Kidul', 'Bandar Lor', 'Bujel', 'Gayam', 'Pojok'],
    },
    'Kabupaten Kediri': {
      'Kediri': ['Burengan', 'Sukorame', 'Wonosari', 'Balowerti', 'Bandar'],
      'Pare': ['Pare', 'Tulungrejo', 'Pelem', 'Bendo', 'Sumber Pilang'],
      'Ngasem': ['Ngasem', 'Sumberejo', 'Joho', 'Paron', 'Cukir'],
    },
    'Kota Blitar': {
      'Kepanjen Kidul': ['Kepanjen Kidul', 'Karangsari', 'Pakunden', 'Blitar', 'Tanggung'],
      'Sukorejo': ['Sukorejo', 'Tlumpu', 'Turi', 'Sentul', 'Gedog'],
      'Sananwetan': ['Sananwetan', 'Klampok', 'Rembang', 'Bendogerit', 'Kauman'],
    },
    'Kabupaten Blitar': {
      'Sutojayan': ['Sutojayan', 'Kedungsari', 'Kalipang', 'Balerejo', 'Bakung'],
      'Kanigoro': ['Kanigoro', 'Papungan', 'Gaprang', 'Gogodeso', 'Tlogo'],
      'Ponggok': ['Ponggok', 'Kandangan', 'Sidorejo', 'Dadaplangu', 'Bendo'],
    },
    'Kota Madiun': {
      'Mangunharjo': ['Mangunharjo', 'Kartoharjo', 'Nambangan Lor', 'Nambangan Kidul'],
      'Manguharjo': ['Manguharjo', 'Madiun Lor', 'Klegen', 'Mojorejo', 'Sukosari'],
      'Taman': ['Pandean', 'Banjarejo', 'Pilangbango', 'Demangan', 'Kejuron'],
    },
    'Kabupaten Madiun': {
      'Madiun': ['Kuncen', 'Pandean', 'Bangunsari', 'Mojopurno', 'Ngampel'],
      'Mejayan': ['Krajan', 'Mejayan', 'Bangunsari', 'Sidorejo', 'Tanjungrejo'],
      'Caruban': ['Caruban', 'Rejosari', 'Tiron', 'Kradinan', 'Sumberejo'],
    },
    'Kabupaten Jember': {
      'Kaliwates': ['Kaliwates', 'Mangli', 'Sempusari', 'Tegal Besar', 'Kebonsari'],
      'Sumbersari': ['Sumbersari', 'Kranjingan', 'Antirogo', 'Wirolegi'],
      'Patrang': ['Patrang', 'Baratan', 'Gebang', 'Jember Kidul', 'Slawu'],
    },
    'Kabupaten Banyuwangi': {
      'Banyuwangi': ['Penganjuran', 'Kepatihan', 'Tamanbaru', 'Sobo', 'Pakis'],
      'Rogojampi': ['Rogojampi', 'Lemahbang Kulon', 'Watukebo', 'Karangbendo', 'Tembokrejo'],
      'Genteng': ['Genteng Kulon', 'Genteng Wetan', 'Kembiritan', 'Kaligondo', 'Setail'],
    },
    'Kabupaten Jombang': {
      'Jombang': ['Jombang', 'Kaliwungu', 'Sambong', 'Sengon', 'Kepanjen'],
      'Mojoagung': ['Mojoagung', 'Gambiran', 'Betek', 'Karobelah', 'Miagan'],
      'Tembelang': ['Pesantren', 'Sumber Nongko', 'Kepuhkembeng', 'Mojokrapak', 'Bedahlawak'],
    },
    'Kabupaten Mojokerto': {
      'Mojosari': ['Mojosari', 'Kedungsari', 'Sarirejo', 'Awang-awang', 'Leminggir'],
      'Sooko': ['Sooko', 'Sambiroto', 'Ngrowo', 'Wringinanom', 'Karobelah'],
      'Pungging': ['Tunggalpager', 'Pungging', 'Lebaksono', 'Balongmasin', 'Sekargadung'],
    },
    'Kota Mojokerto': {
      'Prajuritkulon': ['Prajuritkulon', 'Mentikan', 'Kauman', 'Meri', 'Kranggan'],
      'Magersari': ['Magersari', 'Miji', 'Sentanan', 'Purwotengah', 'Gunung Gedangan'],
      'Kranggan': ['Kranggan', 'Wates', 'Surodinawan', 'Blooto'],
    },
    'Kabupaten Sidoarjo': {
      'Sidoarjo': ['Sidoarjo', 'Lemahputro', 'Celep', 'Sekardangan', 'Pagerwojo'],
      'Waru': ['Waru', 'Pepelegi', 'Tropodo', 'Medaeng', 'Berbek'],
      'Taman': ['Taman', 'Jemundo', 'Kramat', 'Sepanjang', 'Geluran'],
    },
    'Kabupaten Gresik': {
      'Gresik': ['Gresik', 'Lumpur', 'Karangpoh', 'Ngipik', 'Tlogopojok'],
      'Kebomas': ['Kebomas', 'Tenggulunan', 'Suci', 'Sidomoro', 'Giri'],
      'Manyar': ['Banyuwangi', 'Suci', 'Manyar Sidorukun', 'Roomo', 'Yosowilangun'],
    },
    'Kabupaten Lamongan': {
      'Lamongan': ['Lamongan', 'Tumenggungan', 'Sidoharjo', 'Tlogoretno', 'Rancangkencono'],
      'Paciran': ['Paciran', 'Drajat', 'Kandang Semangkon', 'Tunggul', 'Kranji'],
      'Brondong': ['Brondong', 'Lohgung', 'Sedayulawas', 'Sroyo', 'Sendangharjo'],
    },
    'Kabupaten Pasuruan': {
      'Pandaan': ['Pandaan', 'Petungasri', 'Sumbergedang', 'Tejowangi', 'Jogosari'],
      'Bangil': ['Bangil', 'Raci', 'Gempeng', 'Kolursari', 'Kiduldalem'],
      'Gempol': ['Gempol', 'Wonosunyo', 'Bulusari', 'Kepulungan', 'Legok'],
    },
    'Kota Pasuruan': {
      'Purworejo': ['Purworejo', 'Blandongan', 'Pohjentrek', 'Kebonagung', 'Tambaan'],
      'Bugul Kidul': ['Blandongan', 'Bugul Lor', 'Panggungrejo', 'Bakalan', 'Trajeng'],
      'Gadingrejo': ['Gadingrejo', 'Karangketug', 'Kepel', 'Petahunan', 'Gentong'],
    },
    'Kabupaten Probolinggo': {
      'Kraksaan': ['Patokan', 'Kandangjati Kulon', 'Kandangjati Wetan', 'Asembakor', 'Rangkang'],
      'Dringu': ['Dringu', 'Sumberagung', 'Curahdringu', 'Randuputih', 'Tegalrejo'],
      'Tongas': ['Tongas Wetan', 'Tongas Kulon', 'Dungun', 'Curah Tulis', 'Bayeman'],
    },
    'Kota Probolinggo': {
      'Wonoasih': ['Wonoasih', 'Jrebeng Lor', 'Jrebeng Kidul', 'Sumber Taman', 'Kedung Asem'],
      'Kademangan': ['Kademangan', 'Triwung Lor', 'Triwung Kidul', 'Pohsangit Lor', 'Ketapang'],
      'Mayangan': ['Jati', 'Sukabumi', 'Mangunharjo', 'Wiroborang', 'Tisnonegaran'],
    },
    'Kabupaten Lumajang': {
      'Lumajang': ['Tompokersan', 'Ditotrunan', 'Rogotrunan', 'Jogotrunan', 'Kepuharjo'],
      'Tekung': ['Tekung', 'Kutorenon', 'Sumbersari', 'Sumberwudi', 'Tunjung'],
      'Sukodono': ['Sukodono', 'Kebonsari', 'Kunir Lor', 'Kunir Kidul', 'Dawuhan'],
    },
    'Kabupaten Tulungagung': {
      'Tulungagung': ['Kauman', 'Kepatihan', 'Bago', 'Tertek', 'Panggungrejo'],
      'Boyolangu': ['Boyolangu', 'Bono', 'Serut', 'Gedangsewu', 'Winong'],
      'Kedungwaru': ['Kedungwaru', 'Bawang', 'Bangoan', 'Ketanon', 'Tawangsari'],
    },
    'Kabupaten Nganjuk': {
      'Nganjuk': ['Mangundikaran', 'Kauman', 'Begadung', 'Payaman', 'Mojorejo'],
      'Kertosono': ['Kertosono', 'Banaran', 'Kutorejo', 'Plosoharjo', 'Kepanjen'],
      'Bagor': ['Bagor', 'Bogo', 'Mbogo', 'Kandangan', 'Sidokare'],
    },
    'Kabupaten Bojonegoro': {
      'Bojonegoro': ['Sumbang', 'Ledok Wetan', 'Jetak', 'Semanding', 'Kalirejo'],
      'Padangan': ['Padangan', 'Ngradin', 'Ngeper', 'Purworejo', 'Cendono'],
      'Kapas': ['Kapas', 'Bangilan', 'Mojo', 'Semambung', 'Tapelan'],
    },
    'Kabupaten Tuban': {
      'Tuban': ['Kutorejo', 'Doromukti', 'Perbon', 'Latsari', 'Karang'],
      'Jenu': ['Jenu', 'Remen', 'Beji', 'Sekardadi', 'Kaliuntu'],
      'Plumpang': ['Plumpang', 'Bandungrejo', 'Klotok', 'Semanding', 'Kepoh'],
    },
    'Kabupaten Ponorogo': {
      'Ponorogo': ['Tonatan', 'Nologaten', 'Kadipaten', 'Cokromenggalan', 'Mangkujayan'],
      'Jenangan': ['Jenangan', 'Plalangan', 'Setono', 'Jimbe', 'Paringan'],
      'Babadan': ['Babadan', 'Trisono', 'Ngumpul', 'Cekok', 'Bareng'],
    },
    'Kabupaten Magetan': {
      'Magetan': ['Kepolorejo', 'Kapurejo', 'Tamanan', 'Magetan', 'Mangkujayan'],
      'Barat': ['Barat', 'Jabung', 'Pragak', 'Buluharjo', 'Sumbergandu'],
      'Karangrejo': ['Karangrejo', 'Sarangan', 'Ngiliran', 'Pacalan', 'Soco'],
    },
    'Kabupaten Ngawi': {
      'Ngawi': ['Ngawi', 'Ketanggi', 'Kartoharjo', 'Grudo', 'Margomulyo'],
      'Paron': ['Paron', 'Babadan', 'Banyubiru', 'Teguhan', 'Tempuran'],
      'Geneng': ['Geneng', 'Sidorejo', 'Ngawi Purba', 'Karanggupito', 'Bendo'],
    },
    'Kabupaten Pacitan': {
      'Pacitan': ['Pacitan', 'Sirnoboyo', 'Ploso', 'Bangunsari', 'Nanggungan'],
      'Arjosari': ['Arjosari', 'Mlati', 'Karangrejo', 'Jatimalang', 'Borang'],
      'Kebonagung': ['Kebonagung', 'Kalipelus', 'Sukoharjo', 'Kedungbendo', 'Wonodadi'],
    },
    'Kabupaten Trenggalek': {
      'Trenggalek': ['Trenggalek', 'Ngantru', 'Sumbergedong', 'Kelutan', 'Surodakan'],
      'Pogalan': ['Pogalan', 'Ngetal', 'Kedunglurah', 'Gembleb', 'Ngadimulyo'],
      'Bendungan': ['Bendungan', 'Suruh', 'Srabah', 'Botoputih', 'Dompyong'],
    },
  },
}

// ============================================================
// Main function
// ============================================================

async function main(): Promise<void> {
  console.log('Memulai seed data wilayah lengkap (DI Yogyakarta + Jawa Tengah + Jawa Timur)...')

  // Flatten semua data
  const diyRecords = flattenTree(diyTree)
  const jatengRecords = flattenTree(jatengTree)
  const jatimRecords = flattenTree(jatimTree)

  const totalExpected = diyRecords.length + jatengRecords.length + jatimRecords.length
  console.log(`Data disiapkan: ${diyRecords.length} DIY + ${jatengRecords.length} Jateng + ${jatimRecords.length} Jatim = ${totalExpected} total`)

  // Hapus data wilayah yang ada
  console.log('Menghapus data wilayah lama...')
  const deleted = await prisma.wilayah.deleteMany()
  console.log(`Dihapus: ${deleted.count} records lama`)

  // Insert DI Yogyakarta
  console.log(`Menyemai data DI Yogyakarta (${diyRecords.length} records)...`)
  const resultDiy = await prisma.wilayah.createMany({
    data: diyRecords,
    skipDuplicates: true,
  })
  console.log(`DI Yogyakarta: ${resultDiy.count} records ditambahkan`)

  // Insert Jawa Tengah
  console.log(`Menyemai data Jawa Tengah (${jatengRecords.length} records)...`)
  const resultJateng = await prisma.wilayah.createMany({
    data: jatengRecords,
    skipDuplicates: true,
  })
  console.log(`Jawa Tengah: ${resultJateng.count} records ditambahkan`)

  // Insert Jawa Timur
  console.log(`Menyemai data Jawa Timur (${jatimRecords.length} records)...`)
  const resultJatim = await prisma.wilayah.createMany({
    data: jatimRecords,
    skipDuplicates: true,
  })
  console.log(`Jawa Timur: ${resultJatim.count} records ditambahkan`)

  const total = resultDiy.count + resultJateng.count + resultJatim.count
  console.log(`\nTotal: ${total} records wilayah berhasil disemai`)

  if (total < 1500) {
    console.warn(`PERINGATAN: Total records (${total}) kurang dari target 1500. Periksa data duplikat.`)
  } else {
    console.log('Target >= 1500 records tercapai.')
  }
}

main()
  .catch((e: unknown) => {
    console.error('Seed wilayah gagal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
