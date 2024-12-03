/**
 * mysql.js
 * 
 * This module is the main entry point for interacting with MySQL databases.
 * It combines essential utilities from `sqlHelper`, `sqlExtensions`, and the
 * `SQLObject` class to provide a complete set of tools for managing SQL queries
 * and database objects.
 * 
 * Exports:
 *  - SQL helpers from the `sqlHelper` module (functions for working with queries, databases, and metadata).
 *  - SQL extensions from the `sqlExtensions` module (custom functionalities like caching).
 *  - The `SQLObject` class, which encapsulates CRUD operations and object-based database management.
 * 
 * Usage:
 * To use this package, simply import the desired functionality from the module.
 * For example:
 * 
 * const { buildInsertQuery, ..., SQLObject } = require('@bhar2254/mysql');
 * 
 * @module mysql
 */

const NODE_ENV = process.env.NODE_ENV || 'development'
require('dotenv').config({path: `.env.${NODE_ENV}`})

const sqlHelper = require('./mysql-helper');
const { SQLObject } = require('./mysql-object');
const sqlExtensions = require('./mysql-extensions');

// 	Export functions for later use
module.exports = {
	...sqlHelper,
	...sqlExtensions,
	SQLObject,
}