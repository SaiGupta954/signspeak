# SignSpeak — Speech to Sign Language

**Live demo:** https://saigupta954.github.io/signspeak/

Speak or type a sentence, and a 3D human signs it in ASL fingerspelling.
A few words (HELLO, THANK YOU, YES, NO, I LOVE YOU) use whole-word signs.

## Run

```bash
npm install
npm run dev
```

Open the URL in Chrome or Edge. The 🎤 button needs the microphone, which works on localhost.

## Sign → Text (for Deaf users)

Switch to **🤟 Sign → Text** in the bottom panel and allow the camera. Fingerspell letters to the webcam: hold each letter still until the ring fills and it's typed. Lower your hand for a moment to add a space. Then press **🔊 Say it** to speak the text aloud, or **Sign it back** to have the avatar sign it.

Hand tracking uses Google's MediaPipe Hands, hosted on this site and running entirely in the browser (camera video never leaves the device). Letters are matched with hand-shape rules in `src/recognize/classify.ts`. It reads still letters (not J or Z) and works best with good light, one hand, palm facing the camera. It's a learning demo, not a full sign-language translator.

## Recording mode

Open the site with `#record` at the end of the URL, for example https://saigupta954.github.io/signspeak/#record. Only the signer is shown, the cursor is hidden, and "Hello, nice to meet you" plays automatically. Use `#record=Your phrase` for a different phrase. Click anywhere to replay.

## Files

```
src/
  App.tsx                  the page: 3D view, words, mic button, text box
  MenuBar.tsx              menu bar: View, Settings, Alphabet, History, Avatar, Help
  store.ts                 what's playing (Zustand)
  hooks/useSpeechRecognition.ts   speech → text (Web Speech API)
  recognize/
    classify.ts            hand landmarks → ASL letter (rules)
    useSignRecognizer.ts   webcam + MediaPipe Hands + hold-to-type logic
    SignCamera.tsx         the Sign → Text panel
  sign/
    handshapes.ts          finger positions for A–Z and 0–9
    lexicon.ts             the few whole-word signs
    sequencer.ts           sentence → list of signs
    driver.ts              timing and smooth transitions
  three/
    Stage.tsx              3D scene and lights
    HumanAvatar.tsx        loads the human model
    rig.ts                 moves the arm, wrist and fingers
    loader.ts              model loader
public/models/michelle.json   the 3D human (from the three.js examples, originally Mixamo)
```

The handshapes are simplified, so this is a learning and demo project, not a full ASL translator.
