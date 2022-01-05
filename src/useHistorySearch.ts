import { useEffect, useRef, useState } from "react";
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

export const useHistorySearch = (search: string) => {
  console.debug("useHistorySearch");

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(true);
  const dbRef = useRef<Database>();

  let cancel = false;

  useEffect(() => {
    if (cancel) {
      console.debug("canceled");

      return;
    }

    setError(undefined);

    Promise.resolve()
      .then(() => dbRef.current || loadDb())
      .then(db => {
        dbRef.current = db;
        console.debug("upserted ref to db");

        const { query, params } = prepareQuery(search);

        const res = db.exec(query, params);
        console.debug("queried the db");

        return res[0] ? res[0].values.map(item => ({
          id: item[0],
          url: item[1],
          title: item[2],
          date: new Date((item[3] as number + 978307200) * 1000)
        } as HistoryEntry)) : [];
      })
      .then(setEntries)
      .catch(e => {
        setError(e);
      })
      .finally(() => setIsLoading(false));

    return () => {
      cancel = true;
      console.debug("set cancel");
    };
  }, [search]);

  useEffect(() => {
    return () => {
      dbRef.current?.close();
      console.debug("closed db");
    };
  }, []);

  return { entries, error, isLoading };
};


const loadDb = (): Promise<Database> => {
  console.debug("loadDb");

  // noinspection JSUnusedGlobalSymbols
  return initSqlJs({ locateFile: () => join(environment.assetsPath, "sql-wasm.wasm") })
    .then(SQL => new SQL.Database(readFileSync(historyDbPath())));
};


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


const queryPrefix = `select
  history_items.id, url, title, visit_time
from history_items
inner join history_visits
  on history_visits.history_item = history_items.id`;


const querySuffix = `group by url
order by visit_time desc
limit 40`;


const plainQuery = `${queryPrefix} ${querySuffix}`;
