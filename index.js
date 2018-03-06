const path = require('path');
const fs = require('fs');
const d3 = require('d3');
const Web3 = require('web3');
const electron = require('electron');

class WindowController {
    constructor(field, svg, header, menu) {
        this.openMenu = this.openMenu.bind(this);
        this.closeMenu = this.closeMenu.bind(this);
        this.onNodeUrlKeyUp = this.onNodeUrlKeyUp.bind(this);
        this.onNodeUrlChange = this.onNodeUrlChange.bind(this);
        this.onMyIdKeyUp = this.onMyIdKeyUp.bind(this);
        this.onMyIdChange = this.onMyIdChange.bind(this);
        this.onNewGameButtonPushed = this.onNewGameButtonPushed.bind(this);
        this.onJoinGameButtonPushed = this.onJoinGameButtonPushed.bind(this);
        this.onContractGenerated = this.onContractGenerated.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onDrawButton = this.onDrawButton.bind(this);
        this.onResignButton = this.onResignButton.bind(this);

        this.fieldElement = field;
        this.svg = svg;
        this.header = header;
        this.menu = menu;

        this.svg.select('#field__event_interceptor')
            .on('mousemove', this.onMouseMove)
            .on('click', this.onClick);

        this.cursor = this.svg.select('.field__cursor');

        this.electronWindow = require('electron').remote.getCurrentWindow();

        this.menuIsActive = false;

        this.nodeUrlInput = this.menu.select('#node_url');
        this.nodeUrlSpinner = this.menu.select('#node_url_spinner');

        this.nodeUrlInput.on('keyup', this.onNodeUrlKeyUp);

        this.headerDrawButton = this.header.select('#draw_button');
        this.headerDrawButton.on('click', this.onDrawButton);

        this.headerResignButton = this.header.select('#resign_button');
        this.headerResignButton.on('click', this.onResignButton);


        this.nodeUrlKeyUpTimeout = null;

        this.myIdInput = this.menu.select('#my_id');
        this.myIdSpinner = this.menu.select('#my_id_spinner');

        this.myIdInput.on('keyup', this.onMyIdKeyUp);

        this.myIdKeyUpTimeout = null;

        this.menuLoading = this.menu.select('#menu_loading');
        this.menuLoading.style('display', 'none');

        this.newGameButton = this.menu.select('#new_game_button');
        this.newGameButton.on('click', this.onNewGameButtonPushed);

        this.joinGameButton = this.menu.select('#join_game_button');
        this.joinGameButton.on('click', this.onJoinGameButtonPushed);

        this.opponentIdInput = this.menu.select('#opponent_id');
        this.contractIdInput = this.menu.select('#contract_id');

        this.headerContractIdV = this.header.select('#contract_id_v');
        this.headerRedIdV = this.header.select('#red_id_v');
        this.headerBlueIdV = this.header.select('#blue_id_v');
        this.headerRedScore = this.header.select('#red_score');
        this.headerBlueScore = this.header.select('#blue_score');
        this.headerMoveCaption = this.header.select('#move_caption');

        this.activeMove = false;

        this.field = null;

        this.updateInProgress = false;
        this.updateRequested = false;

        this.contract = null;

        this.web3 = new Web3();
        this.myId = null;

        const width = this.width = 20;
        const height = this.height = 15;
        const gridSize = this.gridSize = 20;
        const margins = this.margins = {
            top: 85,
            left: 15,
            right: 15,
            bottom: 15
        };

        svg.attr('width', width * gridSize + 2 + margins.left + margins.right);
        svg.attr('height', height * gridSize + 2 + margins.top + margins.bottom);

        field.style('height', svg.attr('height') + 'px');

        this.electronWindow.setContentSize(Number(svg.attr('width')), Number(svg.attr('height')) + 3);
        this.electronWindow.setResizable(false);

        svg
            .select('.field__grid_h')
            .selectAll('line')
            .data(d3.range(0, height, 1))
            .enter()
            .append('line')
            .attr('x1', 0)
            .attr('x2', width * gridSize + margins.left + margins.right)
            .attr('y1', d => d * gridSize + gridSize / 2 + margins.top)
            .attr('y2', d => d * gridSize + gridSize / 2 + margins.top);
        svg
            .select('.field__grid_v')
            .selectAll('line')
            .data(d3.range(0, width, 1))
            .enter()
            .append('line')
            .attr('x1', d => d * gridSize + gridSize / 2 + margins.left)
            .attr('x2', d => d * gridSize + gridSize / 2 + margins.left)
            .attr('y1', 0)
            .attr('y2', height * gridSize + margins.top + margins.bottom);
    }

    openMenu() {
        this.menu.style('top', 0);
        this.menuIsActive = true;
    }

    closeMenu() {
        this.menu.style('top', String(-this.menu.node().getBoundingClientRect().height - 20) + 'px');
        this.menuIsActive = false;
    }

    setLoading() {
        this.openMenu();
        this.menuLoading.style('display', null);
        this.menuIsActive = false;
    }

    unsetLoading() {
        this.openMenu();
        this.menuLoading.style('display', 'none');
    }

    onNodeUrlKeyUp() {
        if (!this.menuIsActive) return;

        if (this.nodeUrlKeyUpTimeout) {
            clearTimeout(this.nodeUrlKeyUpTimeout);
        }

        this.nodeUrlKeyUpTimeout = setTimeout(this.onNodeUrlChange, 300);
    }

    onNodeUrlChange() {
        if (!this.menuIsActive) return;

        const url = this.nodeUrlInput.node().value;

        if (this.web3.currentProvider && url === this.web3.currentProvider.host) { return; }

        this.nodeUrlSpinner
            .classed('hide', false)
            .classed('ok', false)
            .classed('err', false);

        const provider = new Web3.providers.HttpProvider(url);

        this.web3.setProvider(provider);

        provider.sendAsync(
            {id: 9999999999, jsonrpc: '2.0', method: 'net_listening', params: []},
            (err, res) => {
                if (this.nodeUrlInput.node().value !== url) { return; }
                if (err) {
                    console.error(err);

                    this.nodeUrlSpinner
                        .classed('hide', false)
                        .classed('ok', false)
                        .classed('err', true);
                } else {
                    this.nodeUrlSpinner
                        .classed('hide', false)
                        .classed('ok', true)
                        .classed('err', false);

                    if (!this.myIdInput.node().value) {
                        this.web3.eth.getCoinbase((err, res) => {
                            if (this.nodeUrlInput.node().value !== url) { return; }

                            if (err) {
                                console.error(err);

                                this.nodeUrlSpinner
                                    .classed('hide', false)
                                    .classed('ok', false)
                                    .classed('err', true);
                            } else {
                                this.myIdInput.node().value = res;
                                this.onMyIdChange();
                            }
                        });
                    } else {
                        this.onMyIdChange();
                    }
                }
            }
        )
    }

    onMyIdKeyUp() {
        if (!this.menuIsActive) return;

        if (this.myIdKeyUpTimeout) {
            clearTimeout(this.myIdKeyUpTimeout);
        }

        this.myIdKeyUpTimeout = setTimeout(this.onMyIdChange, 300);
    }

    onMyIdChange() {
        if (!this.menuIsActive) return;

        const myId = this.myIdInput.node().value;

        if (myId === this.myId) { return; }

        this.myId = myId;

        this.myIdSpinner
            .classed('hide', false)
            .classed('ok', false)
            .classed('err', false);

        try {
            this.web3.eth.getBalance(
                myId,
                (err, res) => {
                    if (this.myId !== myId) { return; }
                    if (err) {
                        console.log(err);

                        this.myIdSpinner
                            .classed('hide', false)
                            .classed('ok', false)
                            .classed('err', true);
                    } else {
                        console.log(res);

                        this.myIdSpinner
                            .classed('hide', false)
                            .classed('ok', true)
                            .classed('err', false);
                    }
                }
            )
        } catch (err) {
            console.log(err);

            this.myIdSpinner
                .classed('hide', false)
                .classed('ok', false)
                .classed('err', true);
        }
    }

    onNewGameButtonPushed() {
        if (!this.menuIsActive) return;

        this.setLoading();
        this.onNodeUrlChange();
        this.onMyIdChange();

        const abi = require('./contracts/bin/contracts_dots_sol_Dots.abi.json');
        const bin = require('./contracts/bin/contracts_dots_sol_Dots.bin.json');

        try {
            if (this.opponentIdInput.node().value === this.myId) {
                throw new Error("Do not use your own id as an opponent id. Instead, create a new account.");
            }

            this.web3.eth.contract(abi).new(
                this.opponentIdInput.node().value,
                {
                    data: bin,
                    from: this.myId,
                    gas: 4000000,
                },
                this.onContractGenerated
            );
        } catch (err) {
            this.onContractGenerated(err);
        }
    }

    onJoinGameButtonPushed() {
        if (!this.menuIsActive) return;

        this.setLoading();
        this.onNodeUrlChange();
        this.onMyIdChange();

        const abi = require('./contracts/bin/contracts_dots_sol_Dots.abi.json');
        const bin = require('./contracts/bin/contracts_dots_sol_Dots.bin.json');

        try {
            if (!this.contractIdInput.node().value) {
                throw new Error("Enter the contract address");
            }
            this.web3.eth.contract(abi).at(
                this.contractIdInput.node().value,
                this.onContractGenerated
            );
        } catch (err) {
            this.onContractGenerated(err);
        }
    }

    onContractGenerated(err, res) {
        if(err) {
            this.unsetLoading();
            electron.remote.dialog.showErrorBox(
                "Error when creating a contract",
                err.toString()
            );
        } else if (res.address) {
            this.contract = res;

            this.headerContractIdV.text(res.address);
            this.headerRedIdV.text(res.player1());
            this.headerBlueIdV.text(res.player2());
            // this.headerRedScore.text();
            // this.headerBlueScore.text();
            // this.headerMoveCaption.text();

            // console.log(this.contract.currentPlayer(), this.myId);
            // this.contract.move(4, 4, {from: this.myId, gas: 4000000}, (err, res) => {
            //     console.log('move', err, res);
            // });

            // personal.unlockAccount("0x9f86a201e2c8d5c8c72965c7147f4615cf31bdd0", "", 1000000)

            this.e = this.contract.Update();
            this.e.watch((err, res) => {
                if (!err) {
                    this.updateState();
                }
            });

            setTimeout(() => this.updateState().then(this.closeMenu), 50);
        }
    };

    updateState() {
        if (this.updateInProgress) {
            this.updateRequested = true;
            return new Promise(resolve => resolve());
        }

        this.updateInProgress = true;
        this.updateRequested = false;

        const defaultBlock = this.web3.eth.getBlock('latest');

        // Trying to avoid synchronous call of 1280 functions at any cost
        return new Promise((resolve, reject) => {
            const field = [];

            let left = this.width * this.height;

            const player1 = this.contract.player1(defaultBlock);
            const player2 = this.contract.player2(defaultBlock);
            const currentPlayer = this.contract.currentPlayer(defaultBlock);
            const winner = this.contract.winner(defaultBlock);
            const gameOver = this.contract.gameOver(defaultBlock);

            const drawOffers = {};
            drawOffers[player1] = this.contract.drawOffers(player1, defaultBlock);
            drawOffers[player2] = this.contract.drawOffers(player2, defaultBlock);

            const finishOffers = {};
            finishOffers[player1] = this.contract.finishOffers(player1, defaultBlock);
            finishOffers[player2] = this.contract.finishOffers(player2, defaultBlock);

            const stakes = {};
            stakes[player1] = this.contract.stakes(player1, defaultBlock);
            stakes[player2] = this.contract.stakes(player2, defaultBlock);

            for (let x = 0; x < this.width; x++) {
                field.push([]);
                for (let y = 0; y < this.height; y++) {
                    field[x].push(null);
                    const x_ = x, y_ = y;
                    this.contract.field(x_, y_, defaultBlock, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            res[2] = res[2].toNumber();
                            field[x_][y_] = res;
                            left -= 1;
                            if (left === 0) {
                                resolve({
                                    field,
                                    player1,
                                    player2,
                                    currentPlayer,
                                    winner,
                                    gameOver,
                                    drawOffers,
                                    finishOffers,
                                    stakes
                                });
                            }
                        }
                    })
                }
            }
        }).then(res => {
            console.log(res);

            this.render(res);

            this.updateInProgress = false;
        }).catch(err => {
            electron.remote.dialog.showErrorBox(
                "Error when updating the game",
                err.toString()
            );

            this.e.stopWatching();
            this.e = this.contract.Update();
            this.e.watch((err, res) => {
                console.log(err, res);
                this.updateState();
            });
            this.updateInProgress = false;
            this.updateState();
        });

    }

    render({field, player1, player2, currentPlayer, winner, gameOver, drawOffers, finishOffers}) {
        this.headerMoveCaption.text(currentPlayer === this.myId ? 'Your move' : 'Waiting');
        if (gameOver) {
            if (winner === "0x0000000000000000000000000000000000000000") {
                this.headerMoveCaption.text('A draw');
            } else {
                this.headerMoveCaption.text(winner === this.myId ? 'You won' : 'You lost');
            }
        }

        const reds = [];
        const blues = [];
        const red_t = [];
        const blue_t = [];
        let redScore = 0;
        let blueScore = 0;

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if (field[x][y][0] === player1) {
                    reds.push([x, y, field[x][y]]);
                }
                if (field[x][y][0] === player2) {
                    blues.push([x, y, field[x][y]]);
                }
                if (field[x][y][1] === player1) {
                    red_t.push([x, y, field[x][y]]);
                }
                if (field[x][y][1] === player2) {
                    blue_t.push([x, y, field[x][y]]);
                }
                if (field[x][y][0] === player2 && field[x][y][1] === player1) {
                    redScore += 1;
                }
                if (field[x][y][0] === player1 && field[x][y][1] === player2) {
                    blueScore += 1;
                }
            }
        }

        this.headerRedScore.text(redScore);
        this.headerBlueScore.text(blueScore);

        const redCircles = this.svg.select('.field__red_points').selectAll('circle').data(reds, d => `${d[0]} ${d[1]}`);
        redCircles.exit().remove();
        redCircles.enter().append('circle').merge(redCircles)
            .attr('cx', d => this.margins.left + d[0] * this.gridSize + this.gridSize / 2)
            .attr('cy', d => this.margins.top + d[1] * this.gridSize + this.gridSize / 2)
            .attr('r', d => d[2][1] === player2 ? 3 : 4);

        const blueCircles = this.svg.select('.field__blue_points').selectAll('circle').data(blues, d => `${d[0]} ${d[1]}`);
        blueCircles.exit().remove();
        blueCircles.enter().append('circle').merge(blueCircles)
            .attr('cx', d => this.margins.left + d[0] * this.gridSize + this.gridSize / 2)
            .attr('cy', d => this.margins.top + d[1] * this.gridSize + this.gridSize / 2)
            .attr('r', d => d[2][1] === player1 ? 3 : 4);

        const redTCircles = this.svg.select('.field__red_territory').selectAll('rect').data(red_t, d => `${d[0]} ${d[1]}`);
        redTCircles.exit().remove();
        redTCircles.enter().append('rect').merge(redCircles)
            .attr('x', d => this.margins.left + d[0] * this.gridSize)
            .attr('y', d => this.margins.top + d[1] * this.gridSize)
            .attr('width', this.gridSize)
            .attr('height', this.gridSize);

        const blueTCircles = this.svg.select('.field__blue_territory').selectAll('rect').data(blue_t, d => `${d[0]} ${d[1]}`);
        blueTCircles.exit().remove();
        blueTCircles.enter().append('rect').merge(blueCircles)
            .attr('x', d => this.margins.left + d[0] * this.gridSize)
            .attr('y', d => this.margins.top + d[1] * this.gridSize)
            .attr('width', this.gridSize)
            .attr('height', this.gridSize);

        this.cursor.style('fill', this.myId === player1 ? '#a4342c' : '#3d42c0');

        this.field = field;

        this.activeMove = !gameOver && currentPlayer === this.myId;

        const draws = !!drawOffers[player1] + !!drawOffers[player2];

        this.drawOffered = drawOffers[this.myId];

        if (this.drawOffered) {
            this.headerDrawButton.text('Revoke draw offer ' + (draws ? `(${draws} / 2)` : ''));
        } else {
            this.headerDrawButton.text('Offer a draw ' + (draws ? `(${draws} / 2)` : ''));
        }

        if (gameOver) {
            this.fieldElement.style('background', '#e1e1e1');
        }

    }

    onMouseMove() {
        if (this.activeMove) {
            const coords = this.coords();
            coords[0] *= this.gridSize;
            coords[0] += this.margins.left + this.gridSize / 2;
            coords[1] *= this.gridSize;
            coords[1] += this.margins.top + this.gridSize / 2;
            this.cursor
                .style('display', null)
                .attr('transform', 'translate(' + coords + ')');
        } else {
            this.cursor.style('display', 'none');
        }
    }

    onClick() {
        if (this.activeMove) {
            this.setLoading();
            const coords = this.coords();
            try {
                this.contract.move(coords[0], coords[1], {from: this.myId, gas: 4000000}, (err, res) => {
                    if (err) {
                        electron.remote.dialog.showErrorBox(
                            "Error when running move function",
                            err.toString()
                        );
                    }

                    this.activeMove = false;

                    this.watchTransaction(res, () => {
                        this.updateState().then(this.closeMenu);
                    });
                });
            } catch (err) {
                electron.remote.dialog.showErrorBox(
                    "Error when running move function",
                    err.toString()
                );
            }
        }
    }

    coords() {
        const coords = d3.mouse(this.cursor.node().parentNode);
        coords[0] -= this.margins.left + this.gridSize / 2;
        coords[0] = Math.round(coords[0] / this.gridSize);

        if (coords[0] < 0) { coords[0] = 0; }
        if (coords[0] >= this.width) { coords[0] = this.width - 1; }

        coords[1] -= this.margins.top + this.gridSize / 2;
        coords[1] = Math.round(coords[1] / this.gridSize);

        if (coords[1] < 0) { coords[1] = 0; }
        if (coords[1] >= this.height) { coords[1] = this.height - 1; }

        return coords;
    }

    watchTransaction(id, cb, i) {
        i = i || 0;
        if (i > 600) {
            electron.remote.dialog.showErrorBox(
                "Error when tracking transaction",
                "The transaction didn't execute within 1 minute; abort tracking." +
                "Is anyone mining ether in your chain?"
            );
            cb(new Error("timeout"));
        }

        try {
            const r = this.web3.eth.getTransactionReceipt(id);
            cb(null, r);
        } catch (err) {
            if (err.toString().indexOf("unknown transaction") < 0) {
                electron.remote.dialog.showErrorBox(
                    "Error when creating a contract",
                    err.toString()
                );
                cb(err);
            } else {
                setTimeout(() => this.watchTransaction(id, cb, i + 1), 500);
            }
        }
    }

    onDrawButton() {
        if (!this.activeMove) { return; }

        this.setLoading();

        let fx;

        if (this.drawOffered) {
            fx = this.contract.revokeDrawOffer;
        } else {
            fx = this.contract.offerDraw;
        }

        try {
            fx({from: this.myId, gas: 4000000}, (err, res) => {
                if (err) {
                    electron.remote.dialog.showErrorBox(
                        "Error when running draw function",
                        err.toString()
                    );
                }

                this.activeMove = false;

                this.watchTransaction(res, () => {
                    this.updateState().then(this.closeMenu);
                });
            });
        } catch (err) {
            electron.remote.dialog.showErrorBox(
                "Error when running draw function",
                err.toString()
            );
        }
    }

    onResignButton() {
        if (!this.activeMove) { return; }

        this.setLoading();
        try {
            this.contract.resign({from: this.myId, gas: 4000000}, (err, res) => {
                if (err) {
                    electron.remote.dialog.showErrorBox(
                        "Error when running resign function",
                        err.toString()
                    );
                }

                this.activeMove = false;

                this.watchTransaction(res, () => {
                    this.updateState().then(this.closeMenu);
                });
            });
        } catch (err) {
            electron.remote.dialog.showErrorBox(
                "Error when running move function",
                err.toString()
            );
        }
    }
}


module.exports = WindowController;
