const PeerCRDTPlatform = require('../src/index.js');
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

  config.userId = id;
  config.tables = tables;
  config.appId = 'peer-crdt-platform-demo3';
  config.permissions = {
    'user:admin@andyet.com': {'chat': ['*']},
    'user:demo2@andyet.com': {'chat': ['new', 'delete-self', 'rewrite-self']},
    'user:demo3@andyet.com': {'chat': ['new']}
  };

  function Log(txt) {
    const logDiv = document.createElement('div');
    const logTxt = document.createTextNode('Log: ' + txt);
    logDiv.appendChild(logTxt);
    staydown.append(logDiv);
  }

  function ErrorLog(txt) {
    const logDiv = document.createElement('div');
    const logTxt = document.createTextNode('Error: ' + txt);
    logDiv.appendChild(logTxt);
    staydown.append(logDiv);
  }

  config.log = Log;
  config.errorLog = ErrorLog;


  const App = new PeerCRDTPlatform(config);
  await App.initialize();
  App.tableData.chat.on('change', (e) => {
    if (e.type === 'set' && e.value._action !== 'delete') {
      const value = e.value.msg;
      const chatdiv = document.createElement('div');
      chatdiv.setAttribute('id', e.key);
      const chattxt = document.createTextNode(`${e.value._id}: ${value}`);
      const chata = document.createElement('a');
      const atxt = document.createTextNode(' X');
      chata.setAttribute('onclick', `deleteChat("${e.key}")`);
      chatInput.value = '';
      chatdiv.appendChild(chattxt);
      chata.appendChild(atxt);
      staydown.append(chatdiv);
      chatdiv.appendChild(chata);
    } else if (e.type === 'set' && e.value._action === 'delete') {
      console.log("DELETING", e);
      const div = document.getElementById(e.key);
      if (div) {
        div.remove();
      }
    }
  });


  window.deleteChat = (id) => {
    App.tableData.chat.set(id, { _action: 'delete' });
  };

  const chatInput = document.getElementById('chatInput');
  chatInput.addEventListener('keyup', (e) => {
    if (e.keyCode === 13) {
      const value = chatInput.value;
      App.tableData.chat.set(UUID(), {msg: value});
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
