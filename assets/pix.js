// Gera o código Pix "copia e cola" (BR Code / EMV) com QR estático.
// Especificação: Manual de Padrões para Iniciação do Pix (Banco Central).
(function (root) {
  function tlv(id, value) {
    const len = String(value.length).padStart(2, '0');
    return id + len + value;
  }
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  // Remove acentos e caracteres fora do conjunto aceito pelos bancos.
  function clean(s, max) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 .,\-\/]/g, '')
      .trim().slice(0, max);
  }
  function normalizeKey(type, key) {
    key = String(key || '').trim();
    if (type === 'cpf' || type === 'cnpj') return key.replace(/\D/g, '');
    if (type === 'telefone') {
      let d = key.replace(/\D/g, '');
      if (!d.startsWith('55') || d.length < 12) d = '55' + d;
      return '+' + d;
    }
    if (type === 'email') return key.toLowerCase();
    return key; // chave aleatória
  }
  function payload({ keyType, key, name, city, amount, txid, description }) {
    const k = normalizeKey(keyType, key);
    let mai = tlv('00', 'br.gov.bcb.pix') + tlv('01', k);
    const desc = clean(description, 40);
    if (desc) mai += tlv('02', desc);
    let p = tlv('00', '01') + tlv('26', mai) + tlv('52', '0000') + tlv('53', '986');
    if (amount && Number(amount) > 0) p += tlv('54', Number(amount).toFixed(2));
    p += tlv('58', 'BR') + tlv('59', clean(name, 25) || 'RECEBEDOR') + tlv('60', clean(city, 15) || 'BRASIL');
    const tx = String(txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    p += tlv('62', tlv('05', tx));
    p += '6304';
    return p + crc16(p);
  }
  root.Pix = { payload, crc16, normalizeKey };
  if (typeof module !== 'undefined') module.exports = root.Pix;
})(typeof window !== 'undefined' ? window : globalThis);
