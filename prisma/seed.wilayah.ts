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
// Tipe data wilayah
// ============================================================

interface WilayahRecord {
  provinsi: string
  kabupaten: string
  kecamatan: string
  kelurahan: string
}

// ============================================================
// DI YOGYAKARTA
// ============================================================

const diy: WilayahRecord[] = [
  // --- Kota Yogyakarta (14 kecamatan) ---
  // Mantrijeron
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Mantrijeron', kelurahan: 'Mantrijeron' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Mantrijeron', kelurahan: 'Gedongkiwo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Mantrijeron', kelurahan: 'Suryodiningratan' },
  // Kraton
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Kraton', kelurahan: 'Panembahan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Kraton', kelurahan: 'Kadipaten' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Kraton', kelurahan: 'Patehan' },
  // Mergangsan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Mergangsan', kelurahan: 'Wirogunan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Mergangsan', kelurahan: 'Brontokusuman' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Mergangsan', kelurahan: 'Keparakan' },
  // Umbulharjo
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Umbulharjo', kelurahan: 'Semaki' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Umbulharjo', kelurahan: 'Muja Muju' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Umbulharjo', kelurahan: 'Tahunan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Umbulharjo', kelurahan: 'Sorosutan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Umbulharjo', kelurahan: 'Pandeyan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Umbulharjo', kelurahan: 'Warungboto' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Umbulharjo', kelurahan: 'Giwangan' },
  // Kotagede
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Kotagede', kelurahan: 'Prenggan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Kotagede', kelurahan: 'Purbayan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Kotagede', kelurahan: 'Rejowinangun' },
  // Gondokusuman
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gondokusuman', kelurahan: 'Baciro' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gondokusuman', kelurahan: 'Demangan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gondokusuman', kelurahan: 'Kotabaru' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gondokusuman', kelurahan: 'Klitren' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gondokusuman', kelurahan: 'Terban' },
  // Danurejan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Danurejan', kelurahan: 'Bausasran' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Danurejan', kelurahan: 'Suryatmajan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Danurejan', kelurahan: 'Tegalpanggung' },
  // Pakualaman
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Pakualaman', kelurahan: 'Gunungketur' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Pakualaman', kelurahan: 'Purwokinanti' },
  // Gondomanan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gondomanan', kelurahan: 'Ngupasan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gondomanan', kelurahan: 'Prawirodirjan' },
  // Ngampilan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Ngampilan', kelurahan: 'Ngampilan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Ngampilan', kelurahan: 'Notoprajan' },
  // Wirobrajan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Wirobrajan', kelurahan: 'Patangpuluhan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Wirobrajan', kelurahan: 'Wirobrajan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Wirobrajan', kelurahan: 'Pakuncen' },
  // Gedongtengen
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gedongtengen', kelurahan: 'Pringgokusuman' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Gedongtengen', kelurahan: 'Sosromenduran' },
  // Jetis
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Jetis', kelurahan: 'Bumijo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Jetis', kelurahan: 'Cokrodiningratan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Jetis', kelurahan: 'Gowongan' },
  // Tegalrejo
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Tegalrejo', kelurahan: 'Bener' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Tegalrejo', kelurahan: 'Karangwaru' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Tegalrejo', kelurahan: 'Kricak' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kota Yogyakarta', kecamatan: 'Tegalrejo', kelurahan: 'Tegalrejo' },

  // --- Kabupaten Sleman ---
  // Depok
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Depok', kelurahan: 'Caturtunggal' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Depok', kelurahan: 'Condongcatur' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Depok', kelurahan: 'Maguwoharjo' },
  // Mlati
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Mlati', kelurahan: 'Sinduadi' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Mlati', kelurahan: 'Sumberadi' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Mlati', kelurahan: 'Tirtoadi' },
  // Gamping
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Gamping', kelurahan: 'Ambarketawang' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Gamping', kelurahan: 'Banyuraden' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Gamping', kelurahan: 'Trihanggo' },
  // Godean
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Godean', kelurahan: 'Sidoagung' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Godean', kelurahan: 'Sidokarto' },
  // Sleman
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Sleman', kelurahan: 'Caturharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Sleman', kelurahan: 'Triharjo' },
  // Ngaglik
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Ngaglik', kelurahan: 'Minomartani' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Ngaglik', kelurahan: 'Sardonoharjo' },
  // Kalasan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Kalasan', kelurahan: 'Purwomartani' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Kalasan', kelurahan: 'Selomartani' },
  // Berbah
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Berbah', kelurahan: 'Tegaltirto' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Berbah', kelurahan: 'Sendangtirto' },
  // Moyudan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Moyudan', kelurahan: 'Sumberrahayu' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Moyudan', kelurahan: 'Sumberarum' },
  // Minggir
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Minggir', kelurahan: 'Sendangagung' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Minggir', kelurahan: 'Sendangsari' },
  // Seyegan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Seyegan', kelurahan: 'Margomulyo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Seyegan', kelurahan: 'Margoagung' },
  // Tempel
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Tempel', kelurahan: 'Merdikorejo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Tempel', kelurahan: 'Lumbungrejo' },
  // Turi
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Turi', kelurahan: 'Donokerto' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Turi', kelurahan: 'Girikerto' },
  // Pakem
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Pakem', kelurahan: 'Hargobinangun' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Pakem', kelurahan: 'Harjobinangun' },
  // Cangkringan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Cangkringan', kelurahan: 'Argomulyo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Sleman', kecamatan: 'Cangkringan', kelurahan: 'Kepuharjo' },

  // --- Kabupaten Bantul ---
  // Bantul
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Bantul', kelurahan: 'Bantul' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Bantul', kelurahan: 'Trirenggo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Bantul', kelurahan: 'Ringinharjo' },
  // Sewon
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Sewon', kelurahan: 'Pendowoharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Sewon', kelurahan: 'Panggungharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Sewon', kelurahan: 'Timbulharjo' },
  // Kasihan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Kasihan', kelurahan: 'Bangunjiwo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Kasihan', kelurahan: 'Ngestiharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Kasihan', kelurahan: 'Tamantirto' },
  // Pajangan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pajangan', kelurahan: 'Sendangsari' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pajangan', kelurahan: 'Triwidadi' },
  // Pandak
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pandak', kelurahan: 'Gilangharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pandak', kelurahan: 'Caturharjo' },
  // Bambanglipuro
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Bambanglipuro', kelurahan: 'Mulyodadi' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Bambanglipuro', kelurahan: 'Sidomulyo' },
  // Pundong
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pundong', kelurahan: 'Seloharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pundong', kelurahan: 'Srihardono' },
  // Imogiri
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Imogiri', kelurahan: 'Imogiri' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Imogiri', kelurahan: 'Sriharjo' },
  // Dlingo
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Dlingo', kelurahan: 'Dlingo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Dlingo', kelurahan: 'Mangunan' },
  // Pleret
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pleret', kelurahan: 'Pleret' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Pleret', kelurahan: 'Bawuran' },
  // Piyungan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Piyungan', kelurahan: 'Sitimulyo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Piyungan', kelurahan: 'Srimulyo' },
  // Banguntapan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Banguntapan', kelurahan: 'Banguntapan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Banguntapan', kelurahan: 'Baturetno' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Banguntapan', kelurahan: 'Jagalan' },
  // Jetis (Bantul)
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Jetis', kelurahan: 'Canden' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Jetis', kelurahan: 'Patalan' },
  // Sedayu
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Sedayu', kelurahan: 'Argodadi' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Sedayu', kelurahan: 'Argomulyo' },
  // Kretek
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Kretek', kelurahan: 'Tirtomulyo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Kretek', kelurahan: 'Donotirto' },
  // Sanden
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Sanden', kelurahan: 'Gadingharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Sanden', kelurahan: 'Murtigading' },
  // Srandakan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Srandakan', kelurahan: 'Trimurti' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Bantul', kecamatan: 'Srandakan', kelurahan: 'Poncosari' },

  // --- Kabupaten Kulonprogo ---
  // Wates
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Wates', kelurahan: 'Wates' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Wates', kelurahan: 'Triharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Wates', kelurahan: 'Bendungan' },
  // Pengasih
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Pengasih', kelurahan: 'Pengasih' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Pengasih', kelurahan: 'Sendangsari' },
  // Sentolo
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Sentolo', kelurahan: 'Sentolo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Sentolo', kelurahan: 'Demangrejo' },
  // Nanggulan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Nanggulan', kelurahan: 'Wijimulyo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Nanggulan', kelurahan: 'Donomulyo' },
  // Galur
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Galur', kelurahan: 'Tirtorahayu' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Galur', kelurahan: 'Nomporejo' },
  // Panjatan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Panjatan', kelurahan: 'Gotakan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Panjatan', kelurahan: 'Panjatan' },
  // Temon
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Temon', kelurahan: 'Temon Kulon' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Temon', kelurahan: 'Temon Wetan' },
  // Kokap
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Kokap', kelurahan: 'Hargomulyo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Kokap', kelurahan: 'Hargotirto' },
  // Girimulyo
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Girimulyo', kelurahan: 'Giripurwo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Girimulyo', kelurahan: 'Purwosari' },
  // Samigaluh
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Samigaluh', kelurahan: 'Kebonharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Samigaluh', kelurahan: 'Sidoharjo' },
  // Kalibawang
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Kalibawang', kelurahan: 'Banjarharjo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Kalibawang', kelurahan: 'Banjararum' },
  // Lendah
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Lendah', kelurahan: 'Gulurejo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Kulonprogo', kecamatan: 'Lendah', kelurahan: 'Jatirejo' },

  // --- Kabupaten Gunungkidul ---
  // Wonosari
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Wonosari', kelurahan: 'Wonosari' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Wonosari', kelurahan: 'Kepek' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Wonosari', kelurahan: 'Karangrejek' },
  // Playen
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Playen', kelurahan: 'Playen' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Playen', kelurahan: 'Dengok' },
  // Patuk
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Patuk', kelurahan: 'Patuk' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Patuk', kelurahan: 'Semoyo' },
  // Paliyan
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Paliyan', kelurahan: 'Giring' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Paliyan', kelurahan: 'Paliyan' },
  // Saptosari
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Saptosari', kelurahan: 'Jetis' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Saptosari', kelurahan: 'Ngloro' },
  // Tepus
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Tepus', kelurahan: 'Tepus' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Tepus', kelurahan: 'Giripanggung' },
  // Tanjungsari
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Tanjungsari', kelurahan: 'Kemadang' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Tanjungsari', kelurahan: 'Ngestirejo' },
  // Semanu
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Semanu', kelurahan: 'Semanu' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Semanu', kelurahan: 'Candirejo' },
  // Karangmojo
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Karangmojo', kelurahan: 'Karangmojo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Karangmojo', kelurahan: 'Bejiharjo' },
  // Nglipar
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Nglipar', kelurahan: 'Nglipar' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Nglipar', kelurahan: 'Kedungpoh' },
  // Semin
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Semin', kelurahan: 'Semin' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Semin', kelurahan: 'Kalitekuk' },
  // Ponjong
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Ponjong', kelurahan: 'Ponjong' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Ponjong', kelurahan: 'Bedoyo' },
  // Rongkop
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Rongkop', kelurahan: 'Melikan' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Rongkop', kelurahan: 'Semugih' },
  // Purwosari
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Purwosari', kelurahan: 'Giritirto' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Purwosari', kelurahan: 'Giriasih' },
  // Panggang
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Panggang', kelurahan: 'Girimulyo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Panggang', kelurahan: 'Giriharjo' },
  // Gedangsari
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Gedangsari', kelurahan: 'Tegalrejo' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Gedangsari', kelurahan: 'Sampang' },
  // Ngawen
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Ngawen', kelurahan: 'Kampung' },
  { provinsi: 'DI Yogyakarta', kabupaten: 'Kabupaten Gunungkidul', kecamatan: 'Ngawen', kelurahan: 'Jurangjero' },
]

// ============================================================
// JAWA TENGAH
// ============================================================

const jateng: WilayahRecord[] = [
  // --- Kota Semarang ---
  // Semarang Tengah
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Tengah', kelurahan: 'Sekayu' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Tengah', kelurahan: 'Miroto' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Tengah', kelurahan: 'Kauman' },
  // Semarang Selatan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Selatan', kelurahan: 'Pleburan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Selatan', kelurahan: 'Lamper Lor' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Selatan', kelurahan: 'Mugassari' },
  // Semarang Utara
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Utara', kelurahan: 'Bulu Lor' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Semarang Utara', kelurahan: 'Panggung Lor' },
  // Gajahmungkur
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Gajahmungkur', kelurahan: 'Gajahmungkur' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Gajahmungkur', kelurahan: 'Karangrejo' },
  // Candisari
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Candisari', kelurahan: 'Candi' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Candisari', kelurahan: 'Jatingaleh' },
  // Tembalang
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Tembalang', kelurahan: 'Tembalang' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Tembalang', kelurahan: 'Bulusan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Tembalang', kelurahan: 'Kramas' },
  // Banyumanik
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Banyumanik', kelurahan: 'Banyumanik' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Banyumanik', kelurahan: 'Srondol Wetan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Banyumanik', kelurahan: 'Pudakpayung' },
  // Pedurungan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Pedurungan', kelurahan: 'Pedurungan Tengah' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Semarang', kecamatan: 'Pedurungan', kelurahan: 'Tlogosari Wetan' },

  // --- Kabupaten Semarang ---
  // Ungaran Barat
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Ungaran Barat', kelurahan: 'Ungaran' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Ungaran Barat', kelurahan: 'Genuk' },
  // Ungaran Timur
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Ungaran Timur', kelurahan: 'Leyangan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Ungaran Timur', kelurahan: 'Sidomulyo' },
  // Banyubiru
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Banyubiru', kelurahan: 'Banyubiru' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Banyubiru', kelurahan: 'Kebondowo' },
  // Ambarawa
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Ambarawa', kelurahan: 'Panjang' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Semarang', kecamatan: 'Ambarawa', kelurahan: 'Lodoyong' },

  // --- Kota Surakarta (Solo) ---
  // Banjarsari
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Banjarsari', kelurahan: 'Banyuanyar' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Banjarsari', kelurahan: 'Sumber' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Banjarsari', kelurahan: 'Nusukan' },
  // Laweyan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Laweyan', kelurahan: 'Laweyan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Laweyan', kelurahan: 'Pajang' },
  // Serengan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Serengan', kelurahan: 'Kemlayan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Serengan', kelurahan: 'Serengan' },
  // Pasar Kliwon
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Pasar Kliwon', kelurahan: 'Kampung Baru' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Pasar Kliwon', kelurahan: 'Pasar Kliwon' },
  // Jebres
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Jebres', kelurahan: 'Jebres' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Surakarta', kecamatan: 'Jebres', kelurahan: 'Mojosongo' },

  // --- Kabupaten Klaten ---
  // Klaten Tengah
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Klaten', kecamatan: 'Klaten Tengah', kelurahan: 'Klaten' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Klaten', kecamatan: 'Klaten Tengah', kelurahan: 'Tonggalan' },
  // Klaten Selatan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Klaten', kecamatan: 'Klaten Selatan', kelurahan: 'Merbung' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Klaten', kecamatan: 'Klaten Selatan', kelurahan: 'Trunuh' },
  // Klaten Utara
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Klaten', kecamatan: 'Klaten Utara', kelurahan: 'Gergunung' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Klaten', kecamatan: 'Klaten Utara', kelurahan: 'Bareng' },

  // --- Kabupaten Magelang ---
  // Mertoyudan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Magelang', kecamatan: 'Mertoyudan', kelurahan: 'Mertoyudan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Magelang', kecamatan: 'Mertoyudan', kelurahan: 'Pasuruhan' },
  // Muntilan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Magelang', kecamatan: 'Muntilan', kelurahan: 'Muntilan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Magelang', kecamatan: 'Muntilan', kelurahan: 'Gunungpring' },

  // --- Kota Magelang ---
  // Magelang Tengah
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Magelang', kecamatan: 'Magelang Tengah', kelurahan: 'Cacaban' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Magelang', kecamatan: 'Magelang Tengah', kelurahan: 'Magelang' },
  // Magelang Selatan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Magelang', kecamatan: 'Magelang Selatan', kelurahan: 'Tidar Selatan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Magelang', kecamatan: 'Magelang Selatan', kelurahan: 'Jurang Ombo Utara' },

  // --- Kabupaten Purworejo ---
  // Purworejo
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Purworejo', kecamatan: 'Purworejo', kelurahan: 'Purworejo' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Purworejo', kecamatan: 'Purworejo', kelurahan: 'Sindurjan' },
  // Kutoarjo
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Purworejo', kecamatan: 'Kutoarjo', kelurahan: 'Kutoarjo' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Purworejo', kecamatan: 'Kutoarjo', kelurahan: 'Semawung Daleman' },

  // --- Kabupaten Temanggung ---
  // Temanggung
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Temanggung', kecamatan: 'Temanggung', kelurahan: 'Temanggung I' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Temanggung', kecamatan: 'Temanggung', kelurahan: 'Temanggung II' },
  // Parakan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Temanggung', kecamatan: 'Parakan', kelurahan: 'Parakan Kauman' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Temanggung', kecamatan: 'Parakan', kelurahan: 'Parakan Wetan' },

  // --- Kabupaten Kebumen ---
  // Kebumen
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kebumen', kecamatan: 'Kebumen', kelurahan: 'Kebumen' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kebumen', kecamatan: 'Kebumen', kelurahan: 'Tamanwinangun' },
  // Gombong
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kebumen', kecamatan: 'Gombong', kelurahan: 'Gombong' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kebumen', kecamatan: 'Gombong', kelurahan: 'Semanding' },

  // --- Kabupaten Boyolali ---
  // Boyolali
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Boyolali', kecamatan: 'Boyolali', kelurahan: 'Boyolali' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Boyolali', kecamatan: 'Boyolali', kelurahan: 'Kiringan' },
  // Ngemplak
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Boyolali', kecamatan: 'Ngemplak', kelurahan: 'Ngargorejo' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Boyolali', kecamatan: 'Ngemplak', kelurahan: 'Donohudan' },

  // --- Kabupaten Sukoharjo ---
  // Sukoharjo
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sukoharjo', kecamatan: 'Sukoharjo', kelurahan: 'Begajah' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sukoharjo', kecamatan: 'Sukoharjo', kelurahan: 'Jetis' },
  // Kartasura
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sukoharjo', kecamatan: 'Kartasura', kelurahan: 'Kartasura' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sukoharjo', kecamatan: 'Kartasura', kelurahan: 'Ngadirejo' },

  // --- Kabupaten Wonogiri ---
  // Wonogiri
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonogiri', kecamatan: 'Wonogiri', kelurahan: 'Wonokarto' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonogiri', kecamatan: 'Wonogiri', kelurahan: 'Pokoh Kidul' },
  // Selogiri
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonogiri', kecamatan: 'Selogiri', kelurahan: 'Jendi' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonogiri', kecamatan: 'Selogiri', kelurahan: 'Pule' },

  // --- Kabupaten Karanganyar ---
  // Karanganyar
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Karanganyar', kecamatan: 'Karanganyar', kelurahan: 'Karanganyar' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Karanganyar', kecamatan: 'Karanganyar', kelurahan: 'Tegalgede' },
  // Colomadu
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Karanganyar', kecamatan: 'Colomadu', kelurahan: 'Gawanan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Karanganyar', kecamatan: 'Colomadu', kelurahan: 'Malangjiwan' },

  // --- Kabupaten Sragen ---
  // Sragen
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sragen', kecamatan: 'Sragen', kelurahan: 'Sragen Kulon' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sragen', kecamatan: 'Sragen', kelurahan: 'Sragen Tengah' },
  // Sidoharjo
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sragen', kecamatan: 'Sidoharjo', kelurahan: 'Jati' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Sragen', kecamatan: 'Sidoharjo', kelurahan: 'Setren' },

  // --- Kabupaten Kudus ---
  // Kudus
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kudus', kecamatan: 'Kudus', kelurahan: 'Kauman' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kudus', kecamatan: 'Kudus', kelurahan: 'Demaan' },
  // Jati
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kudus', kecamatan: 'Jati', kelurahan: 'Jati Wetan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Kudus', kecamatan: 'Jati', kelurahan: 'Getas Pejaten' },

  // --- Kabupaten Jepara ---
  // Jepara
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Jepara', kecamatan: 'Jepara', kelurahan: 'Saripan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Jepara', kecamatan: 'Jepara', kelurahan: 'Demaan' },
  // Tahunan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Jepara', kecamatan: 'Tahunan', kelurahan: 'Tahunan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Jepara', kecamatan: 'Tahunan', kelurahan: 'Mantingan' },

  // --- Kabupaten Pati ---
  // Pati
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Pati', kecamatan: 'Pati', kelurahan: 'Pati Kidul' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Pati', kecamatan: 'Pati', kelurahan: 'Pati Lor' },
  // Gabus
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Pati', kecamatan: 'Gabus', kelurahan: 'Tlogoayu' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Pati', kecamatan: 'Gabus', kelurahan: 'Gabus' },

  // --- Kabupaten Demak ---
  // Demak
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Demak', kecamatan: 'Demak', kelurahan: 'Bintoro' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Demak', kecamatan: 'Demak', kelurahan: 'Mangunjiwan' },
  // Mranggen
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Demak', kecamatan: 'Mranggen', kelurahan: 'Mranggen' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Demak', kecamatan: 'Mranggen', kelurahan: 'Bandungrejo' },

  // --- Kabupaten Grobogan ---
  // Purwodadi
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Grobogan', kecamatan: 'Purwodadi', kelurahan: 'Purwodadi' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Grobogan', kecamatan: 'Purwodadi', kelurahan: 'Danyang' },
  // Wirosari
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Grobogan', kecamatan: 'Wirosari', kelurahan: 'Wirosari' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Grobogan', kecamatan: 'Wirosari', kelurahan: 'Karangasem' },

  // --- Kabupaten Blora ---
  // Blora
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Blora', kecamatan: 'Blora', kelurahan: 'Kauman' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Blora', kecamatan: 'Blora', kelurahan: 'Mlangsen' },
  // Cepu
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Blora', kecamatan: 'Cepu', kelurahan: 'Cepu' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Blora', kecamatan: 'Cepu', kelurahan: 'Balun' },

  // --- Kabupaten Rembang ---
  // Rembang
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Rembang', kecamatan: 'Rembang', kelurahan: 'Magersari' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Rembang', kecamatan: 'Rembang', kelurahan: 'Leteh' },
  // Lasem
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Rembang', kecamatan: 'Lasem', kelurahan: 'Lasem' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Rembang', kecamatan: 'Lasem', kelurahan: 'Soditan' },

  // --- Kota Salatiga ---
  // Argomulyo
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Salatiga', kecamatan: 'Argomulyo', kelurahan: 'Cebongan' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Salatiga', kecamatan: 'Argomulyo', kelurahan: 'Ledok' },
  // Tingkir
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Salatiga', kecamatan: 'Tingkir', kelurahan: 'Tingkir Lor' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kota Salatiga', kecamatan: 'Tingkir', kelurahan: 'Tingkir Tengah' },

  // --- Kabupaten Wonosobo ---
  // Wonosobo
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonosobo', kecamatan: 'Wonosobo', kelurahan: 'Wonosobo Timur' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonosobo', kecamatan: 'Wonosobo', kelurahan: 'Wonosobo Barat' },
  // Mojotengah
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonosobo', kecamatan: 'Mojotengah', kelurahan: 'Mojosari' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Wonosobo', kecamatan: 'Mojotengah', kelurahan: 'Kejajar' },

  // --- Kabupaten Banjarnegara ---
  // Banjarnegara
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banjarnegara', kecamatan: 'Banjarnegara', kelurahan: 'Parakancanggah' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banjarnegara', kecamatan: 'Banjarnegara', kelurahan: 'Kutabanjarnegara' },
  // Purwareja Klampok
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banjarnegara', kecamatan: 'Purwareja Klampok', kelurahan: 'Kaliori' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banjarnegara', kecamatan: 'Purwareja Klampok', kelurahan: 'Pagak' },

  // --- Kabupaten Cilacap ---
  // Cilacap Selatan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Cilacap', kecamatan: 'Cilacap Selatan', kelurahan: 'Cilacap' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Cilacap', kecamatan: 'Cilacap Selatan', kelurahan: 'Donan' },
  // Cilacap Tengah
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Cilacap', kecamatan: 'Cilacap Tengah', kelurahan: 'Gunung Simping' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Cilacap', kecamatan: 'Cilacap Tengah', kelurahan: 'Lomanis' },

  // --- Kabupaten Banyumas ---
  // Purwokerto Timur
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banyumas', kecamatan: 'Purwokerto Timur', kelurahan: 'Arcawinangun' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banyumas', kecamatan: 'Purwokerto Timur', kelurahan: 'Mersi' },
  // Purwokerto Selatan
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banyumas', kecamatan: 'Purwokerto Selatan', kelurahan: 'Tanjung' },
  { provinsi: 'Jawa Tengah', kabupaten: 'Kabupaten Banyumas', kecamatan: 'Purwokerto Selatan', kelurahan: 'Karangpucung' },
]

// ============================================================
// JAWA TIMUR
// ============================================================

const jatim: WilayahRecord[] = [
  // --- Kota Surabaya ---
  // Gubeng
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Gubeng', kelurahan: 'Mojo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Gubeng', kelurahan: 'Airlangga' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Gubeng', kelurahan: 'Kertajaya' },
  // Tambaksari
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Tambaksari', kelurahan: 'Tambaksari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Tambaksari', kelurahan: 'Kapas Madya Baru' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Tambaksari', kelurahan: 'Ploso' },
  // Rungkut
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Rungkut', kelurahan: 'Kedung Baruk' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Rungkut', kelurahan: 'Penjaringan Sari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Rungkut', kelurahan: 'Rungkut Kidul' },
  // Sukolilo
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Sukolilo', kelurahan: 'Keputih' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Sukolilo', kelurahan: 'Klampis Ngasem' },
  // Mulyorejo
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Mulyorejo', kelurahan: 'Mulyorejo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Mulyorejo', kelurahan: 'Kalijudan' },
  // Kenjeran
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Kenjeran', kelurahan: 'Sidotopo Wetan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Kenjeran', kelurahan: 'Tanah Kali Kedinding' },
  // Semampir
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Semampir', kelurahan: 'Ampel' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Semampir', kelurahan: 'Pegirian' },
  // Krembangan
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Krembangan', kelurahan: 'Dupak' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Krembangan', kelurahan: 'Krembangan Selatan' },
  // Bubutan
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Bubutan', kelurahan: 'Bubutan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Bubutan', kelurahan: 'Tembok Dukuh' },
  // Genteng
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Genteng', kelurahan: 'Genteng' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Genteng', kelurahan: 'Ketabang' },
  // Tegalsari
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Tegalsari', kelurahan: 'Tegalsari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Tegalsari', kelurahan: 'Dr Soetomo' },
  // Sawahan
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Sawahan', kelurahan: 'Sawahan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Sawahan', kelurahan: 'Putat Jaya' },
  // Wonokromo
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Wonokromo', kelurahan: 'Wonokromo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Wonokromo', kelurahan: 'Ngagelrejo' },
  // Gayungan
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Gayungan', kelurahan: 'Gayungan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Gayungan', kelurahan: 'Dukuh Menanggal' },
  // Sukomanunggal
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Sukomanunggal', kelurahan: 'Sukomanunggal' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Surabaya', kecamatan: 'Sukomanunggal', kelurahan: 'Tandes Lor' },

  // --- Kota Malang ---
  // Klojen
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Klojen', kelurahan: 'Klojen' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Klojen', kelurahan: 'Kauman' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Klojen', kelurahan: 'Kiduldalem' },
  // Blimbing
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Blimbing', kelurahan: 'Blimbing' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Blimbing', kelurahan: 'Purwantoro' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Blimbing', kelurahan: 'Polowijen' },
  // Kedungkandang
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Kedungkandang', kelurahan: 'Kedungkandang' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Kedungkandang', kelurahan: 'Cemorokandang' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Kedungkandang', kelurahan: 'Arjowinangun' },
  // Sukun
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Sukun', kelurahan: 'Sukun' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Sukun', kelurahan: 'Bandungrejosari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Sukun', kelurahan: 'Ciptomulyo' },
  // Lowokwaru
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Lowokwaru', kelurahan: 'Lowokwaru' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Lowokwaru', kelurahan: 'Sumbersari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Malang', kecamatan: 'Lowokwaru', kelurahan: 'Ketawanggede' },

  // --- Kabupaten Malang ---
  // Kepanjen
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Kepanjen', kelurahan: 'Kepanjen' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Kepanjen', kelurahan: 'Penarukan' },
  // Singosari
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Singosari', kelurahan: 'Pagentan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Singosari', kelurahan: 'Wonorejo' },
  // Lawang
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Lawang', kelurahan: 'Lawang' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Lawang', kelurahan: 'Sidodadi' },
  // Turen
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Turen', kelurahan: 'Turen' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Malang', kecamatan: 'Turen', kelurahan: 'Talok' },

  // --- Kota Kediri ---
  // Kota
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Kediri', kecamatan: 'Kota', kelurahan: 'Kemasan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Kediri', kecamatan: 'Kota', kelurahan: 'Ngronggo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Kediri', kecamatan: 'Kota', kelurahan: 'Pakelan' },
  // Pesantren
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Kediri', kecamatan: 'Pesantren', kelurahan: 'Pesantren' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Kediri', kecamatan: 'Pesantren', kelurahan: 'Tosaren' },
  // Mojoroto
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Kediri', kecamatan: 'Mojoroto', kelurahan: 'Mojoroto' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Kediri', kecamatan: 'Mojoroto', kelurahan: 'Lirboyo' },

  // --- Kabupaten Kediri ---
  // Kediri
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Kediri', kecamatan: 'Kediri', kelurahan: 'Burengan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Kediri', kecamatan: 'Kediri', kelurahan: 'Sukorame' },
  // Pare
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Kediri', kecamatan: 'Pare', kelurahan: 'Pare' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Kediri', kecamatan: 'Pare', kelurahan: 'Tulungrejo' },
  // Ngasem
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Kediri', kecamatan: 'Ngasem', kelurahan: 'Ngasem' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Kediri', kecamatan: 'Ngasem', kelurahan: 'Sumberejo' },

  // --- Kota Blitar ---
  // Kepanjen Kidul
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Blitar', kecamatan: 'Kepanjen Kidul', kelurahan: 'Kepanjen Kidul' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Blitar', kecamatan: 'Kepanjen Kidul', kelurahan: 'Karangsari' },
  // Sukorejo
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Blitar', kecamatan: 'Sukorejo', kelurahan: 'Sukorejo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Blitar', kecamatan: 'Sukorejo', kelurahan: 'Tlumpu' },

  // --- Kabupaten Blitar ---
  // Sutojayan
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Blitar', kecamatan: 'Sutojayan', kelurahan: 'Sutojayan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Blitar', kecamatan: 'Sutojayan', kelurahan: 'Kedungsari' },
  // Kanigoro
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Blitar', kecamatan: 'Kanigoro', kelurahan: 'Kanigoro' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Blitar', kecamatan: 'Kanigoro', kelurahan: 'Papungan' },

  // --- Kota Madiun ---
  // Mangunharjo
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Madiun', kecamatan: 'Mangunharjo', kelurahan: 'Mangunharjo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Madiun', kecamatan: 'Mangunharjo', kelurahan: 'Kartoharjo' },
  // Manguharjo
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Madiun', kecamatan: 'Manguharjo', kelurahan: 'Manguharjo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Madiun', kecamatan: 'Manguharjo', kelurahan: 'Madiun Lor' },

  // --- Kabupaten Madiun ---
  // Madiun
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Madiun', kecamatan: 'Madiun', kelurahan: 'Kuncen' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Madiun', kecamatan: 'Madiun', kelurahan: 'Pandean' },
  // Mejayan
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Madiun', kecamatan: 'Mejayan', kelurahan: 'Krajan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Madiun', kecamatan: 'Mejayan', kelurahan: 'Mejayan' },

  // --- Kabupaten Jember ---
  // Kaliwates
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jember', kecamatan: 'Kaliwates', kelurahan: 'Kaliwates' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jember', kecamatan: 'Kaliwates', kelurahan: 'Mangli' },
  // Sumbersari
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jember', kecamatan: 'Sumbersari', kelurahan: 'Sumbersari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jember', kecamatan: 'Sumbersari', kelurahan: 'Kranjingan' },
  // Patrang
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jember', kecamatan: 'Patrang', kelurahan: 'Patrang' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jember', kecamatan: 'Patrang', kelurahan: 'Baratan' },

  // --- Kabupaten Banyuwangi ---
  // Banyuwangi
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Banyuwangi', kecamatan: 'Banyuwangi', kelurahan: 'Penganjuran' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Banyuwangi', kecamatan: 'Banyuwangi', kelurahan: 'Kepatihan' },
  // Rogojampi
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Banyuwangi', kecamatan: 'Rogojampi', kelurahan: 'Rogojampi' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Banyuwangi', kecamatan: 'Rogojampi', kelurahan: 'Lemahbang Kulon' },
  // Genteng
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Banyuwangi', kecamatan: 'Genteng', kelurahan: 'Genteng Kulon' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Banyuwangi', kecamatan: 'Genteng', kelurahan: 'Genteng Wetan' },

  // --- Kabupaten Jombang ---
  // Jombang
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jombang', kecamatan: 'Jombang', kelurahan: 'Jombang' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jombang', kecamatan: 'Jombang', kelurahan: 'Kaliwungu' },
  // Mojoagung
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jombang', kecamatan: 'Mojoagung', kelurahan: 'Mojoagung' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jombang', kecamatan: 'Mojoagung', kelurahan: 'Gambiran' },
  // Tembelang
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jombang', kecamatan: 'Tembelang', kelurahan: 'Pesantren' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Jombang', kecamatan: 'Tembelang', kelurahan: 'Sumber Nongko' },

  // --- Kabupaten Mojokerto ---
  // Mojosari
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Mojokerto', kecamatan: 'Mojosari', kelurahan: 'Mojosari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Mojokerto', kecamatan: 'Mojosari', kelurahan: 'Kedungsari' },
  // Sooko
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Mojokerto', kecamatan: 'Sooko', kelurahan: 'Sooko' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Mojokerto', kecamatan: 'Sooko', kelurahan: 'Sambiroto' },
  // Pungging
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Mojokerto', kecamatan: 'Pungging', kelurahan: 'Tunggalpager' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Mojokerto', kecamatan: 'Pungging', kelurahan: 'Pungging' },

  // --- Kota Mojokerto ---
  // Prajuritkulon
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Mojokerto', kecamatan: 'Prajuritkulon', kelurahan: 'Prajuritkulon' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Mojokerto', kecamatan: 'Prajuritkulon', kelurahan: 'Mentikan' },
  // Magersari
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Mojokerto', kecamatan: 'Magersari', kelurahan: 'Magersari' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Mojokerto', kecamatan: 'Magersari', kelurahan: 'Miji' },

  // --- Kabupaten Sidoarjo ---
  // Sidoarjo
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Sidoarjo', kecamatan: 'Sidoarjo', kelurahan: 'Sidoarjo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Sidoarjo', kecamatan: 'Sidoarjo', kelurahan: 'Lemahputro' },
  // Waru
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Sidoarjo', kecamatan: 'Waru', kelurahan: 'Waru' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Sidoarjo', kecamatan: 'Waru', kelurahan: 'Pepelegi' },
  // Taman
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Sidoarjo', kecamatan: 'Taman', kelurahan: 'Taman' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Sidoarjo', kecamatan: 'Taman', kelurahan: 'Jemundo' },

  // --- Kabupaten Gresik ---
  // Gresik
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Gresik', kecamatan: 'Gresik', kelurahan: 'Gresik' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Gresik', kecamatan: 'Gresik', kelurahan: 'Lumpur' },
  // Kebomas
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Gresik', kecamatan: 'Kebomas', kelurahan: 'Kebomas' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Gresik', kecamatan: 'Kebomas', kelurahan: 'Tenggulunan' },
  // Manyar
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Gresik', kecamatan: 'Manyar', kelurahan: 'Banyuwangi' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Gresik', kecamatan: 'Manyar', kelurahan: 'Suci' },

  // --- Kabupaten Lamongan ---
  // Lamongan
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lamongan', kecamatan: 'Lamongan', kelurahan: 'Lamongan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lamongan', kecamatan: 'Lamongan', kelurahan: 'Tumenggungan' },
  // Paciran
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lamongan', kecamatan: 'Paciran', kelurahan: 'Paciran' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lamongan', kecamatan: 'Paciran', kelurahan: 'Drajat' },
  // Brondong
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lamongan', kecamatan: 'Brondong', kelurahan: 'Brondong' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lamongan', kecamatan: 'Brondong', kelurahan: 'Lohgung' },

  // --- Kabupaten Pasuruan ---
  // Pandaan
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Pasuruan', kecamatan: 'Pandaan', kelurahan: 'Pandaan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Pasuruan', kecamatan: 'Pandaan', kelurahan: 'Petungasri' },
  // Bangil
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Pasuruan', kecamatan: 'Bangil', kelurahan: 'Bangil' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Pasuruan', kecamatan: 'Bangil', kelurahan: 'Raci' },
  // Gempol
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Pasuruan', kecamatan: 'Gempol', kelurahan: 'Gempol' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Pasuruan', kecamatan: 'Gempol', kelurahan: 'Wonosunyo' },

  // --- Kota Pasuruan ---
  // Purworejo
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Pasuruan', kecamatan: 'Purworejo', kelurahan: 'Purworejo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Pasuruan', kecamatan: 'Purworejo', kelurahan: 'Blandongan' },
  // Bugul Kidul
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Pasuruan', kecamatan: 'Bugul Kidul', kelurahan: 'Blandongan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kota Pasuruan', kecamatan: 'Bugul Kidul', kelurahan: 'Bugul Lor' },

  // --- Kabupaten Probolinggo ---
  // Kraksaan
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Probolinggo', kecamatan: 'Kraksaan', kelurahan: 'Patokan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Probolinggo', kecamatan: 'Kraksaan', kelurahan: 'Kandangjati Kulon' },
  // Dringu
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Probolinggo', kecamatan: 'Dringu', kelurahan: 'Dringu' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Probolinggo', kecamatan: 'Dringu', kelurahan: 'Sumberagung' },

  // --- Kabupaten Lumajang ---
  // Lumajang
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lumajang', kecamatan: 'Lumajang', kelurahan: 'Tompokersan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lumajang', kecamatan: 'Lumajang', kelurahan: 'Ditotrunan' },
  // Tekung
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lumajang', kecamatan: 'Tekung', kelurahan: 'Tekung' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Lumajang', kecamatan: 'Tekung', kelurahan: 'Kutorenon' },

  // --- Kabupaten Tulungagung ---
  // Tulungagung
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tulungagung', kecamatan: 'Tulungagung', kelurahan: 'Kauman' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tulungagung', kecamatan: 'Tulungagung', kelurahan: 'Kepatihan' },
  // Boyolangu
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tulungagung', kecamatan: 'Boyolangu', kelurahan: 'Boyolangu' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tulungagung', kecamatan: 'Boyolangu', kelurahan: 'Bono' },
  // Kedungwaru
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tulungagung', kecamatan: 'Kedungwaru', kelurahan: 'Kedungwaru' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tulungagung', kecamatan: 'Kedungwaru', kelurahan: 'Bawang' },

  // --- Kabupaten Nganjuk ---
  // Nganjuk
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Nganjuk', kecamatan: 'Nganjuk', kelurahan: 'Mangundikaran' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Nganjuk', kecamatan: 'Nganjuk', kelurahan: 'Kauman' },
  // Kertosono
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Nganjuk', kecamatan: 'Kertosono', kelurahan: 'Kertosono' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Nganjuk', kecamatan: 'Kertosono', kelurahan: 'Banaran' },

  // --- Kabupaten Bojonegoro ---
  // Bojonegoro
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Bojonegoro', kecamatan: 'Bojonegoro', kelurahan: 'Sumbang' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Bojonegoro', kecamatan: 'Bojonegoro', kelurahan: 'Ledok Wetan' },
  // Padangan
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Bojonegoro', kecamatan: 'Padangan', kelurahan: 'Padangan' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Bojonegoro', kecamatan: 'Padangan', kelurahan: 'Ngradin' },

  // --- Kabupaten Tuban ---
  // Tuban
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tuban', kecamatan: 'Tuban', kelurahan: 'Kutorejo' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tuban', kecamatan: 'Tuban', kelurahan: 'Doromukti' },
  // Jenu
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tuban', kecamatan: 'Jenu', kelurahan: 'Jenu' },
  { provinsi: 'Jawa Timur', kabupaten: 'Kabupaten Tuban', kecamatan: 'Jenu', kelurahan: 'Remen' },
]

// ============================================================
// Main function
// ============================================================

async function main(): Promise<void> {
  console.log('Memulai seed data wilayah lengkap (DIY + Jawa Tengah + Jawa Timur)...')

  // Hapus data wilayah yang ada
  console.log('Menghapus data wilayah lama...')
  const deleted = await prisma.wilayah.deleteMany()
  console.log(`Dihapus: ${deleted.count} records`)

  // Insert DIY
  console.log(`Menyemai data DI Yogyakarta (${diy.length} records)...`)
  const resultDiy = await prisma.wilayah.createMany({
    data: diy,
    skipDuplicates: true,
  })
  console.log(`DI Yogyakarta: ${resultDiy.count} records ditambahkan`)

  // Insert Jawa Tengah
  console.log(`Menyemai data Jawa Tengah (${jateng.length} records)...`)
  const resultJateng = await prisma.wilayah.createMany({
    data: jateng,
    skipDuplicates: true,
  })
  console.log(`Jawa Tengah: ${resultJateng.count} records ditambahkan`)

  // Insert Jawa Timur
  console.log(`Menyemai data Jawa Timur (${jatim.length} records)...`)
  const resultJatim = await prisma.wilayah.createMany({
    data: jatim,
    skipDuplicates: true,
  })
  console.log(`Jawa Timur: ${resultJatim.count} records ditambahkan`)

  const total = resultDiy.count + resultJateng.count + resultJatim.count
  console.log(`\nTotal: ${total} records wilayah berhasil disemai`)

  if (total < 1500) {
    console.warn(`PERINGATAN: Total records (${total}) kurang dari target 1500!`)
  } else {
    console.log('Target 1500+ records tercapai.')
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
