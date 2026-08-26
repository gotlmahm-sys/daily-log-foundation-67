import { useCallback, useEffect, useState } from "react";
import { getAudit, getEntries, getUsers, subscribe } from "@/lib/store";
import type { AuditEvent, LogEntry, User } from "@/lib/types";

export function useStoreData() {
  const [users, setUsersState] = useState<User[]>([]);
  const [entries, setEntriesState] = useState<LogEntry[]>([]);
  const [audit, setAuditState] = useState<AuditEvent[]>([]);

  const refresh = useCallback(() => {
    setUsersState(getUsers());
    setEntriesState(getEntries());
    setAuditState(getAudit());
  }, []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  return { users, entries, audit, refresh };
}
