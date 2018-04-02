# Running the Demo

`npm install
npm start`

Load chrome with 3 different profiles.
Let the first one run for about 10 seconds before starting the others to establish the base data of the application.

```sh
google-chrome --profile-directory="Demo 1" http://localhost:8080/demo1.html
google-chrome --profile-directory="Demo 2" http://localhost:8080/demo2.html
google-chrome --profile-directory="Demo 3" http://localhost:8080/demo3.html
```

## What's the demo doing?

1. Each window needs to generate a session key and sign it with their master identity key.
In the future, the identity server will hold the idenity key and sign session keys for you.
It signs a proof that the user-id, session-id, and session key are all associated and belong to the identity.

2. Demo1 is the admin, and establishes the application permissions on it's first run, which are stored in the IPFS DAG.

3. All of the demo windows will store their session and proof in the dag and wait for the application metadata to sync, then will load the application tables.

4. The 3 different windows have different permissions. Demo1/admin can delete anyone's messages, demo2 can only delete their own, and demo3 doesn't have permission to delete any message.

Every message sent generates an operation in peer-crdt, which gets their user-id and session-id added, and signed.
When a client receives a new operation, it checks the signature to make sure it matches the contained session-id, which in turn is verified by the identity proof.
Once an operation is verified as valid, the permissions are checked at each client. Even a bad actor that doesn't verify their own permissions will not be able to fool the other clients.

Any application state can be stored in the tables, but for this demo, it's simply chat. Clicking on the X's attempts to delete the message.

