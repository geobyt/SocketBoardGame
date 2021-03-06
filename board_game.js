var io;
var gameSocket;
var roomData = {};

/**
 * This function is called by index.js to initialize a new game instance.
 *
 * @param sio The Socket.IO library
 * @param socket The socket object for the connected client.
 */
exports.initGame = function(sio, socket){
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "You are connected!" });

    // Host Events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostListJoinableGames', hostListJoinableGames);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
}

function loadDictionary() {
    var natural = require("natural");
    var fs = require("fs");

    // NOTE: This file should exist on most UNIX varieties
    var dictionary = "dictionary.txt";
    dictionaryTrie = new natural.Trie(false);

    console.time("building trie");
    fs.readFile(dictionary, {"encoding":"ascii"}, function (err, data) {
      if (err) throw err;

      var words = data.split("\n");
      var size = data.replace("\n", "").trim().length;
      console.log(words.length + " Words ("+size+" characters) Added.");
      dictionaryTrie.addStrings(words);

      console.timeEnd("building trie");
      console.log(dictionaryTrie.getSize());
    });
}

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */

function hostCreateNewGame(data) {
    // Create a unique Socket.IO Room
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});

    var roomId = '/' + thisGameId.toString();

    // Join the Room and wait for the players
    this.join(roomId);
    
    roomData[roomId] = {players: [{playerName: data.playerName, mySocketId: this.id}], gameId: thisGameId};

    loadDictionary();
};

/*
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : gameId
    };
    //console.log("All Players Present. Preparing game...");
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}

/*
 * The Countdown has finished, and the game begins!
 * @param gameId The game ID / room ID
 */
function hostStartGame(gameId) {
    console.log('Game Started.');
    sendBoard(gameId);
};

/**
 * Host list all the games with only one user 
 */
function hostListJoinableGames() {
    //console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    var sock = this;
    sock.emit('didGetJoinableRooms', roomData);
}

/* *****************************
   *                           *
   *     PLAYER FUNCTIONS      *
   *                           *
   ***************************** */

/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
function playerJoinGame(data) {
    //console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // A reference to the player's Socket.IO socket object
    var sock = this;

    var roomId = "/" + data.gameId;

    // Look up the room ID in the Socket.IO manager object.
    var room = gameSocket.manager.rooms[roomId];

    // If the room exists...
    if( room != undefined ){
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.gameId);

        console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

        // Emit an event notifying the clients that the player has joined the room.
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
        
        roomData[roomId] = {players: [{playerName: data.playerName, mySocketId: sock.id}], gameId: data.gameId};

    } else {
        // Otherwise, send an error message back to the player.
        this.emit('error',{message: "This room does not exist."} );
    }
}

/**
 * A player has tapped a word in the word list.
 * @param data gameId
 */
function playerAnswer(data) {
    console.log('Player ID: ' + data.playerId + ' solved a word: ' + data.answer);

    //check the word
    data.wordExists = dictionaryTrie.contains(data.answer);

    io.sockets.in(data.gameId).emit('checkAnswer', data);
}

/* *************************
   *                       *
   *      GAME LOGIC       *
   *                       *
   ************************* */

function sendBoard(gameId) {
    var numLetters = letterPool.length;
    var board = new Array(4);
    for (var i = 0; i < 4; i++) {
        board[i] = new Array(4);
    }

    for(var i = 0; i < 4; i++) {
        for (var j = 0; j < 4; j++) {
            //generate random number between 0 and num letters
            var ranNumber = Math.floor(Math.random() * numLetters);

            board[i][j] = letterPool[ranNumber];
        }
    }

    var boardData = {
        board : board
    };

    io.sockets.in(gameId).emit('newBoardData', boardData);
}

var dictionaryTrie;

var letterPool = [
    'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e', 'e',
    'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a',
    'i', 'i', 'i', 'i', 'i', 'i', 'i', 'i', 'i',
    'o', 'o', 'o', 'o', 'o', 'o', 'o', 'o',
    'n', 'n', 'n', 'n', 'n', 'n',
    'r', 'r', 'r', 'r', 'r', 'r',
    't', 't', 't', 't', 't', 't',
    'l', 'l', 'l', 'l',
    's', 's', 's', 's',
    'u', 'u', 'u', 'u',
    'd', 'd', 'd', 'd',
    'g', 'g', 'g',
    'b', 'b',
    'c', 'c',
    'm', 'm',
    'p', 'p',
    'f', 'f',
    'h', 'h',
    'v', 'v',
    'w', 'w',
    'y', 'y',
    'k',
    'j',
    'x',
    'q',
    'z'
 ]
