import { useState } from "react";
import { Link } from "react-router";
import { clearBasket } from "../api/client";
import { useBasket } from "../basket/BasketContext";
import { BasketLine } from "../components/BasketLine";
import { formatPrice } from "../components/ProductCard";

/** The basket in full: loading, failed, empty, or the lines with their total. */
export function BasketPage() {
  const { state, setBasket } = useBasket();
  // One message for the whole page: a failed mutation must be visible, not just silently ignored.
  const [failed, setFailed] = useState(false);

  async function clear() {
    await clearBasket().then(
      (basket) => {
        setBasket(basket);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold">Кошик</h2>
      {state.status === "loading" && <p role="status">Завантажуємо кошик…</p>}
      {state.status === "error" && <p role="status">Не вдалося завантажити кошик</p>}
      {state.status === "ready" && state.basket.items.length === 0 && (
        <>
          <p role="status">Кошик порожній</p>
          <Link to="/" className="text-sm text-emerald-700 underline">
            До каталогу
          </Link>
        </>
      )}
      {state.status === "ready" && state.basket.items.length > 0 && (
        <>
          <ul className="mt-4">
            {state.basket.items.map((line) => (
              // The key is the productId alone: a confirmed update re-renders the row in place, so the
              // quantity input keeps focus.
              <BasketLine key={line.productId} line={line} onMutationFailed={setFailed} />
            ))}
          </ul>
          {failed && (
            <p role="status" className="mt-3 text-sm text-red-700">
              Не вдалося оновити кошик
            </p>
          )}
          <p className="mt-4 text-lg font-semibold">Разом: {formatPrice(state.basket.totals.sum)}</p>
          <button
            type="button"
            onClick={() => void clear()}
            className="mt-3 rounded-md border border-stone-300 px-3 py-2 text-sm"
          >
            Очистити кошик
          </button>
        </>
      )}
    </section>
  );
}
