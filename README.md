A comprehensive MySQL utility package for Node.js applications. This package provides essential tools for interacting with MySQL databases, including query construction, metadata handling, object-based CRUD operations, and custom extensions like caching.

---

## Features

- **SQL Helpers**: Functions for constructing common SQL queries (e.g., `INSERT`, `UPDATE`, `SELECT`, `DELETE`), working with database metadata, and more.
- **SQL Extensions**: Custom extensions such as caching to enhance database interaction.
- **SQLObject Class**: A class to interact with MySQL database objects using CRUD operations. Supports automatic data mapping, reads, creates, updates, and deletes.
- **Modular and Extensible**: Easily extend the functionality by adding custom helpers or overriding existing methods.

---

## Installation

To install the package, use npm:

```bash
npm install @bhar2254/mysql
```

---

## Usage

### Basic SQL Operations

You can import the necessary functions from `@bhar2254/mysql` for query construction, object CRUD operations, and metadata fetching.

#### Example: Building Queries

```javascript
const { buildInsertQuery, buildSelectQuery, buildUpdateQuery } = require('@bhar2254/mysql');

const insertQuery = buildInsertQuery('users', { name: 'John Doe', age: 30 });
const selectQuery = buildSelectQuery('users', ['id', 'name'], { age: 30 });
const updateQuery = buildUpdateQuery('users', { age: 31 }, { name: 'John Doe' });

console.log(insertQuery);
console.log(selectQuery);
console.log(updateQuery);
```

#### Example: Using SQLObject

```javascript
const { SQLObject } = require('@bhar2254/mysql');

// Create a new SQLObject instance for a 'users' table
const user = new SQLObject({
  table: 'users',
  key: 'id',
  datum: { name: 'John Doe', age: 30 }
});

// Create the user in the database
await user.create();

// Read the user data by ID
await user.read({ id: 1 });

// Update the user data
await user.update({ name: 'Jane Doe' });

// Delete the user data
await user.destroy();
```

#### Example: Using Cache with `cacheFetch`

```javascript
const { cacheFetch } = require('@bhar2254/mysql');

const data = await cacheFetch('user_1', '/api/users/1');
console.log(data);
```

---

## API

### SQL Helpers

- **buildInsertQuery(table, data)**: Generates an `INSERT` SQL query for the provided table and data.
- **buildUpdateQuery(table, data, where)**: Generates an `UPDATE` SQL query for the provided table, data, and conditions.
- **buildSelectQuery(table, columns, where)**: Generates a `SELECT` SQL query for the provided table, columns, and conditions.
- **buildDeleteQuery(table, where)**: Generates a `DELETE` SQL query for the provided table and conditions.
- **buildPaginationQuery(table, page, pageSize)**: Generates a paginated `SELECT` query with `LIMIT` and `OFFSET`.
- **queryPromise(query)**: Executes a raw SQL query and returns the result.

### SQL Extensions

- **cacheFetch(ref, url)**: Fetches data from the specified URL and caches it in the database, returning cached or newly fetched data.
  
### SQLObject Class

- **SQLObject**: A class that provides CRUD operations for interacting with database tables.  
  - `create(args)`: Creates a new record in the table.
  - `read(args)`: Reads records from the table based on conditions.
  - `update(datum)`: Updates existing records in the table.
  - `destroy()`: Deletes a record from the table.
  - `readOrCreate(data)`: Reads a record, and if none exists, creates it.

---

## Additional Functions

- **getEmptyObjectFromDB(table)**: Loads an empty object with columns set to `null` for the specified table.
- **getBaseViewTables()**: Retrieves the list of base tables and views in the database.
- **getColumnKeysFromDB(table)**: Retrieves the column names for the specified table.
- **getPropertiesFromDB(table)**: Loads the properties (column names and data types) of the table.
- **getEnumFromDB(table, column)**: Retrieves the enum values for a specified column in the table.
- **getTablesFromDB()**: Retrieves a list of all table names in the database.
- **getColumnAttributesFromDB(table, column)**: Retrieves the attributes of a specified column (e.g., primary key, foreign key).
- **getRowCount(table)**: Retrieves the row count for the specified table.
- **getForeignKeyRelationships(table)**: Retrieves foreign key relationships for the specified table.
- **doesTableExist(table)**: Checks if a table exists in the database.
- **isViewTable(table)**: Checks if a table is a view.
- **escapeSQL(str)**: Escapes special characters in SQL queries to prevent SQL injection.

---

## Contribution

We welcome contributions! If you'd like to contribute, please fork the repository, create a feature branch, and submit a pull request.

---

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

## Contact

For any inquiries or issues, feel free to open an issue on GitHub or reach out to the maintainer.

[bhar2254](https://github.com/bhar2254)
