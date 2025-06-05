const path = require("path");
const fs = require("fs");
const mysql = require("mysql2/promise");
const { Pool } = require("pg");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

const SQL_ENGINE = process.env.DEPLOYSTER_DATABASE_ENGINE || "sqlite"; // Default to sqlite if none is available

/**
 * Validates required environment variables for MySQL and PostgreSQL.
 * SQLite only requires DATABASE_NAME (optional, defaults to ../database.sqlite).
 * @throws {Error} If required environment variables are missing.
 */
const validateConfig = () => {
  const requiredEnvVars = [
    "DATABASE_HOST",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "DATABASE_NAME",
  ];

  if (SQL_ENGINE === "mysql" || SQL_ENGINE === "postgres") {
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(
          `Missing required environment variable: ${envVar} for ${SQL_ENGINE}`
        );
      }
    }
  }
};

/**
 * Generates database configuration based on the engine.
 * @returns {Object} Configuration object for the selected database engine.
 * @throws {Error} If the database engine is unsupported.
 */
const getDatabaseConfig = () => {
  const baseConfig = {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  };

  switch (SQL_ENGINE) {
    case "mysql":
      return {
        ...baseConfig,
        port: process.env.DATABASE_DEPLOYSTER_PORT || 3306,
        connectionLimit: process.env.MYSQL_CONNECTION_LIMIT || 10,
        queueLimit: process.env.MYSQL_QUEUE_LIMIT || 0,
      };
    case "postgres":
      return {
        ...baseConfig,
        port: process.env.DATABASE_DEPLOYSTER_PORT || 5432,
        max: process.env.PG_MAX_CONNECTIONS || 20,
        idleTimeoutMillis: process.env.PG_IDLE_TIMEOUT || 30000,
      };
    case "sqlite":
      return {
        filename:
          process.env.DATABASE_NAME ||
          path.join(__dirname, "../database.sqlite"),
      };
    default:
      throw new Error(`Unsupported database engine: ${SQL_ENGINE}`);
  }
};

/**
 * Initializes the database connection pool.
 * For MySQL and PostgreSQL, creates a pool synchronously.
 * For SQLite, creates a Promise for the async open operation.
 * @returns {Promise<Object>} A Promise resolving to the pool/Database object.
 * @throws {Error} If initialization fails.
 */
const initiateEnginePool = async () => {
  try {
    validateConfig();

    let pool;
    switch (SQL_ENGINE) {
      case "mysql":
        pool = mysql.createPool(getDatabaseConfig());
        await pool.query("SELECT 1"); // Test connection
        return pool;

      case "postgres":
        const pgConfig = process.env.DEPLOYSTER_DATABASE_URL
          ? {
              connectionString: process.env.DEPLOYSTER_DATABASE_URL,
              ssl: { rejectUnauthorized: false },
            }
          : getDatabaseConfig();
        pool = new Pool(pgConfig);
        await pool.query("SELECT NOW()"); // Test connection
        return pool;

      case "sqlite":
        const { filename } = getDatabaseConfig();
        const dbDir = path.dirname(filename);

        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        pool = await open({
          filename,
          driver: sqlite3.Database,
          mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        });
        await pool.get("SELECT 1"); // Test connection
        return pool;

      default:
        throw new Error(`Unsupported database engine: ${SQL_ENGINE}`);
    }
  } catch (error) {
    console.error(`Failed to initialize ${SQL_ENGINE} database:`, error);
    throw error;
  }
};

// Initialize pool and store the Promise
let poolPromise = initiateEnginePool();
let pool;

// For MySQL/PostgreSQL, pool is created synchronously; for SQLite, it’s set after async initialization
if (SQL_ENGINE === "mysql") {
  pool = mysql.createPool(getDatabaseConfig());
} else if (SQL_ENGINE === "postgres") {
  pool = new Pool(
    process.env.DEPLOYSTER_DATABASE_URL
      ? {
          connectionString: process.env.DEPLOYSTER_DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        }
      : getDatabaseConfig()
  );
} else if (SQL_ENGINE === "sqlite") {
  // SQLite pool is assigned asynchronously in poolPromise.then
  poolPromise.then((db) => {
    pool = db;
  });
}

/**
 * Creates a Proxy to handle database pool access.
 * Why a Proxy?
 * - MySQL and PostgreSQL pools (mysql2.Pool, pg.Pool) are created synchronously,
 *   allowing immediate export as module.exports = pool.
 * - SQLite’s open (from sqlite package) is asynchronous, returning a Promise,
 *   so pool would be undefined at export time without special handling.
 * - The Proxy allows module.exports = pool to work for all engines by:
 *   - For MySQL/PostgreSQL: Directly forwarding method/property access to the pool.
 *   - For SQLite: Awaiting the async poolPromise before forwarding access,
 *     ensuring methods like .get, .all, .run, .exec work as expected.
 * This ensures consistent usage (const pool = require("./database"); await pool.get(...))
 * across all database engines, mimicking the synchronous export behavior of MySQL/PostgreSQL.

 * ADDITONAL NOTE!!!:
 * I think it's noteworth NOT to confuse sqlite.get with the native Proxy get trap.
 *
 * - sqlite.get(...): Executes an SQL query and returns one row.
 * - Proxy.get(target, prop): Intercepts property access on a Proxy object.
 *
 * The Proxy get trap is used to dynamically access and bind
 * methods like get, run, etc., from the resolved SQLite pool.
 * 
 * Same goes for the .has method. Herein, connection object hasn’t been resolved yet 
 * it's still a promise, so Javascript allows us to "pretend"  in a meantime that these methods 
 * ["get", "all", "run", "exec", "each", "close"]
 *  exist for compatibility.
 */

const poolProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === "then") {
        // Prevent treating pool as a Promise
        throw new Error(
          "Cannot use `await pool` or `pool.then(...)`. The pool is a Proxy object, not a Promise. " +
            "Use `await pool.get(...)`, `await pool.all(...)`, etc. for SQLite, or `await pool.query(...)` for MySQL/PostgreSQL."
        );
      }

      if (SQL_ENGINE === "sqlite") {
        // For SQLite, wait for poolPromise to resolve before accessing properties/methods
        return async function (...args) {
          const resolvedPool = await poolPromise;
          const value = resolvedPool[prop];
          if (typeof value === "function") {
            // Bind methods (e.g., get, all, run, exec) to the resolved Database object
            // and call them with provided arguments, returning the Promise
            return value.apply(resolvedPool, args);
          }
          // Return non-method properties directly
          console.log({ value, prop });
          return value;
        };
      }
      // For MySQL/PostgreSQL, use the synchronously created pool
      const value = pool[prop];
      if (typeof value === "function") {
        // Bind methods (e.g., query) to the pool to maintain context
        return value.bind(pool);
      }
      // Return non-method properties directly
      return value;
    },
    // Forward property existence checks
    has(target, prop) {
      if (SQL_ENGINE === "sqlite") {
        // For SQLite, assume common Database methods/properties exist after resolution
        return ["get", "all", "run", "exec", "each", "close"].includes(prop);
      }
      return prop in pool;
    },
  }
);

poolPromise
  .then(() => {
    console.log(`${SQL_ENGINE} database connection established successfully`);
  })
  .catch((error) => {
    console.error(`Failed to verify ${SQL_ENGINE} database connection:`, error);
    throw error;
  });

module.exports = poolProxy;
