#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const user_store_1 = require("../lib/user-store");
function resolveDb(dbPath) {
    const resolved = path_1.default.resolve(dbPath);
    const db = new better_sqlite3_1.default(resolved);
    return new user_store_1.UserStore(db);
}
(0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .scriptName('kaiauth')
    .demandCommand(1, 'Specify a command: add | list')
    .strict()
    .command('add-user <username> <password>', 'Add a new user', (y) => y
    .positional('username', { type: 'string', demandOption: true })
    .positional('password', { type: 'string', demandOption: true })
    .option('db', { type: 'string', demandOption: true, describe: 'Path to the SQLite database file' }), (argv) => {
    const store = resolveDb(argv.db);
    if (store.exists(argv.username)) {
        console.error(`User "${argv.username}" already exists.`);
        process.exit(1);
    }
    store.insert({ username: argv.username, password: argv.password });
    console.log(`Added user "${argv.username}".`);
})
    .command('list-users', 'List all users', (y) => y.option('db', { type: 'string', demandOption: true, describe: 'Path to the SQLite database file' }), (argv) => {
    const store = resolveDb(argv.db);
    const users = store.findAll();
    if (users.length === 0) {
        console.log('No users found.');
    }
    else {
        users.forEach((u) => console.log(`${u.id}\t${u.username}`));
    }
})
    .parse();
//# sourceMappingURL=kaiauth.js.map