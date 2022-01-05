import { useEffect, useState } from "react";
import initSqlJs, { Database, SqlValue } from "sql.js";
import { join } from "path";
import { environment } from "@raycast/api";
import { readFileSync } from "fs";

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  date: Date;
}

export interface HistorySearch {
  isLoading: boolean;
  error: Error | undefined;
  entries: HistoryEntry[];
}

export const useHistorySearch = (search: string): HistorySearch => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(true);
  const unsetError = () => setError(undefined);

  useEffect(() => {
    let dbRef: Database | undefined;

    Promise.resolve()
      .then(unsetError)
      .then(loadDb)
      .then(db => dbRef = db)
      .then(performSearch(search))
      .then(setEntries)
      .catch(setError)
      .finally(() => setIsLoading(false))
      .finally(() => dbRef?.close())
  }, [search]);

  return { entries, error, isLoading };
};


// noinspection JSUnusedGlobalSymbols
const loadDb = (): Promise<Database> =>
  initSqlJs({ locateFile: () => join(environment.assetsPath, "sql-wasm.wasm") })
    .then(SQL => new SQL.Database(readFileSync(historyDbPath())));


const historyDbPath = () => join(userDataDirectoryPath(), "History.db");


const userDataDirectoryPath = () => {
  if (!process.env.HOME) {
    throw new Error("$HOME environment variable is not set.");
  }

  return join(process.env.HOME, "Library", "Safari");
};


const prepareQuery = (query: string) => {
  const terms = query.split(/\s+/).filter(value => value.length > 0).map(str => str.trim());
  if (terms.length === 0) {
    return { query: plainQuery, params: [] };
  }

  const { parts, params } = terms.reduce(({ parts, params }, val) => {
    parts.push("((title like ?) or (url like ?))");
    params.push(`%${val}%`, `%${val}%`);

    return { parts, params };
  }, { parts: [] as string[], params: [] as SqlValue[] });

  return {
    query: `${queryPrefix} where ${parts.join(" and ")} ${querySuffix}`,
    params
  };
};


const performSearch = (search: string) =>
  (db: Database) => {
    const { query, params } = prepareQuery(search);
    const res = db.exec(query, params);

    return res[0] ? res[0].values.map(mapSQLValueToHistoryEntry) : [];
  };


const mapSQLValueToHistoryEntry = (item: SqlValue[]): HistoryEntry =>
  ({
    id: item[0],
    url: item[1],
    title: item[2],
    date: new Date((item[3] as number + 978307200) * 1000)
  } as HistoryEntry);


const queryPrefix = `select
  history_items.id, url, title, visit_time
from history_items
inner join history_visits
  on history_visits.history_item = history_items.id`;


const querySuffix = `group by url
order by visit_time desc
limit 40`;


const plainQuery = `${queryPrefix} ${querySuffix}`;
