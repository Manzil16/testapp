import { useCallback, useState } from "react";

export function useRefresh(refresher?: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!refresher) {
      return;
    }

    setRefreshing(true);
    try {
      await refresher();
    } finally {
      setRefreshing(false);
    }
  }, [refresher]);

  return {
    refreshing,
    onRefresh: refresh,
    refresh,
  };
}
