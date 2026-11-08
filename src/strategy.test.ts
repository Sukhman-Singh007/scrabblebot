// Checks for the strategy. Run with `npm test`.

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { test } from "node:test";
import { chooseWord, decideBid } from "./strategy.js";

const rack = (letters: string) => {
  const r = new Map<string, number>();
  for (const c of letters) r.set(c, (r.get(c) ?? 0) + 1);
  return r;
};

test("chooseWord picks the longest word the rack can spell", () => {
  const dictionary = ["TACT", "CAT", "AT"];
  assert.equal(chooseWord({ myRack: rack("TACT"), dictionary }), "TACT");
  assert.equal(chooseWord({ myRack: rack("CATX"), dictionary }), "CAT");
  assert.equal(chooseWord({ myRack: rack("CX"), dictionary }), null);
});

// The bot can't see a match move on while it searches, so a slow search
// means bids on closed auctions and words from letters it already spent.
test("chooseWord searches the whole wordlist well within an auction", () => {
  const dictionary = fs
    .readFileSync(
      new URL("../spacetimedb/wordlist.txt", import.meta.url),
      "utf8",
    )
    .split("\n")
    .map((l) => l.trim().toUpperCase())
    .filter((l) => l.length >= 2)
    .sort((a, b) => b.length - a.length);
  // The largest rack an admin can set, with almost nothing to spell.
  const myRack = rack("BCDFGHJKLMNPQRSTVWXZ");
  const start = performance.now();
  chooseWord({ myRack, dictionary });
  assert.ok(performance.now() - start < 100, "a search took 100 ms or more");
});

test("decideBid pays more for a letter that completes a word", () => {
  // T completes CAT / ACT (5 pts) from CA; from QX it completes nothing.
  const completingT = decideBid({
    letter: "T",
    myBalance: 100,
    myRack: rack("CA"),
  });
  const uselessT = decideBid({
    letter: "T",
    myBalance: 100,
    myRack: rack("QX"),
  });
  assert.ok(completingT > uselessT, `CAT-completing T (${completingT}) should beat useless T (${uselessT})`);

  // E completes AXE (10 pts) from AX; from QZ it completes nothing.
  const completingE = decideBid({
    letter: "E",
    myBalance: 100,
    myRack: rack("AX"),
  });
  const uselessE = decideBid({
    letter: "E",
    myBalance: 100,
    myRack: rack("QZ"),
  });
  assert.ok(completingE > uselessE, `AXE-completing E (${completingE}) should beat useless E (${uselessE})`);
  assert.ok(completingE >= 5, "a letter completing a 10-pt word should be worth real coins");
});

test("decideBid does not overpay for duplicate letters", () => {
  // Z has face value 10 and completes nothing from these racks.
  const fresh = decideBid({ letter: "Z", myBalance: 100, myRack: rack("JK") });
  const thirdCopy = decideBid({
    letter: "Z",
    myBalance: 100,
    myRack: rack("JKZZ"),
  });
  const fourthCopy = decideBid({
    letter: "Z",
    myBalance: 100,
    myRack: rack("JKZZZ"),
  });
  assert.equal(fresh, 10, "first Z should be worth its face value");
  assert.ok(thirdCopy < fresh, "a 3rd copy should be worth much less");
  assert.ok(thirdCopy <= 6, `3rd Z should be cheap, got ${thirdCopy}`);
  assert.equal(fourthCopy, 0, "a 4th copy that completes nothing is worthless");
});

test("decideBid keeps a reserve and paces spending", () => {
  assert.equal(
    decideBid({ letter: "Z", myBalance: 0, myRack: rack("") }),
    0,
    "no balance means no bid",
  );
  // Tiny balance, non-completing letter: save the coins for a completing one.
  assert.equal(
    decideBid({ letter: "Z", myBalance: 4, myRack: rack("JK") }),
    0,
    "with 4 coins, don't spend on a letter that completes nothing",
  );
  // Same letter with a healthy balance bids face value.
  assert.equal(
    decideBid({ letter: "Z", myBalance: 100, myRack: rack("JK") }),
    10,
  );
  // Big completion, small balance: capped at 50% of balance early (10 of
  // 20), even though T completing QUIET/QUITE from QUIE is worth ~38.
  assert.equal(
    decideBid({ letter: "T", myBalance: 20, myRack: rack("QUIE") }),
    10,
  );
});

test("decideBid spends the whole balance late in the match", () => {
  // Same T completing QUIET/QUITE from QUIE, balance 20. Early it bids 10;
  // mid-match (40 auctions seen) it bids 15; late (70 seen) it bids all 20,
  // because coins left when the bag empties are worth nothing.
  const early = decideBid({
    letter: "T",
    myBalance: 20,
    myRack: rack("QUIE"),
    auctionsSeen: 0,
  });
  const mid = decideBid({
    letter: "T",
    myBalance: 20,
    myRack: rack("QUIE"),
    auctionsSeen: 40,
  });
  const late = decideBid({
    letter: "T",
    myBalance: 20,
    myRack: rack("QUIE"),
    auctionsSeen: 70,
  });
  assert.equal(early, 10);
  assert.equal(mid, 15);
  assert.equal(late, 20);
});

test("chooseWord picks the highest-scoring word, not merely the longest", () => {
  // QUIZ (22 x 1.5 = 33) outscores ABCDE (10 x 2 = 20) despite being shorter.
  assert.equal(
    chooseWord({
      myRack: rack("ABCDEQUIZ"),
      dictionary: ["ABCDE", "QUIZ"],
    }),
    "QUIZ",
  );
});

test("chooseWord returns null for an unplayable rack", () => {
  assert.equal(
    chooseWord({ myRack: rack("QXZ"), dictionary: ["CAT", "DOG", "AXE"] }),
    null,
  );
  assert.equal(
    chooseWord({ myRack: rack("Q"), dictionary: ["CAT", "DOG"] }),
    null,
  );
  assert.equal(chooseWord({ myRack: rack("CAT"), dictionary: [] }), null);
});

test("chooseWord holds for a much better one-letter-away word, but not for a small gain", () => {
  // QI (11) now vs QUIZ (33) one Z away: wait for the Z.
  assert.equal(
    chooseWord({ myRack: rack("QUI"), dictionary: ["QI", "QUIZ"] }),
    null,
  );
  // QUIZ already in hand: play it.
  assert.equal(
    chooseWord({ myRack: rack("QUIZ"), dictionary: ["QI", "QUIZ"] }),
    "QUIZ",
  );
  // CAT (5) now vs CATS (9) one S away: the gain is too small to wait.
  assert.equal(
    chooseWord({ myRack: rack("CAT"), dictionary: ["CAT", "CATS"] }),
    "CAT",
  );
  // BED (6) now vs BEDZ (24) one Z away: v1 held here (18 more, 4x), but
  // the gain is under the v2 bar of 20, so play now.
  assert.equal(
    chooseWord({ myRack: rack("BED"), dictionary: ["BED", "BEDZ"] }),
    "BED",
  );
});

test("chooseWord never holds late in the match", () => {
  // QI vs QUIZ is a hold early, but with 60 auctions seen the match is
  // nearly over -- play the QI now.
  assert.equal(
    chooseWord({
      myRack: rack("QUI"),
      dictionary: ["QI", "QUIZ"],
      auctionsSeen: 60,
    }),
    "QI",
  );
});
