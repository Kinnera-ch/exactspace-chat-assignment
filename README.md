# Exactspace Team Chat

A React chat assignment with randomized authors, per-message likes, emoji insertion, user mentions, and real-time updates over Socket.IO.

## Run locally

```sh
npm install
npm run dev
```

This starts the Vite client and the Express/Socket.IO server. Open the URL printed by Vite.

## Production build

```sh
npm run build
npm start
```

The production server serves the built app and handles Socket.IO connections on port 3001 by default. Messages and likes are held in memory and reset when the server restarts.
