const express = require('express');
const db = require('./db');

const router = express.Router();

router.get('/join-room/:gameId', (req, res) => {
  // console.log(req.session)
  const io = req.app.get('io');
  console.log(io.sockets);

  io.in(req.session.socketId).emit('logplz', { status: 'OK' });
  io.to('b').emit('roomplz', { status: 'Room' });

  res.redirect('/');
});

// db methods
router.post('/post', (req, res) => {
  db().collection('games')
    .insertOne(req.body, (err, result) => {
      if (err) return console.log(err);

      console.log('saved to database');
      res.redirect('/');
    });
});

router.get('/new-game/:encounterId', (req, res) => {
  if (!req.session.Auth) {
    res.redirect('/rejected');
    return;
  }
  const gameId = Math.floor(new Date() / 1000)
    .toString(36)
    + parseInt(req.session.Auth.id.slice(5), 10)
      .toString(36);
  db().collection('games')
    .countDocuments({ gameId })
    .then((count) => {
      if (count) return res.redirect('/rejected');
      db().collection('games')
        .insertOne({
          gameId,
          players: {
            creator: req.session.Auth.id,
            opponent: null,
          },
          encounterId: req.params.encounterId,
          created: new Date(),
        }, (err) => {
          if (err) return res.redirect('/rejected');
          res.send({
            status: 'OK',
            gameId,
          });
        });
    });
});

router.get('/join-game/:gameId', (req, res) => {
  if (!req.session.Auth) {
    res.redirect('/rejected');
    return;
  }
  db().collection('games')
    .findOne({ gameId: req.params.gameId })
    .then((game) => {
      if (!game) return res.redirect('/rejected');
      if (game.players.opponent) {
        return res.send({
          status: 'rejected',
          info: 'Already 2 players joined game.',
        });
      }
      if (game.players.creator !== req.session.Auth.id) {
        return res.send({
          status: 'rejected',
          info: 'You are already in game.',
        });
      }
      db().collection('games')
        .updateOne(game, { $set: { 'players.opponent': req.session.Auth.id } })
        .then(res.redirect('/'));
    });
});

module.exports = router;
