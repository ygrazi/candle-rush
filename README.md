# Candle Rush

**Created by Yitzhak Grazi**

A Jewish-themed bubble shooter for frum families. Match three of the same character, drop Haman for bonus gelt, and clear the board before candle lighting brings the Jerusalem stone down.

**Play:** https://ygrazi.github.io/candle-rush/

## Put it on your phone

- **iPhone / iPad:** open the link in Safari, tap Share, then **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the ⋮ menu, then **Install app** (or **Add to Home screen**).

It opens full screen like a normal app, and after the first visit it works offline.

## How it plays

- Aim and let go (or click on a computer). Walls bounce.
- Match 3 or more of the same character to pop them. Anything left hanging falls for big bonus gelt.
- **Candles In:** every miss costs minutes on the Shabbat clock (18 minutes, like candle lighting). Dropping pieces buys time back. At zero, the Jerusalem stone wall comes down a row.
- Tap **Next** to swap your current piece.
- **Your name:** asked the first time you play (first name or nickname). Change it from the title screen.
- **Pause menu:** Resume, Restart level, Change difficulty, or End game. Ending a game (or switching difficulty) saves your score.
- **Stop anytime:** the game saves itself after every shot. Close the app and next time tap **Resume** to get the same board, gelt and difficulty back. Tapping **New game** instead puts the unfinished game's score on the high scores first.
- **Music and Sounds:** separate on/off switches. During a game, use the music-note and speaker buttons in the top bar; on the title screen and in the pause menu, use the Music and Sounds buttons.
- **High scores:** top 10 for each difficulty, for **Everyone** (online, shared by all players) or **This device**. Scores made offline are sent the next time the phone is online.
- **Difficulty:** pick one each time you tap Play or Continue. Best scores are kept per difficulty.

| Difficulty | Aim guide | Candle clock | Gelt |
|---|---|---|---|
| Kids | Full path + landing spot | Misses cost less, fewer characters | ½× |
| Easy | Full path + landing spot | Normal | 1× |
| Medium | Short guide, up to the first bounce | Normal | 1½× |
| Hard | None | Faster, an extra brick | 2× |
| Erev Pesach | None | Fastest, extra bricks and a Haman | 3× |

- **Music:** an original klezmer/Sephardic-style tune that speeds up as candle lighting gets close.
- Keyboard: arrows to aim, Space to shoot, X to swap, P to pause, M mutes everything, N music on/off, B sounds on/off.

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

© 2026 Yitzhak Grazi

## Online scoreboard

Scores for everyone live in Firebase Firestore (project `candle-rush`, free plan). The game talks to it over plain REST; the public web key in `game.js` is meant to be public, and the database rules only allow reading the boards and adding a score with sane values. Nobody can edit or delete scores from the game.

To remove a score (say, a rude name): Firebase console → Candle Rush → Firestore Database → Data → open the `scores_<difficulty>` collection → delete the document.
