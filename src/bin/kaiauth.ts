#!/usr/bin/env node
import path from 'path';
import Database from 'better-sqlite3';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { UserStore } from '../lib/user-store';

function resolveDb(dbPath: string): UserStore {
  const resolved = path.resolve(dbPath);
  const db = new Database(resolved);
  return new UserStore(db);
}

yargs(hideBin(process.argv))
  .scriptName('kaiauth')
  .demandCommand(1, 'Specify a command: add | list')
  .strict()
  .command(
    'add-user <username> <password>',
    'Add a new user',
    (y) =>
      y
        .positional('username', { type: 'string', demandOption: true })
        .positional('password', { type: 'string', demandOption: true })
        .option('db', { type: 'string', demandOption: true, describe: 'Path to the SQLite database file' }),
    (argv) => {
      const store = resolveDb(argv.db);
      if (store.exists(argv.username)) {
        console.error(`User "${argv.username}" already exists.`);
        process.exit(1);
      }
      store.insert({ username: argv.username, password: argv.password });
      console.log(`Added user "${argv.username}".`);
    }
  )
  .command(
    'list-users',
    'List all users',
    (y) =>
      y.option('db', { type: 'string', demandOption: true, describe: 'Path to the SQLite database file' }),
    (argv) => {
      const store = resolveDb(argv.db);
      const users = store.findAll();
      if (users.length === 0) {
        console.log('No users found.');
      } else {
        users.forEach((u) => console.log(`${u.id}\t${u.username}`));
      }
    }
  )
  .parse();
