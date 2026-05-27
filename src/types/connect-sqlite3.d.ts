declare module 'connect-sqlite3' {
  import type session from 'express-session';

  interface SQLiteStoreOptions {
    db: string;
    dir?: string;
    table?: string;
    concurrentDb?: boolean;
  }

  interface SQLiteStore extends session.Store {
    db: any;
  }

  function connectSQLite3(
    session: typeof import('express-session')
  ): new (options: SQLiteStoreOptions) => SQLiteStore;

  export = connectSQLite3;
}
