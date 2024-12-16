/**
 * mysql-helper.js
 * 
 * A collection of utility functions to simplify MySQL operations within a Node.js application.
 * Provides support for querying, building SQL queries, and handling common database tasks like
 * retrieving metadata, generating inserts/updates, escaping SQL, and more.
 *
 * Exports:
 *  - Functions for building SQL queries (INSERT, UPDATE, SELECT, DELETE)
 *  - Functions for interacting with the database schema (tables, columns, relationships)
 *  - Utility functions for escaping SQL, pagination, and retrying queries
 *
 * @module @bhar2254/mysql
 */

const NODE_ENV = process.env.NODE_ENV || 'development'
require('dotenv').config({ path: `.env.${NODE_ENV}` })

const mysql = require('mysql2/promise')

const buildEnvFromMetaTable = async () => {
    const response = {}
    const meta = await queryPromise(`SELECT * FROM meta`)
    meta.forEach(x => {
        response[x.meta_key] = JSON.parse(x.meta_value)
    })
    const { scopes, scopeTypes } = response
    for (const table of Object.keys(scopes))
        for (const key of Object.keys(scopes[table]))
            response.scopes[table][key] = scopeTypes[scopes[table][key]] || scopes[table][key]

    return response
}

const filterObjectByTable = async (obj, table) => {
    const allowedKeys = await getColumnKeysFromDB(table)
    const returnObj = {}
    for (const each of Object.keys(obj))
        if (allowedKeys.includes(each)) returnObj[each] = obj[each] || ''
    return returnObj
}

const safeAssign = (valueFn, catchFn) => {
    try {
        return valueFn()
    } catch (e) {
        if (catchFn) catchFn(e)
        return null
    }
}

/**
 * Load an empty object based on the columns of a table.
 * @param {string} table - The name of the table to fetch columns from.
 * @returns {Object} - An object with column names as keys, and null as their values.
 */
const getEmptyObjectFromDB = async (table) => {
    const data = await queryPromise(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${process.env.DB_DB}'
        AND TABLE_NAME = '${table}'
    `);

    const columns = data.map(x => x.COLUMN_NAME);
    const returnObj = {};

    columns.forEach(column => {
        returnObj[column] = null;
    });

    return returnObj;
};

/**
 * Load all tables and views from the database.
 * @returns {Array} - An array of objects containing the table/view name and its type.
 */
const getBaseViewTables = async () => {
    const data = await queryPromise(`
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = '${process.env.DB_DB}'
        AND table_type IN ('BASE TABLE', 'VIEW');
    `);

    return data.map(x => ({ name: x.TABLE_NAME, type: x.TABLE_TYPE }));
};

/**
 * Load all column names for a specific table.
 * @param {string} table - The table to fetch column names from.
 * @returns {Array} - A list of column names for the given table.
 */
const getColumnKeysFromDB = async (table) => {
    const data = await queryPromise(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${process.env.DB_DB}'
        AND TABLE_NAME = '${table}'
    `);

    return data.map(x => x.COLUMN_NAME);
};

/**
 * Load properties (column names and data types) for a table.
 * @param {string} table - The table to fetch properties from.
 * @returns {Object} - A map of column names to their respective data types.
 */
const getPropertiesFromDB = async (table) => {
    const query = `SELECT DATA_TYPE, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_DB}' AND TABLE_NAME = '${table}'`;

    try {
        const response = await queryPromise(query);
        const properties = {};

        response.forEach(column => {
            const { COLUMN_NAME, DATA_TYPE } = column;
            properties[COLUMN_NAME] = DATA_TYPE || 'undefined';
        });

        return properties;
    } catch (error) {
        console.log(`Error while loading properties from DB for table ${table}: ${error}`);
        throw new Error(`Failed to load properties from table: ${table}`);
    }
};

/**
 * Load the ENUM values for a specific column in a table.
 * @param {string} table - The name of the table.
 * @param {string} column - The name of the column.
 * @returns {Array} - The ENUM values of the column.
 */
const getEnumFromDB = async (table, column) => {
    const data = await queryPromise(`
        SELECT COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${process.env.DB_DB}'
        AND TABLE_NAME = '${table}'
        AND COLUMN_NAME = '${column}'
    `);

    // Extract the ENUM values from the COLUMN_TYPE if it's an ENUM type
    if (data.length > 0 && data[0].COLUMN_TYPE.startsWith('enum(')) {
        const enumValues = data[0].COLUMN_TYPE.match(/\((.*?)\)/)[1].split(',').map(value => value.replace(/'/g, ''));
        return enumValues;
    }

    return [];
};

/**
 * Load all table names from the database.
 * @returns {Array} - A list of table names.
 */
const getTablesFromDB = async () => {
    const data = await queryPromise(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '${process.env.DB_DB}';
    `);

    return data.map(row => row.TABLE_NAME);
};

/**
* Retrieves column attributes for a specific column in a table.
* 
* @param {string} table - The name of the table.
* @param {string} column - The name of the column.
* @returns {Promise<Object>} - A promise that resolves with the column attributes.
*/
const getColumnAttributesFromDB = async (table, column) => {
    const query = `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, DATA_TYPE
                   FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = '${process.env.DB_DB}' AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`;
    const result = await queryPromise(query);
    return result.length ? result[0] : null;
};

/**
 * Gets the row count of a table.
 * 
 * @param {string} table - The table name.
 * @returns {Promise<number>} - The number of rows in the table.
 */
const getRowCount = async (table) => {
    const query = `SELECT COUNT(*) AS count FROM ${table}`;
    const result = await queryPromise(query);
    return result[0].count;
};


/**
* Retrieves foreign key relationships for a table.
* 
* @param {string} table - The name of the table.
* @returns {Promise<Array>} - A promise that resolves with an array of foreign key relationships.
*/
const getForeignKeyRelationships = async (table) => {
   const query = `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
                  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                  WHERE TABLE_SCHEMA = '${process.env.DB_DB}' AND TABLE_NAME = '${table}' AND REFERENCED_TABLE_NAME IS NOT NULL`;
   const result = await queryPromise(query);
   return result;
};

/**
 * Checks if a table exists in the database.
 * 
 * @param {string} table - The table name.
 * @returns {Promise<boolean>} - Resolves to `true` if the table exists, otherwise `false`.
 */
const doesTableExist = async (table) => {
    const query = `SELECT COUNT(*) AS count FROM information_schema.tables
                   WHERE table_schema = '${process.env.DB_DB}' AND table_name = '${table}'`;
    const result = await queryPromise(query);
    return result[0].count > 0;
};

const isViewTable = async (table) => {
    data = await queryPromise(`SELECT 
			table_name,
			table_type
		FROM 
			information_schema.tables
		WHERE 
			table_name = '${table}' AND
			table_schema = '${process.env.DB_DB}'`)
    for (const each of data)
        if (each.TABLE_NAME === table)
            return each.TABLE_TYPE == 'VIEW'
    return undefined
}

// Helper to escape and format values properly for SQL queries
function escapeValue(value) {
    return String(value)
        .replace(/\\/g, '\\\\')    // Escape backslashes
        .replace(/'/g, "\\'")      // Escape single quotes
        .replace(/"/g, '\\"')      // Escape double quotes
        .replace(/\0/g, '\\0');    // Escape null characters
}

/**
 * Escapes values to prevent SQL injection.
 * 
 * @param {string} value - The value to escape.
 * @returns {string} - The escaped value.
 */
const escapeSQL = (value) => {
    if (typeof value === 'string') {
        return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
    return value;
};


// Helper to construct an INSERT query
function buildInsertQuery(table, data, properties, safe = true) {
    const elements = Object.keys(data).filter(
        (key) => !key.startsWith('_') && properties[key] && data[key]
    );

    if (elements.length === 0) return null;

    const columns = elements.join('`, `');
    const values = elements.map((key) => safe ? escapeValue(data[key]) : data[key]).join('", "');

    return `INSERT INTO ${table} (\`${columns}\`) VALUES ("${values}");`;
}

/**
 * Constructs a bulk insert query for a table.
 * 
 * @param {string} table - The table name.
 * @param {Array<Object>} rows - An array of objects representing rows to insert.
 * @returns {Promise<Object>} - The result of the insert query.
 */
const buildBulkInsertQuery = async (table, rows) => {
    if (!rows.length) return 0;

    const columns = Object.keys(rows[0]);
    const values = rows.map(row => `(${columns.map(col => escapeSQL(row[col])).join(', ')})`).join(', ');

    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values}`;
    const result = await queryPromise(query);
    return result;
};

// Helper to construct an UPDATE query
function buildUpdateQuery(table, datum, properties, id, key, all) {
    const setValues = Object.keys(datum)
        .filter(
            (key) =>
                !key.startsWith('_') &&
                datum[key] !== undefined &&
                datum[key] !== null &&
                datum[key] !== 'undefined' &&
                datum[key] !== 'null' &&
                Object.keys(properties).includes(key)
        )
        .map((key) => `\`${key}\` = "${escapeValue(datum[key])}"`);

    if (setValues.length === 0) return null;

    const whereClause = !all ? `WHERE ${key} = "${id}"` : '';
    return `UPDATE ${table} SET ${setValues.join(', ')} ${whereClause};`;
}

/**
 * Updates multiple columns in a table for a specific row.
 * 
 * @param {string} table - The table name.
 * @param {string} key - The column to use for the condition (e.g., 'id').
 * @param {string} id - The value of the key (e.g., row id).
 * @param {Object} updates - An object containing the columns to update and their new values.
 * @returns {Promise<Object>} - The result of the update query.
 */
const buildBulkUpdateQuery = async (table, key, id, updates) => {
    const setClause = Object.keys(updates)
        .map(col => `${col} = '${escapeSQL(updates[col])}'`)
        .join(', ');

    const query = `UPDATE ${table} SET ${setClause} WHERE ${key} = '${escapeSQL(id)}'`;
    return query;
};

// Helper to construct a SELECT query with time conversion if necessary
function buildSelectQuery(table, properties, id, key, all, args) {
    const { limit, offset, orderBy, groupBy, where } = args;
    const timeConversion = Object.keys(properties)
        .filter((key) => properties[key] === 'date' || properties[key] === 'datetime')
        .map((key) => `, DATE_FORMAT(${key}, '${properties[key] === 'date' ? date_format : datetime_format}') AS ${key}`)
        .join('');

    const whereStmt = where ? Object.keys(where).map(x => `${x} ${where[x]}`).join(' AND ') : all ? '' : ` WHERE ${key} = "${id}"`;
    return `SELECT *${timeConversion} FROM ${table}${whereStmt}${orderBy ? ` ORDER BY ${orderBy}` : ''}${groupBy ? ` GROUP BY ${groupBy}` : ''}${offset ? ` OFFSET ${offset}` : ''}${limit ? ` LIMIT ${limit}` : ''};`;
}

// Helper to construct a DELETE query
function buildDeleteQuery(table, id) {
    return `DELETE FROM ${table} WHERE guid = "${id}";`;
}

/**
 * Builds a pagination SQL query (with `LIMIT` and `OFFSET`).
 * 
 * @param {number} page - The page number (starts at 1).
 * @param {number} pageSize - The number of records per page.
 * @returns {Object} - The pagination query parameters (LIMIT and OFFSET).
 */
const buildPaginationQuery = (page = 1, pageSize = 10) => {
    const offset = (page - 1) * pageSize;
    return { limit: pageSize, offset };
};

async function createPool() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_DB,
        waitForConnections: true,
        connectionLimit: 32,
        queueLimit: 0
    })

    return pool
}

/*	Function for using async DB.query 	*/
const queryPromise = async (str) => {
    const pool = await createPool();

    const result = await pool.query(str);

    pool.end(); // Close the pool when done

    const [rows] = result

    return rows
}

/**
 * Executes a query with retry logic.
 * 
 * @param {string} query - The SQL query to execute.
 * @param {number} retries - The number of times to retry the query on failure.
 * @returns {Promise<Object>} - The result of the query.
 */
const executeQueryWithRetry = async (query, retries = 3) => {
    let attempt = 0;
    let lastError = null;

    while (attempt < retries) {
        try {
            return await queryPromise(query);
        } catch (error) {
            attempt++;
            lastError = error;
            console.log(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt >= retries) {
                throw new Error(`Query failed after ${retries} attempts: ${lastError.message}`);
            }
        }
    }
};

module.exports = {
    buildEnvFromMetaTable,
    filterObjectByTable,
    safeAssign,
    getEmptyObjectFromDB,
    getBaseViewTables,
    getColumnKeysFromDB,
    getPropertiesFromDB,
    getEnumFromDB,
    getTablesFromDB,
    getColumnAttributesFromDB,
    getRowCount,
    getForeignKeyRelationships,
    doesTableExist,
    isViewTable,
    escapeSQL,
    buildInsertQuery,
    buildBulkInsertQuery,
    buildUpdateQuery,
    buildBulkUpdateQuery,
    buildSelectQuery,
    buildDeleteQuery,
    buildPaginationQuery,
    queryPromise,
    executeQueryWithRetry,
};
