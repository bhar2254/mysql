/**
 * mysql-extensions.js
 * 
 * A collection of extended MySQL utilities to enhance database operations in a Node.js environment.
 * This module focuses on caching database results and providing advanced querying capabilities.
 * The goal is to provide efficient ways to fetch data from the database with built-in caching mechanisms.
 * 
 * Exports:
 *  - Functions for caching database results and reducing redundant queries.
 * 
 * @module @bhar2254/mysql
 */

const axios = require('axios')
const { SQLObject }= require('./mysql-object')

const cacheFetch = async (ref, url) => {
    const cache = new SQLObject({ table: 'cache', key: 'ref', id: ref, datum: { ref } });
    const record = await cache.read();

    if (!record || record.length === 0 || !record.value || record.value === "{}") {
        console.log(`Fetching with axios from ${url}`);
        const { data } = await axios.get(url); // Using shorthand axios method
        const value = JSON.stringify(data)
            .replace(/\\[rn]/g, '') // Remove `\n` and `\r`
            .replace(/\\"/g, '\\\"')  // Escape double quotes
            .trim();

        console.log(`VALUE : ||| : ${value}`)
        await cache.create({ ref, value, safe: false });
    }
    console.log(`CACHE -----`, cache)

    const parsedValue = JSON.parse(cache.datum.value.replace(/\\"/g, '"').trim());
    return { ...parsedValue, guid: cache.datum.guid };
};

module.exports = {
    cacheFetch,
}