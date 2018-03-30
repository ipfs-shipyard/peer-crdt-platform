const WebCrypto = require('node-webcrypto-ossl');
const crypto = new WebCrypto();

module.exports = {

  ALGO: { name: 'RSASSA-PKCS1-v1_5' },
  CAPS: ['sign', 'verify'],
  HASH: { name: 'SHA-512' },

  generatePair: async () => {

    this.keyPair = await crypto.subtle.generateKey({
      name: this.ALGO.name,
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: this.HASH
    }, true, this.CAPS);
  },

  loadSessionKeys: async () => {
  },

};
