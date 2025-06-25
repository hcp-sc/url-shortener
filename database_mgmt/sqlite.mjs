/**
 * @typedef {import("better-sqlite3").Database} Database
 * @typedef {import("better-sqlite3").Statement} Statement
 */
import Database from "better-sqlite3";
import path from "path";
import fs from 'fs/promises';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads a SQL file into db.prepare.
 * 
 * @param {Database} db - The better-sqlite3 database.
 * @param {string} filename - The file to load the SQL command form.
 * @returns {Promise<Statement>} - A prepared SQL command.
 */
async function loadSQL(db, filename) {
  return db.prepare(
    (await fs.readFile(path.resolve(
      __dirname,
      'sql_cmds',
      filename
    ))).toString().trim()
  )
}

/**
 * Determines the primary key column (and others) for a table.
 * If no tableName is provided, goes through all tables in order.
 * 
 * @param {Database} db - The database to search
 * @param {string} [tableName] - The tableName to inspect (optional).
 * @returns {{
 *   tableName: string,
 *   pk: string,
 *   valueColumns: Array<{name: string, type: string}>
 * }}
 * @throws {TypeError} when unsuitable database is found.
 */
function determinePkey(db, tableName){
  const getColumns = tbl => db.prepare(`PRAGMA table_info(${tbl})`).all();
  let pk;
  if(tableName) {
    const columns = getColumns(tableName);
    if(!columns.length)throw new TypeError(`Table ${tableName} has no columns (or is nonexistent).`);

    const pkColumn = columns.find(col => col.pk === 1);
    if(!pkColumn)throw new TypeError(`Table ${tableName} must have a Primary Key.`);
    const valueColumns = columns.filter(col => col.name !== pk).map(col => ({
      name: col.name,
      type: col.type
    }));
    return { tableName, pk: pkColumn.name, pkType: pkColumn.type, valueColumns };
  }

  for (const { name } of db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all()) {
    const columns = getColumns(name);
    if(columns.length === 0) continue;

    const pkColumn = columns.find(col => col.pk === 1);
    if(!pkColumn) continue;

    const valueColumns = columns.filter(col => col.name !== pk).map(col => ({
      name: col.name,
      type: col.type
    }));

    return {tableName: name, pk: pkColumn.name, pkType: pkColumn.type, valueColumns}
  }

  throw new TypeError("No user-defined table with primary key found.")
}

function convertKey(key, pkType) {
  switch(pkType.toUpperCase()) {
    case "INTEGER":
      return parseInt(key, 10)
    case "REAL":
      return parseFloat(key)
    case "DATE":
    case "DATETIME":
      return new Date(key).toISOString()
    default:
      return String(key)
  }
}

/**
 * Load a file as a SQLite 3 database into better-sqlite3.
 * 
 * @param {string} filename - The file to load as a database
 * @returns {Promise<Proxy>} - The Proxy that returns Database Values for the JSON.
 */
async function loadFile(filename) {
  const db = new Database(filename);
  const createTable = await loadSQL(db, "createtable.sql");createTable.run()
  const addRow = await loadSQL(db, "addrow.sql");
  const deleteRow = await loadSQL(db, "deleterow.sql");
  const getRow = await loadSQL(db, "getrow.sql");

  const { tableName, pk, pkType, valueColumns } = determinePkey(db);

  return new Proxy({},{
    get(_, property){
      if (typeof property !== "string") return undefined;
      return getRow.get(convertKey(property, pkType));
    },
    set(_, property, value){
      if (typeof property !== "string" || typeof value !== "object" || value === null) return false;
      const row = { [pk]: convertKey(property, pkType) };
      for (const {name, type} of valueColumns) {
        if(name===pk)continue;
        const raw = value[name];
        if (raw === undefined) {
          row[name] = null;
        } else {
          row[name] = convertKey(raw, type);
        }
      }

      addRow.run(row);
      return true;
    },
    deleteProperty(_, property){
      if (typeof property !== "string") return false;
      deleteRow.run(convertKey(property, pkType));
      return true;
    },
    defineProperty(){
      // trigger the set trap instead
      return false;
    },
    getOwnPropertyDescriptor(_, property) {
      if (typeof property !== "string") return;
      const row = getRow.get(convertKey(property, pkType));
      if (!row) return;

      return {
        configurable: true,
        enumerable: true,
        value: row,
        writable: false
      };
    },
    ownKeys() {
      const rows = db.prepare(`SELECT ${pk} FROM ${tableName}`).all();
      return rows.map(row => String(row[pk]));
    }
  });
}

export { loadFile };