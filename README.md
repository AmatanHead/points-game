# Points game

Points game over ethereum blockchain.


## Contract api

* **resign** — resign and give all stakes to the opponent.
* **offerDraw** — offer a draw. Players can only offer draws in theirs move.
* **revokeDrawOffer** — revoke draw offer. Players can only revoke draw offers in theirs move.
* **offerFinish** — offer to finish the game now and determine the winner following the game rules. Note: the opponent can accept the offer after you move.
* **revokeFinishOffer** — revoke finish offer.
* **raise** — raise stake for this game. The other player will be forced to raise its stake or resign. Players can only raise in theirs move.
* **withdraw** — claim the reward.
* **move** — make a move, i.e. place a new dot.
