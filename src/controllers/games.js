import Game from "../models/games.js";

export async function createGame(userId) {
	if (!userId) {
		return { error: "L'identifiant du joueur est manquant" };
	}
	const datas = await Game.create({
		creator: userId,
		board: Array(9).fill(null),
		currentPlayer: 'X',
		state: "pending"
	});

	return { gameId: datas.dataValues.id };
}

export async function updateGame(request) {
	const userId = request.body.userId;
	const { action, gameId } = request.params;

	if (!userId || !gameId) {
		return { error: "Paramètres manquants" };
	}

	const game = await Game.findByPk(gameId);
	if (!game) {
		return { error: "La partie n'existe pas." };
	}

	if (game.state === "finished") {
		return { error: "Cette partie est déjà terminée !" };
	}

	switch (action) {
		case "join":
			if (game.player !== null) {
				return { error: "Il y a déjà 2 joueurs dans cette partie !" };
			}
			if (game.state !== "pending") {
				return { error: "Cette partie n'est plus en attente." };
			}

			await game.update({
				player: userId,
				state: "playing",
				board: Array(9).fill(null),
				currentPlayer: 'X'
			});
			break;

		case "finish":
			if (!request.body.score) {
				return { error: "Le score est manquant." };
			}
			await game.update({
				state: "finished",
				winnerScore: request.body.score,
				winner: request.body.winner
			});
			break;

		default:
			return { error: "Action inconnue" };
	}

	return game;
}