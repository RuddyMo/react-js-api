import { createGame, updateGame } from "../controllers/games.js";

export function gamesRoutes(app) {
	app.post(
		"/game",
		{
			preHandler: [app.authenticate],
			schema: {
				body: {
					type: 'object',
					required: ['userId'],
					properties: {
						userId: { type: 'string' }
					}
				}
			}
		},
		async (request, reply) => {
			try {
				const result = await createGame(request.body.userId);
				if (result.error) {
					reply.code(400).send(result);
				} else {
					reply.code(201).send(result);
				}
			} catch (error) {
				console.error("Erreur création partie:", error);
				reply.code(500).send({ error: "Erreur lors de la création de la partie" });
			}
		}
	);

	app.patch(
		"/game/:action/:gameId",
		{
			preHandler: [app.authenticate],
			schema: {
				params: {
					type: 'object',
					required: ['action', 'gameId'],
					properties: {
						action: { type: 'string', enum: ['join', 'finish'] },
						gameId: { type: 'string' }
					}
				},
				body: {
					type: 'object',
					required: ['userId'],
					properties: {
						userId: { type: 'string' },
						score: { type: 'number' },
						winner: { type: 'string' }
					}
				}
			}
		},
		async (request, reply) => {
			try {
				const result = await updateGame(request);
				if (result.error) {
					reply.code(400).send(result);
				} else {
					reply.send(result);
				}
			} catch (error) {
				console.error("Erreur mise à jour partie:", error);
				reply.code(500).send({ error: "Erreur lors de la mise à jour de la partie" });
			}
		}
	);
	app.get(
		"/games",
		{ preHandler: [app.authenticate] },
		async (request, reply) => {
			try {
				const games = await Game.findAll({
					include: [
						{ model: User, as: 'player1', attributes: ['username'] },
						{ model: User, as: 'player2', attributes: ['username'] },
						{ model: User, as: 'winPlayer', attributes: ['username'] }
					],
					order: [['createdAt', 'DESC']],
					limit: 10 // Limiter aux 10 dernières parties
				});
				reply.send(games);
			} catch (error) {
				console.error("Erreur lors de la récupération des parties:", error);
				reply.code(500).send({ error: "Erreur lors de la récupération des parties" });
			}
		}
	);
}