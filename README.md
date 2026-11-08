# ScrabbleBot — HackUTD 2026

TypeScript bot for the Spacetime ScrabbleBot Tournament (Sat Nov 7, 10:45 PM, ECSW 1.315).

## Run it

1. `npm install`
2. First run (needs the token from your team page on scrabblebot.spacetimedb.com):
   `BOT_NAME=<bot name> BOT_TOKEN=<token> npm start`
   The token is saved to `.token-<bot name>`, so later runs only need `BOT_NAME=<name> npm start`.
3. Tournament: `BOT_NAME=<name> TOURNAMENT_ID=<id> npm start`
   Get the tournament ID from scrabblebot.spacetimedb.com/tournament once the admin opens registration. The bot registers itself when it connects.
4. Keep it running from 10:45 PM onward. A registered bot that's offline still gets seated and loses every auction it doesn't bid in.

## Strategy

`src/strategy.ts` — `decideBid` bids each letter's true value (correct under the default Vickrey auction: winner pays the runner-up's bid), with a premium for letters that complete words from your rack, a discount for duplicates, and a balance reserve so you don't go broke early. `chooseWord` plays the highest-scoring word (letter values × length multiplier), not just the longest.

## Tests

`npm test` — 8 tests, all passing. `npm run build` — clean.

## Notes

- The wordlist lives in `spacetimedb/wordlist.txt` (the server's own list, 172,820 words).
- Bindings in `src/module_bindings/` were generated with `spacetime generate` (CLI v2.14.1). If you change the module, regenerate from the upstream repo layout.
- Never commit your `.token-<name>` file or paste your token in chat.
