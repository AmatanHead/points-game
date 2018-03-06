pragma solidity ^0.4.17;

contract Dots {
    event Update();

    struct Point {
        address pointTakenBy;  // player who put a point to this position
        address territoryBelongsTo;  // player who owns this territory
        uint areaId;
    }

    uint currentMove;

    address public player1;
    address public player2;

    address public currentPlayer;

    address public winner;

    bool public gameOver;

    mapping (address => uint) public stakes;

    mapping (address => bool) public drawOffers;
    mapping (address => bool) public finishOffers;

    int constant width = 20;
    int constant height = 15;

    Point[height][width] public field;

    function Dots(address other) public payable {
        player1 = msg.sender;
        player2 = other;

        require(player1 != player2);

        currentPlayer = msg.sender;

        winner = address(0);

        gameOver = false;

        stakes[player1] = 0;
        stakes[player2] = 0;

        drawOffers[player1] = false;
        drawOffers[player2] = false;
    }


    // Game finishing negotiations
    // ===========================

    // Resign and give all stakes to the opponent.
    function resign() public {
        require(!gameOver && msg.sender == currentPlayer);

        gameOver = true;
        winner = msg.sender == player1 ? player2 : player1;

        Update();
    }

    // Offer a draw. Players can only offer draws in theirs move.
    function offerDraw() public {
        require(!gameOver && msg.sender == currentPlayer);

        drawOffers[msg.sender] = true;

        if (drawOffers[player1] && drawOffers[player2]) {
            gameOver = true;
            winner = address(0);
            Update();
        }
    }

    // Revoke draw offer. Players can only revoke draw offers in theirs move.
    function revokeDrawOffer() public {
        require(!gameOver && msg.sender == currentPlayer);

        drawOffers[msg.sender] = false;
    }

    // Offer to finish the game now and determine the winner following the
    // game rules.
    function offerFinish() public {
        require(!gameOver && msg.sender == currentPlayer);

        finishOffers[msg.sender] = true;

        if (finishOffers[player1] && finishOffers[player2]) {
            finishGameAndSetWinner();
            Update();
        }
    }

    // Revoke finish offer.
    function revokeFinishOffer() public {
        require(!gameOver && msg.sender == currentPlayer);

        finishOffers[msg.sender] = false;
    }


    // Stakes control
    // ==============

    // Uncomment to enable stakes. Note: the frontend doesn't support this.

    // Raise stake for this game. The other player will be forced to raise
    // its stake or resign. Players can only raise in theirs move.
    // function raise() public payable {
    //     require(!gameOver && msg.sender == currentPlayer);
    //
    //     stakes[msg.sender] += msg.value;
    // }

    // Claim the reward.
    // function withdraw() public returns (bool) {
    //     require(gameOver);
    //
    //     uint amount = stakes[msg.sender];
    //
    //     if (amount > 0) {
    //         stakes[msg.sender] = 0;
    //
    //         if (!msg.sender.send(amount)) {
    //             stakes[msg.sender] = amount;
    //             return false;
    //         }
    //     }
    //
    //     return true;
    // }


    // Public game logic interface
    // ===========================

    function getField() view public returns (Point[height][width]) {
        return field;
    }

    // Make a move, i.e. place a new dot.
    function move(int x, int y) public {
        require(!gameOver && stakes[player1] == stakes[player2] && msg.sender == currentPlayer);

        require(0 <= x && x < width);
        require(0 <= y && y < height);

        require(field[uint(x)][uint(y)].pointTakenBy == address(0) && field[uint(x)][uint(y)].territoryBelongsTo == address(0));

        currentMove += 1;

        field[uint(x)][uint(y)].pointTakenBy = msg.sender;

        if (isLinePart(x, y)) {
            maybeMarkCaptured(x + 1, y, msg.sender);
            maybeMarkCaptured(x - 1, y, msg.sender);
            maybeMarkCaptured(x, y + 1, msg.sender);
            maybeMarkCaptured(x, y - 1, msg.sender);
        }

        if (field[uint(x)][uint(y)].territoryBelongsTo == address(0)) {
            maybeMarkCaptured(x, y, msg.sender == player1 ? player2 : player1);
        }

        currentPlayer = msg.sender == player1 ? player2 : player1;

        Update();

        for (int x_ = 0; x_ < width; x_ += 1) {
            for (int y_ = 0; y_ < height; y_ += 1) {
                if (
                    field[uint(x_)][uint(y_)].territoryBelongsTo == address(0) &&
                    field[uint(x_)][uint(y_)].pointTakenBy == address(0)
                )  {
                    return;
                }
            }
        }

        finishGameAndSetWinner();
    }


    // Game logic
    // ==========

    // Finish game with a draw.
    function finishGameWithNoWinner() internal {
        require(!gameOver);

        gameOver = true;

        winner = address(0);
    }

    // Finish game and set winner.
    function finishGameAndSetWinner() internal {
        assert(!gameOver);

        gameOver = true;

        uint player1Score = 0;
        uint player2Score = 0;

        for (int x = 0; x < width; x += 1) {
            for (int y = 0; y < height; y += 1) {
                if (
                    field[uint(x)][uint(y)].territoryBelongsTo != address(0) &&
                    field[uint(x)][uint(y)].pointTakenBy != address(0) &&
                    field[uint(x)][uint(y)].territoryBelongsTo != field[uint(x)][uint(y)].pointTakenBy
                )  {
                    if (field[uint(x)][uint(y)].territoryBelongsTo == player1) {
                        player1Score += 1;
                    } else {
                        player2Score += 1;
                    }
                }
            }
        }

        if (player1Score > player2Score) {
            winner = player1;
            stakes[player1] += stakes[player2];
            stakes[player2] = 0;
        } else if (player2Score > player1Score) {
            winner = player2;
            stakes[player2] += stakes[player1];
            stakes[player1] = 0;
        } else {
            winner = address(0);
        }
    }

    // Check if point at the given coordinate is part of a line composed
    // of points of the same size.
    function isLinePart(int x, int y) internal view returns (bool) {
        if (_isLinePart(x, y, x - 1, y - 1, x - 1, y + 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y - 1, x + 0, y + 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y - 1, x + 1, y - 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y - 1, x + 1, y + 0)) { return true; }
        if (_isLinePart(x, y, x - 1, y - 1, x + 1, y + 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y + 0, x + 1, y - 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y + 0, x + 1, y + 0)) { return true; }
        if (_isLinePart(x, y, x - 1, y + 0, x + 1, y + 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y + 1, x + 0, y - 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y + 1, x + 1, y - 1)) { return true; }
        if (_isLinePart(x, y, x - 1, y + 1, x + 1, y + 0)) { return true; }
        if (_isLinePart(x, y, x - 1, y + 1, x + 1, y + 1)) { return true; }
        if (_isLinePart(x, y, x + 0, y - 1, x + 0, y + 1)) { return true; }
        if (_isLinePart(x, y, x + 0, y - 1, x + 1, y + 1)) { return true; }
        if (_isLinePart(x, y, x + 0, y + 1, x + 1, y - 1)) { return true; }
        if (_isLinePart(x, y, x + 1, y - 1, x + 1, y + 1)) { return true; }
        return false;
    }

    // Internal for isLinePart.
    function _isLinePart(int x, int y, int x1, int y1, int x2, int y2) internal view returns (bool) {
        return (
        isOnMap(x, y) && isOnMap(x1, y1) && isOnMap(x2, y2) &&
        field[uint(x1)][uint(y1)].pointTakenBy == field[uint(x)][uint(y)].pointTakenBy &&
        field[uint(x2)][uint(y2)].pointTakenBy == field[uint(x)][uint(y)].pointTakenBy
        );
    }

    // Check if this point is in the area encircled by the given player.
    // If yes, mark new area of encirclement on the map.
    function maybeMarkCaptured(int x, int y, address who) internal {
        if (!isOnMap(x, y)) {
            return;
        }

        address opponent = msg.sender == player1 ? player2 : player1;

        bool[height][width] memory state;

        for (int x_ = 0; x_ < width; x_ += 1) {
            for (int y_ = 0; y_ < height; y_ += 1) {
                state[uint(x_)][uint(y_)] = false;
            }
        }

        if (!_maybeMarkCaptured(x, y, who, state)) {
            return;
        }

        for (x_ = 0; x_ < width; x_ += 1) {
            for (y_ = 0; y_ < height; y_ += 1) {
                if (state[uint(x_)][uint(y_)] && field[uint(x_)][uint(y_)].pointTakenBy == opponent) {
                    for (x_ = 0; x_ < width; x_ += 1) {
                        for (y_ = 0; y_ < height; y_ += 1) {
                            if (state[uint(x_)][uint(y_)]) {
                                field[uint(x_)][uint(y_)].territoryBelongsTo = who;
                                field[uint(x_)][uint(y_)].areaId = currentMove;
                            }
                        }
                    }
                    return;
                }
            }
        }
    }

    // Internal for maybeMarkCaptured. Returns true if the given area is captured.
    function _maybeMarkCaptured(int x, int y, address who, bool[height][width] state) internal view returns (bool) {
        if (!isOnMap(x, y)) {
            return false;
        }

        if (state[uint(x)][uint(y)]) {
            return true;
        }

        state[uint(x)][uint(y)] = true;

        if (field[uint(x)][uint(y)].pointTakenBy == who && (field[uint(x)][uint(y)].territoryBelongsTo == who || field[uint(x)][uint(y)].territoryBelongsTo == address(0))) {
            return true;
        }

        if(!_maybeMarkCaptured(x + 1, y, who, state)) {
            return false;
        }

        if(!_maybeMarkCaptured(x - 1, y, who, state)) {
            return false;
        }

        if(!_maybeMarkCaptured(x, y + 1, who, state)) {
            return false;
        }

        if(!_maybeMarkCaptured(x, y - 1, who, state)) {
            return false;
        }

        return true;
    }

    // Check if given coordinates fit within the map.
    function isOnMap(int x, int y) internal pure returns (bool) {
        return 0 <= x && x < width && 0 <= y && y < height;
    }
}

// UID:  0x255a63a97e1c431ef29d4ee52110432b5fdbd8d6 0x604739053e48051413d6adf8b37170a63205c570
// personal.unlockAccount("0x255a63a97e1c431ef29d4ee52110432b5fdbd8d6", "", 1000000)
// personal.unlockAccount("0x604739053e48051413d6adf8b37170a63205c570", "", 1000000)