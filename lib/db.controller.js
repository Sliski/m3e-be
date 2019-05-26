exports.ENCOUNTER_STEPS = {
  MANUAL_CHOICE: 0,
  GENERATE: 1,
  CHOOSE: 2,
  SCORE: 3,
  FINISHED_GAME: 4,
};

exports.decodeEncounterId = (encounterId) => {
  if (encounterId.length !== 6) return null;
  const deploymentId = Math.floor(parseInt(encounterId.substring(0, 1), 16) / 4);
  const strategyId = parseInt(encounterId.substring(0, 1), 16) % 4;
  const schemesIds = [...encounterId.substring(1, 6)].map(it => parseInt(it, 16)).sort((a, b) => a - b);

  if (deploymentId >= 0 && deploymentId <= 3
    && strategyId >= 0 && strategyId <= 3
    && schemesIds.length === 5
    && schemesIds.reduce((out, current) => out !== null && current >= 0 && current <= 12)) {
    return {
      deploymentId,
      strategyId,
      schemesIds,
    };
  }
  return null;
};

exports.currentPlayer = (req, game) => {
  if (!req.session || !req.session.user || !req.session.user.email) return null;
  if (req.session.user.email === game.players.creator.user.email) return 'creator';
  if (game.players.opponent && req.session.user.email === game.players.opponent.user.email) return 'opponent';
  return null;
};

exports.secondPlayer = currentPlayer => (currentPlayer === 'creator' ? 'opponent' : 'creator');
