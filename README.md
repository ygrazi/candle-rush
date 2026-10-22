# Mazal Pop!

A Jewish-themed bubble shooter for frum families. Match three of the same character, drop Haman for bonus gelt, and beat candle lighting before the Jerusalem stone comes down.

**Play:** https://ygrazi.github.io/mazal-pop/

## Put it on your phone

- **iPhone / iPad:** open the link in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the ⋮ menu, then **Install app** (or **Add to Home screen**).

It opens full screen like a normal app, and after the first visit it works offline.

## How it plays

- Aim and let go (or click on a computer). Walls bounce.
- Match 3 or more of the same character to pop them. Anything left hanging falls for big bonus gelt.
- **Candles In:** every miss costs minutes on the Shabbat clock (18 minutes, like candle lighting). Dropping pieces buys time back. At zero, the Jerusalem stone wall comes down a row.
- Tap **Next** to swap your current piece.
- Keyboard: arrows to aim, Space to shoot, X to swap, P to pause, M to mute.

## The cast

| Piece | What it does |
|---|---|
| Zaidy, Shmuli, Reb Yanky, Moishy, Chazzan, Dod Ezra | The six matchable characters |
| Hamsa | Wildcard, matches anyone next to it |
| Mud brick (from Mitzrayim) | Can't be matched, only dropped |
| Haman | Can't be matched. Drop him for +250 gelt and a grogger |

Levels travel through Toledo, the Shtetl, Fez, Odessa, Aleppo, Salonika, Ellis Island, the Lower East Side and Ocean Parkway, ending in Yerushalayim.

## Code

Plain HTML, CSS and JavaScript with no build step. All art and sound are generated in code.

- `index.html`: page and menus
- `game.js`: the game
- `style.css`: menus and layout
- `sw.js`, `manifest.webmanifest`, `icons/`: install-to-home-screen and offline support

To run it locally, serve the folder (for example `python3 -m http.server`) and open http://localhost:8000.
