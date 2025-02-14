import chalk from "chalk";
import Game from "./models/games.js";
//pour fastify
import fastify from "fastify";
import fastifyBcrypt from "fastify-bcrypt";
import cors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastifyJWT from "@fastify/jwt";
import socketioServer from "fastify-socket.io";
//routes
import { usersRoutes } from "./routes/users.js";
import { gamesRoutes } from "./routes/games.js";
//bdd
import { sequelize } from "./bdd.js";

//Test de la connexion
try {
	sequelize.authenticate();
	console.log(chalk.grey("Connecté à la base de données MySQL!"));
} catch (error) {
	console.error("Impossible de se connecter, erreur suivante :", error);
}

/**
 * API
 * avec fastify
 */
let blacklistedTokens = [];
const app = fastify();
//Ajout du plugin fastify-bcrypt pour le hash du mdp
await app
	.register(fastifyBcrypt, {
		saltWorkFactor: 12,
	})
	.register(cors, {
		origin: "*",
	})
	.register(fastifySwagger, {
		openapi: {
			openapi: "3.0.0",
			info: {
				title: "Documentation de l'API JDR LOTR",
				description:
					"API développée pour un exercice avec React avec Fastify et Sequelize",
				version: "0.1.0",
			},
		},
	})
	.register(fastifySwaggerUi, {
		routePrefix: "/documentation",
		theme: {
			title: "Docs - JDR LOTR API",
		},
		uiConfig: {
			docExpansion: "list",
			deepLinking: false,
		},
		uiHooks: {
			onRequest: function (request, reply, next) {
				next();
			},
			preHandler: function (request, reply, next) {
				next();
			},
		},
		staticCSP: true,
		transformStaticCSP: (header) => header,
		transformSpecification: (swaggerObject, request, reply) => {
			return swaggerObject;
		},
		transformSpecificationClone: true,
	})
	.register(fastifyJWT, {
		secret: "unanneaupourlesgouvernertous",
	})
	.register(socketioServer, {
		cors: {
		origin: "*",
		},
	})

/**********
 * Routes
 **********/
app.get("/", (request, reply) => {
	reply.send({ documentationURL: "http://localhost:3000/documentation" });
});
// Fonction pour décoder et vérifier le token
app.decorate("authenticate", async (request, reply) => {
	try {
		const token = request.headers["authorization"].split(" ")[1];

		// Vérifier si le token est dans la liste noire
		if (blacklistedTokens.includes(token)) {
			return reply
				.status(401)
				.send({ error: "Token invalide ou expiré" });
		}
		await request.jwtVerify();
	} catch (err) {
		reply.send(err);
	}
});
//gestion utilisateur
usersRoutes(app);
//gestion des jeux
gamesRoutes(app);

/**********
 * START
 **********/
const start = async () => {
	try {
		await sequelize
			.sync({ alter: true })
			.then(() => {
				console.log(chalk.green("Base de données synchronisée."));
			})
			.catch((error) => {
				console.error(
					"Erreur de synchronisation de la base de données :",
					error
				);
			});
		await app.listen({ port: 3000 });
		console.log(
			"Serveur Fastify lancé sur " + chalk.blue("http://localhost:3000")
		);
		console.log(
			chalk.bgYellow(
				"Accéder à la documentation sur http://localhost:3000/documentation"
			)
		);
	} catch (err) {
		console.log(err);
		process.exit(1);
	}
};


app.io.on("connection", (socket) => {
	const checkWinner = (board) => {
		const winningLines = [
			[0, 1, 2], [3, 4, 5], [6, 7, 8],
			[0, 3, 6], [1, 4, 7], [2, 5, 8],
			[0, 4, 8], [2, 4, 6]
		];

		for (let line of winningLines) {
			const [a, b, c] = line;
			if (board[a] && board[a] === board[b] && board[a] === board[c]) {
				return board[a];
			}
		}

		if (board.every(cell => cell !== null)) {
			return 'draw';
		}

		return null;
	};

	socket.on("join", async (gameInfo) => {
		try {
			const cleanGameId = gameInfo.gameId.trim();
			console.log(`${gameInfo.infoUser.username} rejoint la partie: ${cleanGameId}`);
			socket.join(cleanGameId);

			let game = await Game.findByPk(cleanGameId);
			if (!game) {
				console.error("Partie non trouvée");
				return;
			}

			app.io.to(cleanGameId).emit("updateGame", {
				board: game.board,
				currentPlayer: game.currentPlayer
			});

			const isCreator = game.creator === gameInfo.infoUser.id;
			socket.emit("playerAssigned", {
				symbol: isCreator ? 'X' : 'O'
			});

			socket.to(cleanGameId).emit("newPlayer", {
				infoUser: gameInfo.infoUser
			});
		} catch (error) {
			console.error("Erreur lors de la connexion:", error);
		}
	});

	socket.on("makeMove", async (data) => {
		try {
			const { gameId, position, player } = data;
			const game = await Game.findByPk(gameId);

			if (!game) {
				console.log("Partie non trouvée");
				return;
			}

			if (game.board[position] !== null) {
				console.log("Case déjà occupée");
				return;
			}

			if (game.currentPlayer !== player) {
				console.log("Ce n'est pas le tour de ce joueur");
				return;
			}

			const newBoard = [...game.board];
			newBoard[position] = player;

			const winningLines = [
				[0, 1, 2], [3, 4, 5], [6, 7, 8],
				[0, 3, 6], [1, 4, 7], [2, 5, 8],
				[0, 4, 8], [2, 4, 6]
			];

			let isWinner = false;
			for (let line of winningLines) {
				const [a, b, c] = line;
				if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
					isWinner = true;
					break;
				}
			}

			const nextPlayer = player === 'X' ? 'O' : 'X';

			if (isWinner) {
				const winnerId = player === 'X' ? game.creator : game.player;
				await game.update({
					board: newBoard,
					state: "finished",
					winner: winnerId
				});

				app.io.to(gameId).emit("updateGame", {
					board: newBoard,
					currentPlayer: nextPlayer
				});

				app.io.to(gameId).emit("gameEnded", {
					winner: player,
					winnerId: winnerId
				});
			} else if (newBoard.every(cell => cell !== null)) {
				await game.update({
					board: newBoard,
					state: "finished",
					winner: null
				});

				app.io.to(gameId).emit("updateGame", {
					board: newBoard,
					currentPlayer: nextPlayer
				});

				app.io.to(gameId).emit("gameEnded", { winner: "draw" });
			} else {
				await game.update({
					board: newBoard,
					currentPlayer: nextPlayer
				});

				app.io.to(gameId).emit("updateGame", {
					board: newBoard,
					currentPlayer: nextPlayer
				});
			}
			app.io.to(gameId).emit("playerMove", {
				player,
				position
			});
		} catch (error) {
			console.error("Erreur lors du mouvement:", error);
		}
	});

	socket.on("restartGame", async (gameId) => {
		try {
			const game = await Game.findByPk(gameId);
			if (!game) return;

			await game.update({
				board: Array(9).fill(null),
				currentPlayer: 'X',
				state: "playing",
				winner: null
			});

			app.io.to(gameId).emit("updateGame", {
				board: Array(9).fill(null),
				currentPlayer: 'X'
			});
		} catch (error) {
			console.error("Erreur lors du redémarrage:", error);
		}
	});

	socket.on("disconnect", () => {
		console.log(`Joueur déconnecté: ${socket.id}`);
	});
});

start();
