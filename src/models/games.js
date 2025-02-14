import { DataTypes } from "@sequelize/core";
import { sequelize } from "../bdd.js";
import User from "./users.js";

const Game = sequelize.define("game", {
	id: {
		type: DataTypes.UUID,
		primaryKey: true,
		defaultValue: DataTypes.UUIDV4,
	},
	board: {
		type: DataTypes.JSON,
		defaultValue: Array(9).fill(null),
		allowNull: false
	},
	currentPlayer: {
		type: DataTypes.STRING,
		defaultValue: 'X',
		allowNull: false
	},
	state: {
		type: DataTypes.ENUM("pending", "playing", "finished"),
		allowNull: false,
		defaultValue: "pending",
	},
	winnerScore: {
		type: DataTypes.INTEGER,
		allowNull: true,
	}
});

Game.belongsTo(User, { targetKey: "id", foreignKey: "creator", as: "player1" });
Game.belongsTo(User, {
	allowNull: true,
	targetKey: "id",
	foreignKey: "player",
	as: "player2",
});
Game.belongsTo(User, {
	allowNull: true,
	targetKey: "id",
	foreignKey: "winner",
	as: "winPlayer",
});

export default Game;