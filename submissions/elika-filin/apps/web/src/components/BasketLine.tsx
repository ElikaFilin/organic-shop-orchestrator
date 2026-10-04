import type { BasketLine as BasketLineModel, BasketResponse } from "@organic/shared";
import { useState } from "react";
import { removeBasketItem, updateBasketItem } from "../api/client";
import { useBasket } from "../basket/BasketContext";
import { formatPrice } from "./ProductCard";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

interface BasketLineProps {
  line: BasketLineModel;
  /** The page owns the one "Не вдалося оновити кошик" message; a line only reports how its call ended. */
  onMutationFailed: (failed: boolean) => void;
}

/** One line of the basket. A product the catalog no longer serves keeps its controls, loses its details. */
export function BasketLine({ line, onMutationFailed }: BasketLineProps) {
  const { setBasket } = useBasket();
  // Local text, so the buyer can clear the field before typing; only a valid number is sent.
  const [quantity, setQuantity] = useState(String(line.quantity));
  // The row survives an update (its key is the productId), so a server-confirmed quantity is adopted here
  // instead of by a remount — which would take the focus out of the input.
  const [confirmed, setConfirmed] = useState(line.quantity);
  if (confirmed !== line.quantity) {
    setConfirmed(line.quantity);
    setQuantity(String(line.quantity));
  }

  /** A rejected mutation leaves the last known basket on screen and says so. */
  function settle(call: Promise<BasketResponse>) {
    return call.then(
      (basket) => {
        setBasket(basket);
        onMutationFailed(false);
      },
      () => onMutationFailed(true),
    );
  }

  async function change(value: string) {
    setQuantity(value);
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < MIN_QUANTITY || parsed > MAX_QUANTITY) return;
    await settle(updateBasketItem(line.productId, parsed));
  }

  async function remove() {
    await settle(removeBasketItem(line.productId));
  }

  return (
    <li className="flex items-center gap-4 border-b border-stone-200 py-3">
      {line.product ? (
        <>
          <img src={line.product.imageUrl} alt={line.product.name} className="size-16 rounded-md object-cover" />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-900">{line.product.name}</p>
            <p className="text-xs text-stone-500">{line.product.unit}</p>
            <p className="text-sm text-stone-700">{formatPrice(line.product.price)}</p>
          </div>
        </>
      ) : (
        <span className="flex-1 text-sm text-stone-500">Товар недоступний</span>
      )}
      <input
        type="number"
        aria-label="Кількість"
        min={MIN_QUANTITY}
        max={MAX_QUANTITY}
        value={quantity}
        onChange={(event) => void change(event.target.value)}
        className="w-16 rounded-md border border-stone-300 px-2 py-1 text-sm text-stone-900"
      />
      {line.product && (
        <p className="w-24 text-right text-sm font-semibold text-stone-900">
          {formatPrice(line.product.price * line.quantity)}
        </p>
      )}
      <button type="button" onClick={() => void remove()} className="text-sm text-red-700 underline">
        Видалити
      </button>
    </li>
  );
}
