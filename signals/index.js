const { pool } = require("@anclatechs/sql-buns");
const EventEmitter = require("events");
const emitter = new EventEmitter();

const updateUserActivityTime = async ({ userId, timestamp }) => {
  await pool.run("UPDATE users SET last_activity = ? WHERE id = ?", [
    timestamp,
    userId,
  ]);
};

emitter.on("updateUserLastActivityTime", updateUserActivityTime);

module.exports = emitter;
