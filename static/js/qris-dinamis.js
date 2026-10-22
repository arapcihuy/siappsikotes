// QRIS dinamis: mengisi tag 54 (nominal) ke payload QRIS statis lalu menghitung
// ulang CRC, sehingga nominal langsung terisi di aplikasi bank/e-wallet pembeli.
//
// Kenapa ini penting: QRIS di /beli/ adalah QRIS STATIS (tanpa tag 54). Pembeli
// harus MENGETIK sendiri nominal termasuk 3 angka unik rujukan (mis. Rp 39.651).
// Itu titik gesekan tertinggi di funnel: salah ketik sedikit, pembayaran tidak
// cocok, kode akses tertunda, dan pembeli pergi.
//
// Payload ini sudah diverifikasi silang: hasil JS identik dengan implementasi
// Python (tools/qris-dinamis.py), dan CRC-nya mereproduksi CRC QRIS asli (5BA7).
(function (root) {
  'use strict';

  // QRIS statis milik kanal pembayaran pengelola SiapPsikotes
  // (merchant "Momo dimsum — Sleman", sudah diumumkan terbuka di /beli/).
  var QRIS_STATIS =
    '00020101021126610014COM.GO-JEK.WWW01189360091430513430280210G0513430280' +
    '303UMI51440014ID.CO.QRIS.WWW0215ID10265127403780303UMI5204581253033605802' +
    'ID5911Momo dimsum6006SLEMAN61055528562140703A01110362163045BA7';

  // CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF) — wajib untuk tag 63 QRIS.
  function crc16(str) {
    var crc = 0xFFFF;
    for (var i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
      }
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }

  // Urai EMVCo TLV: [tag 2][panjang 2][nilai]
  function urai(s) {
    var out = [];
    var i = 0;
    while (i + 4 <= s.length) {
      var tag = s.substr(i, 2);
      var ln = parseInt(s.substr(i + 2, 2), 10);
      if (isNaN(ln)) break;
      var val = s.substr(i + 4, ln);
      if (val.length !== ln) break;
      out.push([tag, val]);
      i += 4 + ln;
    }
    return out;
  }

  function rakit(items) {
    return items.map(function (p) {
      return p[0] + ('0' + p[1].length).slice(-2) + p[1];
    }).join('');
  }

  // Sisipkan tag 54 (nominal) lalu hitung ulang tag 63 (CRC).
  function dinamis(nominal, statis) {
    var s = statis || QRIS_STATIS;
    var items = urai(s).filter(function (p) { return p[0] !== '54' && p[0] !== '63'; });
    var sisip = items.length;
    for (var i = 0; i < items.length; i++) {
      if (items[i][0] === '53') { sisip = i + 1; break; }
    }
    items.splice(sisip, 0, ['54', String(nominal)]);
    var isi = rakit(items) + '6304';
    return isi + crc16(isi);
  }

  root.qrisDinamis = {
    crc16: crc16,
    urai: urai,
    dinamis: dinamis,
    STATIS: QRIS_STATIS
  };
})(typeof window !== 'undefined' ? window : this);
