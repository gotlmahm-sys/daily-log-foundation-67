import { useCallback, useEffect, useState } from "react";
import { getAudit, getEntries, getExitTypes, getPermits, getPersons, getUsers, subscribe } from "@/lib/store";
import type { AuditEvent, ExitType, LogEntry, Permit, Person, User } from "@/lib/types";

export function useStoreData() {
  const [users, setUsersState] = useState<User[]>([]);
  const [entries, setEntriesState] = useState<LogEntry[]>([]);
  const [audit, setAuditState] = useState<AuditEvent[]>([]);
  const [persons, setPersonsState] = useState<Person[]>([]);
  const [permits, setPermitsState] = useState<Permit[]>([]);
  const [exitTypes, setExitTypesState] = useState<ExitType[]>([]);

  const refresh = useCallback(() => {
    setUsersState(getUsers());
    setEntriesState(getEntries());
    setAuditState(getAudit());
    setPersonsState(getPersons());
    setPermitsState(getPermits());
    setExitTypesState(getExitTypes());
  }, []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  return { users, entries, audit, persons, permits, exitTypes, refresh };
}
