# LexiPerch

A responsive, local-first vocabulary notebook with word discovery, quizzes, and a letter-tile puzzle.

## Run locally

For reliable browser storage, serve this folder with a static web server. With Python installed, run `python -m http.server 8000` in this folder and open `http://localhost:8000`. You can also open `index.html` directly, though local-file storage behavior depends on the browser.

The app has no build step, package installation, API key, or server-side dependency. Google Fonts are optional; system fonts are used if they cannot load. Speech playback depends on browser speech support.

## Features

- Daily word, searchable dictionary, and difficulty filters
- Add, edit, delete, save, and explore personal vocabulary
- Random quizzes of up to ten words, with four distinct answer choices per question
- Five-round letter-tile word puzzle with meaning clues and hints
- Browser speech playback, learning streaks, and quiz score tracking
- JSON export and restore for personal words and learning progress
- Responsive navigation and layouts

## Vocabulary and storage

The bundled dictionary has 1,000 unique entries: 18 curated learner words and 982 definitions derived from Princeton WordNet 3.0. Eighteen entries include pronunciation data; 805 include example sentences. When pronunciation is missing, the app says so and offers browser speech playback when available. When an example is missing, the app invites the learner to write a sentence.

The shipped data is in vocabulary.js. The WordNet source corpus and a data-generation script are not included, so rebuilding the dataset requires supplying those source materials or editing the bundled file.

WordNet is licensed. Keep `WORDNET_LICENSE.txt` with the project and preserve the attribution in the page footer and vocabulary source.

Custom words, profile name, saved words, and learning progress are stored in this browser with `localStorage`. They are not uploaded to an account or synced across devices. Use **Export backup** to move or preserve them before changing browsers or devices, or clearing browser data. There are no accounts or shared database. Quiz word-cycle history stays in the current page session, resets after a reload, and starts a new cycle after every word has been used.

## Deployment

Upload the project files together to any static web host, preserving their filenames and relative paths. No server-side setup is required. Use HTTPS for the hosted site and verify the deployed page, vocabulary, logo, license link, quiz, puzzle, and backup flow at the public URL.

## Files

- `index.html` — page structure and controls
- `styles.css` — responsive layout and styling
- `script.js` — app behavior, local persistence, dictionary, quiz, puzzle, and backups
- `vocabulary.js` — the 1,000 bundled vocabulary entries and WordNet notice
- `lexiperch-logo.svg` — LexiPerch logo mark
- `lexiperch-favicon.svg` — LexiPerch browser icon
- `WORDNET_LICENSE.txt` — required WordNet copyright and license notice
