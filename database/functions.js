const { RecordDoesNotExist, NonUniqueRecordError } = require("./error");
const pool = require("./index");

const getSingleRow = async (sql, params) => {
  const engine = process.env.DATABASE_ENGINE;

  if (!["postgres", "mysql", "sqlite"].includes(engine)) {
    throw new Error(
      "Unsupported DATABASE_ENGINE. Use 'postgres', 'mysql', or 'sqlite'."
    );
  }

  let connection;
  try {
    if (engine === "sqlite") {
      connection = pool;
      const row = await connection.get(sql, params);
      if (!row) throw new RecordDoesNotExist("No matching records found");
      return row; // SQLite .get always returns a single row or undefined
    } else {
      connection =
        engine === "postgres"
          ? await pool.connect()
          : await pool.getConnection();

      const rawResult = await connection.query(sql, params);
      const result = engine === "postgres" ? rawResult.rows : rawResult[0];

      if (result.length === 1) {
        return result[0];
      } else if (result.length === 0) {
        throw new RecordDoesNotExist("No matching records found");
      } else {
        throw new NonUniqueRecordError("Multiple matching records found");
      }
    }
  } catch (error) {
    if (
      error instanceof RecordDoesNotExist ||
      error instanceof NonUniqueRecordError
    ) {
      throw error;
    } else {
      throw new Error(`Database query error: ${error.message}`);
    }
  } finally {
    if (connection && engine !== "sqlite") {
      connection.release?.(); // Release the connection where it's avaialable
    }
  }
};

const createRowAndReturn = async (
  tableName,
  sql,
  params,
  existingConnection
) => {
  let connection;
  const isPostgres = process.env.DATABASE_ENGINE === "postgres";
  const isMySQL = process.env.DATABASE_ENGINE === "mysql";
  const isSQLite = process.env.DATABASE_ENGINE === "sqlite";

  if (!isPostgres && !isMySQL && !isSQLite) {
    throw new Error(
      "Unsupported DATABASE_ENGINE. Use 'postgres', 'mysql' or 'sqlite'."
    );
  }

  if (existingConnection) {
    connection = existingConnection;
  } else {
    connection = isPostgres ? await pool.connect() : await pool.getConnection();
  }

  try {
    if (!existingConnection) {
      // Start transaction
      if (isPostgres || isMySQL) {
        await connection.query(isPostgres ? "BEGIN" : "START TRANSACTION");
      } else if (isSQLite) {
        await connection.run("BEGIN");
      }
    }

    let insertedId;
    if (isMySQL) {
      // MySQL: Insert and get ID
      const [insertAction] = await connection.query(sql, params);
      insertedId = insertAction.insertId; // Get inserted ID
    } else if (isSQLite) {
      // SQLite: Insert and get ID using lastID
      const insertAction = await connection.run(sql, params);
      insertedId = insertAction.lastID; // Get inserted ID
    } else if (isPostgres) {
      // PostgreSQL: Append RETURNING id to the query
      const result = await connection.query(sql + " RETURNING id", params);
      insertedId = result.rows[0].id; // Get inserted ID
    }

    console.log({ insertedId, tableName });

    // Fetch the inserted row
    const resultQuery = `SELECT * FROM ${tableName} WHERE id = $1`; // PostgreSQL uses $1 for params
    const resultParams = [insertedId];

    let result;
    if (isMySQL) {
      [result] = await connection.query(
        `SELECT * FROM ${tableName} WHERE id = ?`,
        resultParams
      );
    } else if (isSQLite) {
      result = await connection.get(
        `SELECT * FROM ${tableName} WHERE id = ?`,
        resultParams
      );
    } else if (isPostgres) {
      const res = await connection.query(resultQuery, resultParams);
      result = res.rows;
    }

    if (!existingConnection) {
      await (isSQLite ? connection.run("COMMIT") : connection.query("COMMIT")); // Commit transaction
    }

    return isSQLite ? result : result[0]; // Return the inserted row
  } catch (error) {
    if (!existingConnection) {
      try {
        await (isSQLite
          ? connection.run("ROLLBACK")
          : connection.query("ROLLBACK")); // Rollback on error
      } catch (_) {
        // ignore rollback failure
      }
    }
    throw error;
  } finally {
    if (!existingConnection) {
      await connection.release?.(); // Release the connection where it's avaialable
    }
  }
};

module.exports = {
  getSingleRow,
  createRowAndReturn,
};
