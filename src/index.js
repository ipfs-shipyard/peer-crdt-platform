'use strict';

const isBrowser = new Function("try {return this===window;}catch(e){ return false;}")();
//const WebCrypto = require('node-webcrypto-ossl');
const IPFS = require('ipfs')
const PeerCRDT = require('peer-crdt')
const PeerCrdtIpfs = require('peer-crdt-ipfs');
const Base64 = require('js-base64').Base64;
const UUID = require('uuid/v4');
const Table = require('./table');

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
  swarm: ['/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star']
}

class IPFSDAppPlatform {

  constructor(config) {

    this.config = { ...DEFAULTCONFIG, ...config };
    let { privKey, pubKey } = this.config;
    this.config.keys.privateKey = privKey || null;
    this.config.keys.publicKey = pubKey || null;
    this.config.keys.publicKeySig = null;
    this.keyCache = new Map();
    if (!this.config.appId) {
      throw new Error('Must specify config.appId.');
    }

    this.ipfs = window.IPFS = new IPFS({
      EXPERIMENTAL: {
        pubsub: true
      },
      config: {
        Addresses: {
          Swarm: this.config.swarm
        }
      }
    });

    this.peerCrdtIpfs = PeerCrdtIpfs(this.ipfs);
    this.CRDT = PeerCRDT.defaults(this.peerCrdtIpfs);

    const metaSpec = {
      groups: 'mv-register',
      permissions: 'mv-register',
      users: 'mv-register',
      sessions: 'mv-register',
    };
    const tablesSpec = {};
    this.tables = {};
    this.tableQueue = {};

    for (const tblname of Object.keys(this.config.tables)) {
      tablesSpec[tblname] = 'lww-register';
      this.tables[tblname] = new Table(this, tblname, this.config.tables[tblname]);
      this.tableQueue[tblname] = [];
    }

    this.MetaType = this.CRDT.compose(metaSpec);
    this.TablesType = this.CRDT.compose(tablesSpec);

    this.metaData = this.MetaType.create(`${this.config.appId}-meta`, {
      signAndEncrypt: this.handleEncryptMeta.bind(this),
      decryptAndVerify: this.handleDecryptMeta.bind(this),
      sign: () => "",
      authenticate: () => true
    });

  }

  async initialize() {

    if (!this.config.keys.privateKey && !this.config.keys.publicKey && isBrowser) {
      const privKeyString = window.localStorage.getItem('sessionPrivateJWK');
      const pubKeyString = window.localStorage.getItem('sessionPublicJWK');
      this.sessionProof = window.localStorage.getItem('sessionProof');
      this.sessionId = window.localStorage.getItem('sessionId');
      if (privKeyString) {
        this.config.keys.privateKey = await crypto.subtle.importKey('jwk', JSON.parse(privKeyString), {
          name: ALGO.name,
          hash: HASH
        }, true, ['sign']);
      }
      if (pubKeyString) {
        this.config.keys.publicKey = await crypto.subtle.importKey('jwk', JSON.parse(pubKeyString), {
          name: ALGO.name,
          hash: HASH
        }, true, ['verify']);
      }
    }

    // generate a new key
    let newSession = false;
    if (!this.config.keys.privateKey && !this.config.keys.publicKey) {
      newSession = true;
      this.sessionId = UUID();
      this.log('Generating key...');
      this.keyPair = await crypto.subtle.generateKey({
        name: ALGO.name,
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: HASH
      }, true, CAPS);
      this.config.keys.privateKey = this.keyPair.privateKey;
      this.config.keys.publicKey = this.keyPair.publicKey;

      this.log('Generated. Exporting for signing and storage...');
      const privExport = await crypto.subtle.exportKey('jwk', this.config.keys.privateKey);
      const pubExport = await crypto.subtle.exportKey('jwk', this.config.keys.publicKey);
      this.log('Exported. Signing public session key...');
      const identity =  `${Base64.encode(this.config.userId)}::${this.sessionId}::${Base64.encode(JSON.stringify(pubExport))}`;
      const sig = await this.config.funcs.signIdentity(identity);
      this.sessionProof = `${identity}.${sig}`;
      this.log('Signed.');

      if (isBrowser) {
        this.log('Storing keys');
        window.localStorage.setItem('sessionPrivateJWK', JSON.stringify(privExport));
        window.localStorage.setItem('sessionPublicJWK', JSON.stringify(pubExport));
        window.localStorage.setItem('sessionProof', this.sessionProof);
        window.localStorage.setItem('sessionId', this.sessionId);
        this.log('Stored.');
      }

      /*
      console.log('showing key');
      console.log(JSON.stringify({
        publicKey: pubExport,
        privateKey: privExport
      }, null, 2));
      */

    } else {
      this.log('Loaded session keys from localstorage');
    }
    this.log('Generated Proof');
    this.log("Starting network for CRDT");
    this.metaData.sessions.on('change', (e) => {

      //TODO optimize
      this.sessions = this.metaData.sessions.value();
    });
    this.permissions = new Map();
    this.metaData.permissions.on('change', (e) => {

      //TODO optimize
      this.permissions = this.metaData.permissions.value();
    });
    this.sessions = new Map();
    await this.metaData.network.start();


    this.log('Waiting for app metadata to resolve');
    await new Promise((resolve, reject) => {
      setTimeout(resolve, 5000);
    });

    const permissions = this.metaData.permissions.value();
    if (permissions.size === 0 && this.config.permissions) {
      this.log("Permissions don't exist (fresh app), writing permissions.");
      //TODO make sure you have permission to update permissions
      for (const name of Object.keys(this.config.permissions)) {
        this.log(`setting permissions for ${name} ${this.config.permissions[name]}`);
        await this.metaData.permissions.set(name, this.config.permissions[name]);
      }
    }

    if (newSession && !this.sessions.has(this.sessionId)) {
      this.log("Setting session key...");
      const pubExport = await crypto.subtle.exportKey('jwk', this.config.keys.publicKey);
      this.log('session id ' +  this.sessionId);
      this.metaData.sessions.set(this.sessionId, {id: this.config.userId, proof: this.sessionProof, publicKey: pubExport});
      this.log("Done.");
    }

    this.log("Starting table network...");
    this.tableData = this.TablesType.create(`${this.config.appId}-tables`, {
      signAndEncrypt: this.handleEncryptTable.bind(this),
      decryptAndVerify: this.handleDecryptTable.bind(this),
      sign: () => "",
      authenticate: (e) => {
        const [opB, sigStr] = e.split('.');
        return true;
      },
      validate: (id, log) => {
        const [_, table] = id.split('/');
        const value = log[2];
        if (!this.permissions.has(`user:${value._id}`)) {
          this.errorLog(`NO_PERMISSION`);
          return false;
        }
        let perms = this.permissions.get(`user:${value._id}`);
        if (Array.isArray(perms)) {
          perms = perms[0];
        }
        if (!Array.isArray(perms[table])) {
          this.errorLog(`${value._id} does not have permissions to ${table}`);
          return false;
        }
        perms = new Set(perms[table]);
        if (perms.has('*')) {
          return true;
        }
        //TODO optimize
        const tabledata = this.tableData[table].value();
        if (tabledata.has(log[1])) {
          let existing = tabledata.get(log[1]);
          if (Array.isArray(existing)) {
            existing = existing[0];
          }
          if (existing._id !== value._id && !perms.has('rewrite-other')) {
            this.errorLog('PERM_CANNOT_REWRITE_OTHER');
            return false;
          }
          if (existing._id === value._id) {
            if (value._action ===  'delete' && !perms.has('delete-self')) {
              this.errorLog('PERM_CANNOT_DELETE_OWN');
              return false;
            } else if (!perms.has('rewrite-self')) {
              this.errorLog('PERM_CANNOT_REWRITE_OWN');
              return false;
            }
          }
        } else if (!perms.has('new')) {
          this.errorLog('PERM_CANNOT_CREATE');
          return false;
        }
        return true;
      }
    });

    await this.tableData.network.start();
    this.log("Network started.");
  }

  handleEncryptMeta(operation) {
    return JSON.stringify(operation);
  }

  handleDecryptMeta(operation) {
    const op = JSON.parse(operation);
    return op;
  }

  log(txt) {
    if (this.config.log) {
      this.config.log(txt);
    }
  }

  errorLog(txt) {
    if (this.config.errorLog) {
      this.config.errorLog(txt);
    }
  }

  async handleEncryptTable(operation) {
    operation[2]._id = this.config.userId;
    operation[2]._session = this.sessionId;
    //const sigArr = await crypto.subtle.sign(ALGO , privKey, Buffer.from(sesskey, 'utf8'));
    const stringOp = Base64.encode(JSON.stringify(operation));
    const sigArr = await crypto.subtle.sign(ALGO, this.config.keys.privateKey, Buffer.from(stringOp), 'utf8');
    const sig = btoa(
      new Uint8Array(sigArr).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    return `${stringOp}.${sig}`;
  }

  async handleDecryptTable(operation) {
    operation = Buffer.from(operation).toString('utf8');
    const [stringOp, sigStr] = operation.split('.');
    let sig;
    try {
      sig = Uint8Array.from(atob(sigStr), c => c.charCodeAt(0))
    } catch (e) {
      this.errorLog('DECRYPT_BAD_SIG');
      return false;
    }
    const op = JSON.parse(Base64.decode(stringOp));
    const session = op[2]._session;
    if (!this.sessions.has(session)) {
      this.errorLog('DECRYPT_UNKNOWN_SESSION');
      return false;
    }
    if (!this.keyCache.has(session)) {
      const keyJSON = this.sessions.get(session)[0].publicKey;
      const key = await crypto.subtle.importKey('jwk', keyJSON, { name: ALGO.name, hash: HASH }, true, ['verify']);
      this.keyCache.set(session, key);
    }
    const publicKey = this.keyCache.get(session);
    const verified = await crypto.subtle.verify(ALGO, publicKey, sig, Buffer.from(stringOp, 'utf8'));
    if (!verified) {
      this.errorLog('DECRYPT_FAILED_VALIDATION');
      return false;
    }
    return op;
  }

}

module.exports = IPFSDAppPlatform;
