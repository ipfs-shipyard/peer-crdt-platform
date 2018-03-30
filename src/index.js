'use strict';

const isBrowser = new Function("try {return this===window;}catch(e){ return false;}")();
//const WebCrypto = require('node-webcrypto-ossl');
const IPFS = require('ipfs')
const PeerCRDT = require('peer-crdt')
const PeerCrdtIpfs = require('peer-crdt-ipfs');
const Base64 = require('js-base64').Base64;

//const crypto = new WebCrypto();
const ALGO = { name: 'RSASSA-PKCS1-v1_5' };
const CAPS = ['sign', 'verify'];
const HASH = { name: 'SHA-512' };

const DEFAULTCONFIG = {
  keys: {
    publicKey: null,
    privateKey: null,
  },
  funcs: {
    getIdentityPrivateKey: async () => {
      return Promise.reject(new Error('config.keys.funcs.getPrivateKey needs to be overwritten.'));
    },
    signIdentity: async () => {
      return Promise.reject(new Error('config.keys.funs.signIdentity needs to be overwritten.'));
    }
  },
  tables: {},
}

/*
const id = 'alkjdsflakjdsf';
const schema = {
  a: 'g-set',
  b: 'lww-set'
}

const MyCRDT = CRDT.defaults({
  store: (id) => new Store(id),
  network: (id, log, onRemoteHead) => new Network(id, log, onRemoteHead, 100),
  sign: (entry, parents) => {
    console.log('signing', entry);
    return 'authentication for ' + entry;
  },
  authenticate: (entry, parents, signature) => {
    console.log('verifying signature', entry, parents, signature);
    return true;
    return 'authentication for ' + entry === signature;
  },
  signAndEncrypt: (value) => {
    console.log('sign and encrypt', value);
    return JSON.stringify(value);
  },
  decryptAndVerify: (value) => {
    console.log('decrypt and verify', value.toString('utf8'));
    return JSON.parse(value);
  }
});

const myc = MyCRDT.create('g-set', 'abcabc');
const myc2 = MyCRDT.create('g-set', 'abcabc');
myc.network.start();
myc2.network.start();
//const myCrdtInstance = MyCRDT(id)
//


myc2.on('change', () => {
  console.log('2 new value:', myc.value())
});
myc.on('change', () => {
  console.log('new value:', myc.value())
});

myc.add({a:'hellothere'});
*/

class IPFSDAppPlatform {

  constructor(config) {

    this.config = { ...DEFAULTCONFIG, ...config };
    let { privKey, pubKey } = this.config;
    console.log(this.config);
    this.config.keys.privateKey = privKey || null;
    this.config.keys.publicKey = pubKey || null;
    this.config.keys.publicKeySig = null;

    this.ipfs = window.IPFS = new IPFS({
      EXPERIMENTAL: {
        pubsub: true
      },
      config: {
        Addresses: {
          Swarm: [
            //'/dns4/protocol.andyet.net/tcp/9090/ws/p2p-websocket-star'
            '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
            //'/dns4/protocol.andyet.net/tcp/9090/ws/p2p-websocket-star/'
          ]
        }
      }
    });

    this.peerCrdtIpfs = PeerCrdtIpfs(this.ipfs);
    this.CRDT = PeerCRDT.defaults(this.peerCrdtIpfs);

    const spec = {
      groups: 'mv-register',
      permissions: 'mv-register',
      users: 'mv-register',
      sessions: 'mv-register',
      tables: {
      }
    };
    for (const tblname of Object.keys(this.config.tables)) {
      spec.tables[tblname] = 'lww-register';
    }

    this.DataType = this.CRDT.compose(spec);

    this.data = this.DataType.create('peer-crdt-platform-demo1', {
      signAndEncrypt: this.handleEncrypt.bind(this),
      decryptAndVerify: this.handleDecrypt.bind(this),
      sign: this.handleSign.bind(this),
      authenticate: this.handleAuthenticate.bind(this),
    });
  }

  async initialize() {

    if (!this.config.keys.privateKey && !this.config.keys.publicKey && isBrowser) {
      const privKeyString = window.localStorage.getItem('sessionPrivateJWK');
      const pubKeyString = window.localStorage.getItem('sessionPublicJWK');
      this.sessionProof = window.localStorage.getItem('sessionProof');
      if (privKeyString) {
        this.config.keys.privateKey = crypto.subtle.importKey('jwk', JSON.parse(privKeyString), {
          name: ALGO.name,
          hash: HASH
        }, true, ['sign']);
      }
      if (pubKeyString) {
        this.config.keys.publicKey = crypto.subtle.importKey('jwk', JSON.parse(pubKeyString), {
          name: ALGO.name,
          hash: HASH
        }, true, ['verify']);
      }
    }

    // generate a new key
    if (!this.config.keys.privateKey && !this.config.keys.publicKey) {
      console.log('Generating key...');
      this.keyPair = await crypto.subtle.generateKey({
        name: ALGO.name,
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: HASH
      }, true, CAPS);
      this.config.keys.privateKey = this.keyPair.privateKey;
      this.config.keys.publicKey = this.keyPair.publicKey;

      console.log('Generated. Exporting for signing and storage...');
      const privExport = await crypto.subtle.exportKey('jwk', this.config.keys.privateKey);
      const pubExport = await crypto.subtle.exportKey('jwk', this.config.keys.publicKey);
      console.log('Exported. Signing public session key...');
      const sig = await this.config.funcs.signIdentity(Base64.encode(JSON.stringify(pubExport)));
      this.sessionProof = `${Base64.encode(this.config.id)}.${Base64.encode(JSON.stringify(pubExport))}.${sig}`;
      console.log('Signed.');

      if (isBrowser) {
        console.log('Storing keys');
        window.localStorage.setItem('sessionPrivateJWK', JSON.stringify(privExport));
        window.localStorage.setItem('sessionPublicJWK', JSON.stringify(pubExport));
        window.localStorage.setItem('sessionProof', this.sessionProof);
        console.log('Stored.');
      }

      console.log('showing key');
      console.log(JSON.stringify({
        publicKey: pubExport,
        privateKey: privExport
      }, null, 2));

    } else {
      console.log('Loaded session keys from localstorage');
    }
    console.log('proof:', this.sessionProof);
    console.log("Starting network for CRDT");
    await this.data.network.start();
    console.log("Network started...");
  }

  handleEncrypt(operation) {
    return JSON.stringify(operation);
  }

  handleDecrypt(operation) {
    const op = JSON.parse(operation);
    console.log(operation.toString('utf8'));
    return op;
  }

  async handleSign(entry, parents) {
    console.log('sign', entry, parents);
    return Promise.resolve("herpderp");
  }

  async handleAuthenticate(entry, parents, signature) {
    console.log('authenticate', entry, parents, signature);
    return Promise.resolve(false);
  }
}

module.exports = IPFSDAppPlatform;
