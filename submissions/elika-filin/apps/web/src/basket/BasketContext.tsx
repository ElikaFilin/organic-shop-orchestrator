import type { BasketResponse } from "@organic/shared";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getBasket } from "../api/client";

/** One basket object for the whole app: the header and /basket render the same state. */
type BasketState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; basket: BasketResponse };

interface BasketContextValue {
  state: BasketState;
  /** Every mutation answers the whole basket, so the receiver stores it instead of refetching. */
  setBasket: (basket: BasketResponse) => void;
  count: number;
}

// The default keeps a card rendered outside the layout (an isolated component test) harmless:
// it reads an empty basket and its "add" goes nowhere, instead of throwing during render.
const BasketContext = createContext<BasketContextValue>({
  state: { status: "loading" },
  setBasket: () => {},
  count: 0,
});

export function BasketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BasketState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getBasket()
      .then((basket) => {
        if (active) setState({ status: "ready", basket });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    // Mount only: nothing in the app changes the basket behind the provider's back.
    return () => {
      active = false;
    };
  }, []);

  const value: BasketContextValue = {
    state,
    setBasket: (basket) => setState({ status: "ready", basket }),
    // A basket that is still loading or failed shows zero rather than an empty header.
    count: state.status === "ready" ? state.basket.totals.count : 0,
  };
  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  return useContext(BasketContext);
}
