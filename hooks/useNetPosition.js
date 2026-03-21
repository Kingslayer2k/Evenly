"use client";

import { useMemo } from "react";
import usePersonBalances from "./usePersonBalances";

export default function useNetPosition(user) {
  const personState = usePersonBalances(user);

  const netPosition = useMemo(() => {
    return (personState.people || []).reduce((sum, person) => sum + Number(person.balance || 0), 0);
  }, [personState.people]);

  return {
    ...personState,
    netPosition,
    peopleCount: personState.people.length,
  };
}
