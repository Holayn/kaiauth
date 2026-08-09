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
  .option('db', { type: 'string', demandOption: true, describe: 'Path to the SQLite database file' })
  .demandCommand(1, 'Specify a command')
  .strict()
  .command(
    'add-user <username> <password>',
    'Add a new user',
    (y) =>
      y
        .positional('username', { type: 'string', demandOption: true })
        .positional('password', { type: 'string', demandOption: true })
        .option('email', { type: 'string', describe: 'Email address for 2FA delivery' })
        .option('discord', { type: 'string', describe: 'Discord user ID for 2FA delivery' }),
    (argv) => {
      const store = resolveDb(argv.db);
      if (store.exists(argv.username)) {
        console.error(`User "${argv.username}" already exists. Use update-user to modify an existing user.`);
        process.exitCode = 1;
        return;
      }
      store.insert({ username: argv.username, password: argv.password });
      if (argv.email !== undefined) store.setEmail(argv.username, argv.email);
      if (argv.discord !== undefined) store.setDiscord(argv.username, argv.discord);
      console.log(`Added user "${argv.username}".`);
    }
  )
  .command(
    'update-user <username>',
    'Update one or more fields on an existing user',
    (y) =>
      y
        .positional('username', { type: 'string', demandOption: true })
        .option('password', { type: 'string', describe: 'New password' })
        .option('email', { type: 'string', describe: "New email address (empty string clears it)" })
        .option('discord', { type: 'string', describe: "New Discord user ID (empty string clears it)" }),
    (argv) => {
      const store = resolveDb(argv.db);
      if (!store.exists(argv.username)) {
        console.error(`No such user "${argv.username}".`);
        process.exitCode = 1;
        return;
      }

      const updated: string[] = [];
      if (argv.password !== undefined) {
        store.setPassword(argv.username, argv.password);
        updated.push('password');
      }
      if (argv.email !== undefined) {
        store.setEmail(argv.username, argv.email);
        updated.push('email');
      }
      if (argv.discord !== undefined) {
        store.setDiscord(argv.username, argv.discord);
        updated.push('discord');
      }

      if (updated.length === 0) {
        console.error('Specify at least one of --password, --email, --discord.');
        process.exitCode = 1;
        return;
      }

      console.log(`Updated ${updated.join(', ')} for user "${argv.username}".`);
    }
  )
  .command(
    'list-users',
    'List all users',
    (y) => y,
    (argv) => {
      const store = resolveDb(argv.db);
      const users = store.findAll();
      if (users.length === 0) {
        console.log('No users found.');
      } else {
        users.forEach((u) => console.log(`${u.id}\t${u.username}\t${u.email ?? ''}\t${u.discord ?? ''}`));
      }
    }
  )
  .parse();
