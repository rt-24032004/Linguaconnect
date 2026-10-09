# LinguaConnect

A language-exchange app. You are matched with someone whose native language is
the one you are learning, and who is learning a language you speak at C2. From
there you can chat with translation, take phone and video calls, quiz yourself
on grammar and vocabulary, keep a practice streak, join group rooms, and book
sessions with certified teachers.

## What is in this folder

| Path | What it is |
|---|---|
| `index.html` | The whole app, ready to run in a browser on its own. Open it, type a name, and everything is stored in that browser. |
| `src/app.html` | The app source. It expects the Claude artifact runtime for sign-in, the shared database and AI features. |
| `src/standalone-shim.js` | The stand-in for that runtime: local sign-in and a database kept in the browser's storage. |
| `tools/build-standalone.py` | Builds `index.html` by inserting the shim into `src/app.html`. |
| `reference/v5-app.html` | An earlier version, kept as a reference point. |

## Running it

Open `index.html` in any modern browser. On the first visit it asks for a name;
nothing leaves the machine. Open it in a second tab as a different person and
the two can message each other.

In standalone mode there is no server, so the AI features (quiz, translation,
smart demo replies) are switched off, and the two demo partners reply with
fixed lines instead.

## Rebuilding

After editing `src/app.html` or `src/standalone-shim.js`:

```bash
cd tools && python build-standalone.py
```

That regenerates the standalone build.

## What a real deployment still needs

- **Sign-in and database:** Firebase Auth and Firestore, in place of the
  artifact runtime.
- **AI features:** a small server function holding the Claude API key, since a
  key must never sit in a web page.
- **Calls:** the WebRTC code works peer to peer already; restrictive networks
  also need a TURN relay.
- **Payments:** Stripe, later, for subscriptions and teacher payouts.

## Status

A working prototype, used for small user tests. Not yet a public product: there
is no identity verification, no staff review of the teaching certificates
people upload, and no payment processing.
