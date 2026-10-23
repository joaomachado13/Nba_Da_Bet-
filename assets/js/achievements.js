(function () {
  const DEFINITIONS = {
    underdog: {
      emoji: "🐺",
      label: "Azarão da rodada",
      description: "Foi o único jogador a escolher um lado enquanto todo o resto foi no adversário."
    },
    contrarian_hit: {
      emoji: "⚡",
      label: "Contra a maré",
      description: "Foi o único a contrariar a galera e ainda acertou o vencedor."
    },
    perfect_round: {
      emoji: "🎯",
      label: "Rodada perfeita",
      description: "Acertou todos os jogos válidos de uma rodada completa."
    },
    round_king: {
      emoji: "👑",
      label: "Rei da rodada",
      description: "Terminou uma rodada completa sozinho com o maior número de acertos."
    },
    hot_streak: {
      emoji: "🔥",
      label: "Em chamas",
      description: "Chegou a uma sequência de pelo menos 5 acertos consecutivos."
    },
    ten_streak: {
      emoji: "🌋",
      label: "Incontrolável",
      description: "Acertou 10 jogos consecutivos.",
      secret: true
    },
    back_to_back: {
      emoji: "⚔️",
      label: "Duas seguidas",
      description: "Venceu duas rodadas completas consecutivas sem dividir o topo.",
      secret: true
    }
  };

  const CODE_ALIASES = {
    NY: "NYK",
    WSH: "WAS",
    SA: "SAS",
    NO: "NOP",
    GS: "GSW",
    UTAH: "UTA"
  };

  function normalizeCode(code) {
    const value = String(code || "").trim().toUpperCase();
    return CODE_ALIASES[value] || value;
  }

  function isFinal(game) {
    return String(game?.status || "").toLowerCase() === "final";
  }

  function winnerCode(game) {
    if (!isFinal(game)) return null;
    const away = Number(game.away_score);
    const home = Number(game.home_score);
    if (!Number.isFinite(away) || !Number.isFinite(home) || away === home) return null;
    return normalizeCode(away > home ? game.away_team_code : game.home_team_code);
  }

  function gameLabel(game) {
    return `${normalizeCode(game.away_team_code)} @ ${normalizeCode(game.home_team_code)}`;
  }

  function compute({ games = [], predictions = [], profiles = [], now = new Date() } = {}) {
    const profileIds = profiles.map(profile => profile.id).filter(Boolean);
    const byGame = new Map();
    const gameById = new Map();
    const rounds = new Map();
    const eventsByUser = Object.fromEntries(profileIds.map(id => [id, []]));

    for (const game of games) {
      gameById.set(String(game.id), game);
      const date = String(game.round_date || "");
      if (!rounds.has(date)) rounds.set(date, []);
      rounds.get(date).push(game);
    }

    for (const prediction of predictions) {
      const gameId = String(prediction.game_id);
      if (!byGame.has(gameId)) byGame.set(gameId, []);
      byGame.get(gameId).push({
        ...prediction,
        picked_team_code: normalizeCode(prediction.picked_team_code)
      });
      if (!eventsByUser[prediction.user_id]) eventsByUser[prediction.user_id] = [];
    }

    function add(userId, key, event) {
      if (!userId || !DEFINITIONS[key]) return;
      if (!eventsByUser[userId]) eventsByUser[userId] = [];
      eventsByUser[userId].push({
        key,
        ...DEFINITIONS[key],
        ...event
      });
    }

    const nowMs = new Date(now).getTime();

    for (const [roundDate, roundGames] of rounds) {
      const validForLock = roundGames.filter(game => !["cancelled", "postponed"].includes(String(game.status || "").toLowerCase()));
      const starts = validForLock.map(game => new Date(game.start_at).getTime()).filter(Number.isFinite);
      const locked = starts.length > 0 && nowMs >= Math.min(...starts);

      if (locked) {
        for (const game of validForLock) {
          const gamePredictions = byGame.get(String(game.id)) || [];
          if (profileIds.length && gamePredictions.length !== profileIds.length) continue;

          const pickGroups = new Map();
          for (const prediction of gamePredictions) {
            const code = normalizeCode(prediction.picked_team_code);
            if (!pickGroups.has(code)) pickGroups.set(code, []);
            pickGroups.get(code).push(prediction);
          }

          if (pickGroups.size !== 2) continue;
          const groups = [...pickGroups.entries()].sort((a, b) => a[1].length - b[1].length);
          const [soloCode, soloPicks] = groups[0];
          const [, majorityPicks] = groups[1];

          if (soloPicks.length === 1 && majorityPicks.length >= 2) {
            const solo = soloPicks[0];
            add(solo.user_id, "underdog", {
              round_date: roundDate,
              game_id: String(game.id),
              sort_at: game.start_at,
              detail: `${gameLabel(game)} · único em ${soloCode}`
            });

            if (winnerCode(game) === soloCode) {
              add(solo.user_id, "contrarian_hit", {
                round_date: roundDate,
                game_id: String(game.id),
                sort_at: game.start_at,
                detail: `${gameLabel(game)} · bancou ${soloCode} e acertou`
              });
            }
          }
        }
      }

      const completedGames = validForLock.filter(isFinal);
      const roundComplete = validForLock.length > 0 && completedGames.length === validForLock.length;
      if (!roundComplete) continue;

      const scores = profileIds.map(userId => {
        const picks = completedGames.map(game => {
          const prediction = (byGame.get(String(game.id)) || []).find(item => item.user_id === userId);
          return { game, prediction };
        });
        const submittedAll = picks.every(item => item.prediction);
        const correct = picks.filter(item => item.prediction && winnerCode(item.game) === normalizeCode(item.prediction.picked_team_code)).length;
        return { userId, submittedAll, correct, total: completedGames.length };
      });

      for (const score of scores) {
        if (score.submittedAll && score.total > 0 && score.correct === score.total) {
          add(score.userId, "perfect_round", {
            round_date: roundDate,
            sort_at: completedGames.at(-1)?.start_at || roundDate,
            detail: `${score.correct}/${score.total} acertos na rodada`
          });
        }
      }

      const best = Math.max(0, ...scores.map(score => score.correct));
      const leaders = scores.filter(score => score.correct === best);
      if (best > 0 && leaders.length === 1) {
        add(leaders[0].userId, "round_king", {
          round_date: roundDate,
          sort_at: completedGames.at(-1)?.start_at || roundDate,
          detail: `${best} ${best === 1 ? "acerto" : "acertos"} · melhor pontuação da rodada`
        });
      }
    }

    for (const userId of profileIds) {
      const decided = [];
      for (const game of games.filter(isFinal)) {
        const prediction = (byGame.get(String(game.id)) || []).find(item => item.user_id === userId);
        if (!prediction) continue;
        decided.push({
          start_at: game.start_at,
          correct: winnerCode(game) === normalizeCode(prediction.picked_team_code)
        });
      }
      decided.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

      let current = 0;
      let max = 0;
      for (const item of decided) {
        current = item.correct ? current + 1 : 0;
        max = Math.max(max, current);
      }
      if (max >= 5) {
        add(userId, "hot_streak", {
          round_date: null,
          sort_at: decided.at(-1)?.start_at || null,
          detail: `Maior sequência: ${max} acertos seguidos`,
          streak: max
        });
      }
      if (max >= 10) {
        add(userId, "ten_streak", {
          round_date: null,
          sort_at: decided.at(-1)?.start_at || null,
          detail: `Sequência de ${max} acertos consecutivos`,
          streak: max
        });
      }
    }

    const completedDates = [...rounds.entries()]
      .filter(([, roundGames]) => {
        const valid = roundGames.filter(game => !["cancelled", "postponed"].includes(String(game.status || "").toLowerCase()));
        return valid.length > 0 && valid.every(isFinal);
      })
      .map(([date]) => date)
      .sort();

    for (const userId of profileIds) {
      const wins = new Set((eventsByUser[userId] || []).filter(event => event.key === "round_king").map(event => event.round_date));
      for (let i = 1; i < completedDates.length; i += 1) {
        if (wins.has(completedDates[i - 1]) && wins.has(completedDates[i])) {
          add(userId, "back_to_back", {
            round_date: completedDates[i],
            sort_at: completedDates[i],
            detail: `Venceu duas rodadas consecutivas: ${completedDates[i - 1]} e ${completedDates[i]}`
          });
        }
      }
    }

    const byUser = {};
    for (const [userId, events] of Object.entries(eventsByUser)) {
      const grouped = new Map();
      for (const event of events) {
        if (!grouped.has(event.key)) grouped.set(event.key, []);
        grouped.get(event.key).push(event);
      }

      byUser[userId] = [...grouped.entries()].map(([key, items]) => {
        items.sort((a, b) => new Date(b.sort_at || 0) - new Date(a.sort_at || 0));
        return {
          key,
          ...DEFINITIONS[key],
          count: key === "hot_streak" ? 1 : items.length,
          events: items,
          latest_at: items[0]?.sort_at || null
        };
      }).sort((a, b) => new Date(b.latest_at || 0) - new Date(a.latest_at || 0));
    }

    return {
      definitions: DEFINITIONS,
      byUser,
      allEvents: Object.entries(eventsByUser).flatMap(([user_id, events]) =>
        events.map(event => ({ user_id, ...event }))
      )
    };
  }

  window.BolaoAchievements = { definitions: DEFINITIONS, normalizeCode, compute };
})();