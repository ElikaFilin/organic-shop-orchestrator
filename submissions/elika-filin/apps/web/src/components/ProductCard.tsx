import type { Product } from "@organic/shared";
import { useState } from "react";
import { addToBasket } from "../api/client";
import { useBasket } from "../basket/BasketContext";

/** UAH exactly as the shops publish it — no digit grouping, no rounding. */
export function formatPrice(price: number): string {
  return `${price} ₴`;
}

export function ProductCard({ product }: { product: Product }) {
  const { setBasket } = useBasket();
  // Per card, so one click never puts a status on its neighbours.
  const [state, setState] = useState<"idle" | "pending" | "added" | "failed">("idle");

  async function add() {
    setState("pending");
    try {
      setBasket(await addToBasket(product.id, 1));
      setState("added");
    } catch {
      setState("failed");
    }
  }

  return (
    <li className="flex flex-col rounded-lg border border-stone-200 bg-white p-3">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="mb-3 aspect-square w-full rounded-md object-cover"
      />
      <h3 className="text-sm font-medium text-stone-900">{product.name}</h3>
      <p className="mt-1 text-xs text-stone-500">{product.unit}</p>
      <p className="mt-2 text-base font-semibold text-stone-900">{formatPrice(product.price)}</p>
      <a
        href={product.productUrl}
        aria-label={`У магазині: ${product.name}`}
        className="mt-3 text-sm text-emerald-700 underline"
        target="_blank"
        rel="noreferrer"
      >
        У магазині
      </a>
      <button
        type="button"
        onClick={add}
        // Disabled while the call is in flight, so a double click adds once.
        disabled={state === "pending"}
        className="mt-3 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Додати в кошик
      </button>
      {/* No status element exists before a click, so the catalog's "no basket controls" tests still hold. */}
      {state === "added" && (
        <span role="status" className="mt-2 text-xs text-emerald-700">
          Додано
        </span>
      )}
      {state === "failed" && (
        <span role="status" className="mt-2 text-xs text-red-700">
          Не вдалося додати
        </span>
      )}
    </li>
  );
}
