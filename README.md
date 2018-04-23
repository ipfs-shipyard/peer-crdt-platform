# peer-crdt-platform

## Installing

`npm install peer-crdt-platform`

## Usage / Configuration

### Example
```js 

const PeerCRDTPlatform = require('peer-crdt-platform');

(async () => {

  const App = new PeerCRDTPlatform({
    userId: 'username/email/user-id',
    appId: 'unique-app-instance-id',
    funcs: {
      signIdentity: async (session_id) => {
        //return signed proof of identity
      }
    },
    tables: {
      //list of table definitions
      contacts: { 
        def: { given: 'string', surname: 'string', email: 'string'},
        index: ['email', 'surname']
    }
  });
  await App.initialize();
})();
```

## Tables

### insert
### delete
### replace
### select
### find
### where
### count

