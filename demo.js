const PeerCRDTPlatform = require('./src/index.js');
const IdenityKey = require('./test/data/masterkeys.jwk.json');
const StayDown = require('staydown');
const UUID = require('uuid/v4');

const ALGO = { name: 'RSASSA-PKCS1-v1_5' };
const CAPS = ['sign', 'verify'];
const HASH = { name: 'SHA-512' };


window.initializePeer = async (config, id, IdentityKey) => {

  //window.localStorage.clear();

  const tables = {
    chat: {msg: 'string'}
  };

  //this function will call out to the API server to have the session key signed for it
  //but we don't have an identity API server yet so....
  config.funcs.signIdentity = async (sesskey) => {
    const privKey = await crypto.subtle.importKey('jwk', IdentityKey.privateKey, { name: ALGO.name, hash: HASH }, true, ['sign']);
    if (typeof sesskey !== 'string') {
      sesskey = JSON.stringify(sesskey);
    }
    const sigArr = await crypto.subtle.sign(ALGO , privKey, Buffer.from(sesskey, 'utf8'));

    //convert to base64, so sayeth stackoverflow
    const sig = btoa(
      new Uint8Array(sigArr).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    return sig;
  };

  config.id = id;
  config.tables = tables;

  const App = new PeerCRDTPlatform(config);
  await App.initialize();
  App.data.tables.chat.on('change', (e) => {
    console.log('chat changed', e);
    if (e.type === 'set') {
      const value = e.value;
      const chatdiv = document.createElement('div');
      const chattxt = document.createTextNode('chat: ' + value);
      chatInput.value = '';
      chatdiv.appendChild(chattxt);
      staydown.append(chatdiv);
    }
  });

  const chatInput = document.getElementById('chatInput');
  chatInput.addEventListener('keyup', (e) => {
    if (e.keyCode === 13) {
      const value = chatInput.value;
      App.data.tables.chat.set(UUID(), value);
    }
  });
};

const clearStorageButton = document.getElementById('clearStorageButton');
clearStorageButton.addEventListener('click', () => {
  console.log('Clearing local storage. Next time, a session key pair will have to be generated and signed.');
  window.localStorage.clear();
});

const chatDiv = document.getElementById('chat');

var staydown = new StayDown({
  target: chatDiv,
  interval: 1000,
  max: 50,
  stickyHeight: 10,
});


async function start(id, identityKeys) {
  console.log('Starting demo 1');
  await initializePeer({funcs: {}
  }, id, identityKeys);
};

window.start = start;
