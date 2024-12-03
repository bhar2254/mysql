/**
 * mysql-object.js
 * 
 * A module providing the SQLObject class for managing CRUD operations and database interactions.
 * This class encapsulates common database operations such as Create, Read, Update, and Delete (CRUD),
 * as well as other helper functions like `readOrCreate`, which ensures that an object is created if it doesn't exist.
 * The `SQLObject` class is designed to work with MySQL databases and integrates with other utility modules
 * for seamless database interaction.
 *
 * Exports:
 *  - SQLObject class that provides methods for interacting with database tables.
 * 
 * @module @bhar2254/mysql
 */

const NODE_ENV = process.env.NODE_ENV || 'development'
require('dotenv').config({path: `.env.${NODE_ENV}`})

const { getPropertiesFromDB, 
    buildInsertQuery, 
	buildUpdateQuery, 
	buildSelectQuery, 
	buildDeleteQuery,
    queryPromise } = require('./mysql-helper');

//
//	SQL PATCH / POST FUNCTIONS
//

//	for converting from data (int) to human readable
//	these are the defaults.
//	in the future the SQLType class will be able to update and keep track of these.
//	loaded in this script manually, but later can be loaded by accessing sql database
class SQLObject {
    constructor(args = {}) {
        const {
            table = null,
            data = [{}],
            datum = {},
            key = 'guid',
            id = null,
            all = false
        } = args;

        this.table = table;
        this.data = data;
        this.datum = datum;
        this.key = key;
        this.id = id;
        this.all = all;
    }

    // Getter and Setter for `table`
    set table(value) {
        this._table = value;
    }
    get table() {
        return this._table;
    }

    // Getter and Setter for `last`
    set last(value) {
        this._last = {
            query: value.query || 'No query recorded!',
            response: value.response || [{ guid: '00000000-0000-0000-0000-000000000000', response: 'No data...' }]
        };
    }
    get last() {
        return this._last || { query: 'No query recorded!', response: [{ guid: '00000000-0000-0000-0000-000000000000', response: 'No data...' }] };
    }

    // Getter and Setter for `key`
    set key(value) {
        this._key = value;
    }
    get key() {
        return this._key;
    }

    // Getter and Setter for `datum`
    set datum(value) {
        this._datum = value;
    }
    get datum() {
        return this._datum || this.data[0] || {};
    }

    // Getter and Setter for `data`
    set data(value) {
        if (Array.isArray(value)) {
            this._data = value;
            this.datum = value[0];
        } else {
            console.warn(`Data must be an array. Invalid input: ${JSON.stringify(value)}`);
        }
    }
    get data() {
        return this._data || (this._datum ? [this._datum] : []);
    }

    // Getter and Setter for `id`
    set id(value) {
        this._id = value;
    }
    get id() {
        return this.data[0] ? this.data[0][this.key] || this._id : null;
    }

    // Getter and Setter for `labels`
    set labels(value) {
        this._labels = Array.isArray(value) ? value : [];
    }
    get labels() {
        return this._labels || [];
    }

    // Getter and Setter for `properties`
    set properties(value) {
        this._properties = value;
    }
    get properties() {
        return this._properties || {};
    }

    // Getter and Setter for `initialized`
    set initialized(value) {
        this._initialized = Boolean(value);
    }
    get initialized() {
        return this._initialized || false;
    }

    // Initialize the SQL object, if not already initialized
    async initialize() {
        if (this.initialized) return this.properties;
        const { table } = this;
        const properties = await getPropertiesFromDB(table)
        return this.properties = properties
	}
//	Insert into SQL db and update this.id
    async create(args) {
        console.log(`SQLObject.create() start: ${JSON.stringify(this.datum)}`);

        if (!this.initialized) await this.initialize();

        const { datum, properties, table } = this;
        const _args = { ...args };
        const create = {};
        const { safe = true } = args

        // Filter valid properties
        for (const key of Object.keys(properties)) {
            if (_args && _args[key]) {
                create[key] = _args[key];
            }
        }
        this.datum = create;
        this.data = [create];

        const query = buildInsertQuery(table, create, properties, safe);

        if (!query) {
            console.log(`SQLObject.create() failure: no elements to create ${JSON.stringify(datum)}`);
            return 0;
        }

        try {
            const response = await queryPromise(query);
            this.key = 'id';
            this.id = response.insertId;
            this.last = { query, response };
            console.log(`SQLObject.create() success: ${JSON.stringify(response)} ${query}`);
            await this.read()
            return response;
        } catch (error) {
            console.log(`SQLObject.create() failure: ${query}`);
            return undefined;
        }
    }

    // Read function
    async read(args = {}) {
        if (!this._initialized) await this.initialize();

        const { table, properties, id, key, all = false } = this;
        const query = buildSelectQuery(table, properties, id, key, all, args);

        const data = await queryPromise(query);

        if (!data.length) {
            console.log(`Query returned no results: ${query}`);
            this.last = { query, response: data };
            return 0;
        }

        this.data = data;
        this.datum = data[0]
        this.last = { query, response: data };
        console.log(`SQLObject.read(): ${query}`);
        this._read = true;
        return data;
    }

    // Update function
    async update(datum) {
        if (!this._initialized) await this.initialize();

        // Ensure we read the data before updating
        if (!this._read) await this.read();

        if (!datum) {
            console.log('Datum required to update object');
            return 0;
        }

        const update = {};
        Object.keys(datum).forEach((key) => {
            if (datum[key]) update[key] = datum[key];
        });

        const query = buildUpdateQuery(this.table, datum, this.properties, this.id, this.key, this.all);

        if (!query) {
            console.log('SQLObject.update(): no values set');
            return 0;
        }

        try {
            const response = await queryPromise(query);
            this._last = { query, response };
            this.data = [update];
            console.log(`SQLObject.update(): ${query}`);
            return response;
        } catch (error) {
            console.log(`SQLObject.update() failure: ${query}`);
            return 0;
        }
    }

    // Destroy function
    async destroy() {
        if (!this._initialized) await this.initialize();

        const query = buildDeleteQuery(this.table, this.id);

        try {
            const response = await queryPromise(query);
            this._last = { query, response };
            console.log('SQLObject.destroy(): object deleted');
            return 1;
        } catch (error) {
            console.log(`SQLObject.destroy() failure: ${query}`);
            return 0;
        }
    }

    // Read or create function
    async readOrCreate(datum) {
        const response = await this.read();
        if (!response) {
            await this.create(datum);
            return await this.read();
        }
        return response;
    }
}

// 	Export functions for later use
module.exports = {
	SQLObject,
}