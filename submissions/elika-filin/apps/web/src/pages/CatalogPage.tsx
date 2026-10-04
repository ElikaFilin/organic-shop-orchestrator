import type { CatalogResponse } from "@organic/shared";
import { useEffect, useState } from "react";
import { getProducts } from "../api/client";
import { ShopSection } from "../components/ShopSection";

type CatalogState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; catalog: CatalogResponse };

export function CatalogPage() {
  const [state, setState] = useState<CatalogState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getProducts()
      .then((catalog) => {
        if (active) setState({ status: "ready", catalog });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <p role="status" className="mt-8 text-stone-600">
        Завантажуємо каталог…
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p role="status" className="mt-8 text-red-700">
        Не вдалося завантажити каталог
      </p>
    );
  }

  return (
    <>
      {state.catalog.shops.map((shop) => (
        <ShopSection
          key={shop.key}
          shop={shop}
          products={state.catalog.products.filter((product) => product.shopKey === shop.key)}
        />
      ))}
    </>
  );
}
