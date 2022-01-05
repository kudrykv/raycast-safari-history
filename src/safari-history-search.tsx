import {
  ActionPanel,
  CopyToClipboardAction,
  ImageMask,
  List,
  OpenInBrowserAction,
  showToast,
  ToastStyle
} from "@raycast/api";
import { useState } from "react";
import { HistoryEntry, useHistorySearch } from "./useHistorySearch";
import { URL } from "url";

const Command = () => {
  const [query, setQuery] = useState<string>("");
  const { entries, error, isLoading } = useHistorySearch(query);

  if (error) {
    showToast(ToastStyle.Failure, error.message);
  }

  const myList = Object.entries(entries.reduce((acc, val) => {
    const date = val.date.toLocaleDateString();

    (acc[date] = acc[date] || []).push(val);

    return acc;
  }, {} as Record<string, HistoryEntry[]>))
    .sort((a, b) => a[1][0].date.getTime() - b[1][0].date.getTime() ).reverse()
    .map(([date, entries]) => <List.Section
      key={date}
      title={date === new Date().toLocaleDateString() ? 'today' : date}
    >
      {entries.map(entry =>
        <List.Item
          key={entry.id}
          title={entry.title || entry.url}
          subtitle={entry.title ? entry.url : undefined}
          icon={{ source: new URL(entry.url).origin + "/favicon.ico", mask: ImageMask.Circle }}
          actions={
            <ActionPanel>
              <OpenInBrowserAction url={entry.url} />
              <CopyToClipboardAction content={entry.url} />
            </ActionPanel>
          }
        />
      )}
    </List.Section>);

  return <List isLoading={isLoading} onSearchTextChange={setQuery} throttle>
    {myList}
  </List>;
};

// noinspection JSUnusedGlobalSymbols
export default Command;
