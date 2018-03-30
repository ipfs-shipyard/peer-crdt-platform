const RSA = { name: 'RSASSA-PKCS1-v1_5' };
const testValue = 'I am the very model of a modern major general.';
const testValue2 = 'I am the very model of a modern majr general.';

(async () => {
  console.log('generating key');
  let keypair;
  try {
    keypair = await crypto.subtle.generateKey({
      name: RSA.name,
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: 'SHA-512' },
    }, true, ['sign', 'verify', 'wrapKey', 'unwrapKey']);
  } catch (e) {
    console.error(e);
  }
  console.log('keypair:', keypair);
  console.log('signing...');
  const sig = await crypto.subtle.sign(RSA, keypair.privateKey, Buffer.from(testValue, 'utf8'));
  console.log('sig', sig);
  const verified = await crypto.subtle.verify(RSA, keypair.publicKey, sig, Buffer.from(testValue2, 'utf8'));
  console.log('verified:', verified);
})()
