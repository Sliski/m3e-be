const express = require('express');
const { ObjectID } = require('mongodb');
const dbController = require('./db.controller.js');
const db = require('../db');

const router = express.Router();

router.get('/create-game/:encounterId/:options', (req, res) => {
  if (!req.session.Auth) return res.redirect('/rejected');
  console.log(`${req.session.user.email} creates game.`);

  const { encounterId, options } = req.params;

  const decodedEncounter = dbController.decodeEncounterId(encounterId);
  if (!decodedEncounter) {
    res.redirect('/rejected');
    return;
  }

  const appState = {
    ...decodedEncounter,
    round: 1,
    multiplayer: options[0] === '1',
    chooseCrew: options[1] === '1',
  };

  const game = {
    players: {
      creator: {
        user: req.session.user,
        schemes: null,
        strategyScore: 0,
        step: dbController.ENCOUNTER_STEPS.CHOOSE,
        chooseStep: options[1] === '1' ? dbController.CHOOSE_STEPS.FACTION : null,
        crew: {
          faction: null,
          leader: null,
          list: null,
        },
      },
      opponent: null,
    },
    appState,
    isFinished: false,
  };

  db().collection('games').insertOne({
    ...game,
    created: new Date(),
  }, (error, response) => {
    if (error) return res.redirect('/rejected');
    res.send({
      status: 'OK',
      id: response.insertedId,
    });
  });
});

router.get('/join-game/:gameId', (req, res) => {
  const { gameId } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(gameId)) {
    return res.redirect('/rejected');
  }
  console.log(`${req.session.user.email} joins game ${gameId}.`);

  db().collection('games').findOne(new ObjectID(gameId))
    .then((game) => {
      if (!game) {
        return res.send({
          status: 'rejected',
          info: 'Incorrect game ID.',
        });
      }

      if (!game.players || game.players.opponent) {
        return res.send({
          status: 'rejected',
          info: 'Only two players can join the game.',
        });
      }

      if (game.players.creator.user.email === req.session.user.email) {
        return res.send({
          status: 'rejected',
          info: '',
        });
      }

      db().collection('games').updateOne(game, {
        $set: {
          'players.opponent': {
            user: req.session.user,
            schemes: null,
            strategyScore: 0,
            step: dbController.ENCOUNTER_STEPS.CHOOSE,
            chooseStep: game.appState.chooseCrew ? dbController.CHOOSE_STEPS.FACTION : null,
            crew: {
              faction: null,
              leader: null,
              list: null,
            },
          },
        },
      }, (error) => {
        if (error) return res.redirect('/rejected');
        req.app.get('io').to(gameId).emit('newAppState', 'opponent');
        return res.redirect('/');
      });
    });
});

router.get('/choose-faction/:gameId/:faction', (req, res) => {
  const { gameId, faction } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(gameId)) {
    return res.redirect('/rejected');
  }

  console.log(`${req.session.user.email} choose faction in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    if (game.players[currentPlayer].crew.faction) {
      return res.send({
        status: 'rejected',
        info: 'Faction already chosen.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: {
        [`players.${currentPlayer}.crew.faction`]: faction,
        [`players.${currentPlayer}.chooseStep`]: dbController.CHOOSE_STEPS.LEADER,
      },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});


router.get('/choose-leader/:gameId/:leader', (req, res) => {
  const { gameId, leader } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(gameId)) {
    return res.redirect('/rejected');
  }

  console.log(`${req.session.user.email} choose leader in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    if (game.players[currentPlayer].crew.leader) {
      return res.send({
        status: 'rejected',
        info: 'Leader already chosen.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: {
        [`players.${currentPlayer}.crew.leader`]: leader,
        [`players.${currentPlayer}.chooseStep`]: dbController.CHOOSE_STEPS.CREW,
      },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

router.post('/choose-crew', (req, res) => {
  const chosenList = req.body.chosenList && JSON.parse(req.body.chosenList);
  if (!req.session.Auth
    || !req.body
    || !req.body.gameId
    || !ObjectID.isValid(req.body.gameId)
    || !chosenList) {
    return res.redirect('/rejected');
  }
  const { gameId } = req.body;
  console.log(`${req.session.user.email} choose list in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    if (game.players[currentPlayer].crew.list) {
      return res.send({
        status: 'rejected',
        info: 'List already chosen.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: {
        [`players.${currentPlayer}.crew.list`]: chosenList.text,
        [`players.${currentPlayer}.chooseStep`]: dbController.CHOOSE_STEPS.SCHEMES,
      },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

router.post('/choose-schemes', (req, res) => {
  const chosenSchemes = req.body.schemes && JSON.parse(req.body.schemes);
  if (!req.session.Auth
    || !req.body
    || !req.body.gameId
    || !ObjectID.isValid(req.body.gameId)
    || !chosenSchemes
    || chosenSchemes.length !== 2) {
    return res.redirect('/rejected');
  }
  const { gameId } = req.body;
  console.log(`${req.session.user.email} choose schemes in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    if (game.players[currentPlayer].schemes) {
      return res.send({
        status: 'rejected',
        info: 'Schemes already chosen.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: {
        [`players.${currentPlayer}.schemes`]: chosenSchemes,
        [`players.${currentPlayer}.step`]: dbController.ENCOUNTER_STEPS.SCORE,
      },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

router.get('/start-round/:gameId/:round', (req, res) => {
  const round = parseInt(req.params.round, 10);
  const { gameId } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(req.params.gameId)) {
    return res.redirect('/rejected');
  }
  console.log(`${req.session.user.email} starts round ${round} in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    if (round !== (game.appState.round + 1)) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect round.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: { 'appState.round': round },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

router.get('/score-strategy/:gameId/:score', (req, res) => {
  const score = parseInt(req.params.score, 10);
  const { gameId } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(req.params.gameId)) {
    return res.redirect('/rejected');
  }
  console.log(`${req.session.user.email} score strategy ${score} in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: { [`players.${currentPlayer}.strategyScore`]: score },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

router.get('/reveal-scheme/:gameId/:schemeId', (req, res) => {
  const schemeId = parseInt(req.params.schemeId, 10);
  const { gameId } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(req.params.gameId)) {
    return res.redirect('/rejected');
  }
  console.log(`${req.session.user.email} reveals scheme ${schemeId} in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    const schemes = JSON.parse(JSON.stringify(game.players[currentPlayer].schemes));
    if (schemes[0].id === schemeId) {
      schemes[0].revealed = true;
    } else if (schemes[1].id === schemeId) {
      schemes[1].revealed = true;
    } else {
      return res.send({
        status: 'rejected',
        info: 'Incorrect scheme ID.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: { [`players.${currentPlayer}.schemes`]: schemes },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

router.get('/score-scheme/:gameId/:schemeId/:score', (req, res) => {
  const schemeId = parseInt(req.params.schemeId, 10);
  const score = parseInt(req.params.score, 10);
  const { gameId } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(req.params.gameId)) {
    return res.redirect('/rejected');
  }
  console.log(`${req.session.user.email} score ${score} scheme ${schemeId} in game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    const schemes = JSON.parse(JSON.stringify(game.players[currentPlayer].schemes));
    if (schemes[0].id === schemeId) {
      schemes[0].score = score;
    } else if (schemes[1].id === schemeId) {
      schemes[1].score = score;
    } else {
      return res.send({
        status: 'rejected',
        info: 'Incorrect scheme ID.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: { [`players.${currentPlayer}.schemes`]: schemes },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

router.get('/load-app-state/:gameId', (req, res) => {
  const { gameId } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(req.params.gameId)) {
    return res.redirect('/rejected');
  }
  console.log(`${req.session.user.email} loads game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'It\'s not your game.',
      });
    }

    const player = game.players[currentPlayer];
    const secondPlayer = game.players[dbController.secondPlayer(currentPlayer)];

    if (player.step === dbController.ENCOUNTER_STEPS.FINISHED_GAME) {
      return res.send({
        status: 'rejected',
        info: 'This game is finished.',
      });
    }

    let opponentSchemes = null;
    let opponentScore = 0;
    let opponentStep = null;
    let opponentChooseStep = null;
    const opponentCrew = {
      faction: null,
      leader: null,
      list: null,
    };
    if (game.appState.multiplayer && secondPlayer) {
      opponentSchemes = secondPlayer.schemes && secondPlayer.schemes.filter(it => it.revealed);
      opponentScore = secondPlayer.strategyScore;
      opponentStep = secondPlayer.step;
      opponentChooseStep = secondPlayer.chooseStep;
      opponentCrew.faction = secondPlayer.crew.faction;
      opponentCrew.leader = secondPlayer.crew.leader;
      opponentCrew.list = secondPlayer.crew.list;
    }

    res.send({
      status: 'OK',
      appState: {
        ...game.appState,
        userRole: currentPlayer,
        chosenSchemes: player.schemes,
        opponentSchemes,
        strategyScore: [player.strategyScore, opponentScore],
        step: player.step,
        chooseStep: player.chooseStep,
        opponentStep,
        opponentChooseStep,
        crew: player.crew,
        opponentCrew,
      },
    });
  });
});

router.get('/end-game/:gameId', (req, res) => {
  const { gameId } = req.params;
  if (!req.session.Auth || !ObjectID.isValid(gameId)) {
    return res.redirect('/rejected');
  }
  console.log(`${req.session.user.email} ends game ${gameId}.`);
  db().collection('games').findOne(new ObjectID(gameId)).then((game) => {
    if (!game) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect game ID.',
      });
    }
    const currentPlayer = dbController.currentPlayer(req, game);
    if (!currentPlayer) {
      return res.send({
        status: 'rejected',
        info: 'Incorrect user.',
      });
    }

    db().collection('games').updateOne(game, {
      $set: { [`players.${currentPlayer}.step`]: dbController.ENCOUNTER_STEPS.FINISHED_GAME },
    }).then(() => {
      req.app.get('io').to(gameId).emit('newAppState', currentPlayer);
      res.redirect('/');
    });
  });
});

// end-game/ //add checking if game is finished ehn updated

// const gameId = Math.floor(new Date() / 1000)
//   .toString(36)
//   + parseInt(req.session.Auth.id.slice(5), 10)
//   .toString(36);
// db().collection('games')
// .countDocuments({ gameId })
// .then((count) => {
//   if (count) return res.redirect('/rejected');
//   db().collection('games')
//   .insertOne({
//     gameId,
//     players: {
//       creator: req.session.Auth.id,
//       opponent: null,
//     },
//     encounterId: req.params.encounterId,
//     created: new Date(),
//   }, (err) => {
//     if (err) return res.redirect('/rejected');
//     res.send({
//       status: 'OK',
//       gameId,
//     });
//   });
// });

// router.get('/join-room/:gameId', (req, res) => {
//   // console.log(req.session)
//   const io = req.app.get('io');
//   console.log(io.sockets);
//
//   io.in(req.session.socketId).emit('logplz', { status: 'OK' });
//   io.to('b').emit('roomplz', { status: 'Room' });
//
//   res.redirect('/');
// });
//
// // db methods
// router.post('/post', (req, res) => {
//   db().collection('games')
//     .insertOne(req.body, (err, result) => {
//       if (err) return console.log(err);
//
//       console.log('saved to database');
//       res.redirect('/');
//     });
// });

module.exports = router;
