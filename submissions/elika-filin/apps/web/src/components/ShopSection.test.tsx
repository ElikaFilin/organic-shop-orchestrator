import type { Product, ShopSummary } from "@organic/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ShopSection } from "./ShopSection";

// The first product of data/shops/karashynyard.json.
const fileIndychky: Product = {
  id: "karashynyard:1498486363994",
  shopKey: "karashynyard",
  shopName: "Карашин Яр",
  sourceId: "1498486363994",
  name: "Філе індички, 1 кг",
  price: 665,
  currency: "UAH",
  imageUrl: "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg",
  productUrl: "https://karashynyard.com.ua/#rec638772397",
  description: "Ніжне філе без кістки для котлет, запікання, тушкування та дитячих страв.",
  category: "Індичка з вільного вигулу",
  unit: "1 кг",
  inStock: true,
};

const shop: ShopSummary = {
  key: "karashynyard",
  name: "Карашин Яр",
  url: "https://karashynyard.com.ua/#rec638772397",
  status: "live",
  count: 1,
};

describe("ShopSection", () => {
  test.each([
    ["live" as const, 1],
    ["snapshot" as const, 1],
  ])("status %s shows the list and no note", (status, items) => {
    render(<ShopSection shop={{ ...shop, status }} products={[fileIndychky]} />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(items);
  });

  test("status snapshot-fallback shows the saved-copy note above the list", () => {
    render(
      <ShopSection
        shop={{ ...shop, status: "snapshot-fallback", error: "karashynyard: HTTP 503" }}
        products={[fileIndychky]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Показано збережену копію");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  test("status unavailable shows the unavailable note and no list", () => {
    render(
      <ShopSection
        shop={{ ...shop, status: "unavailable", error: "karashynyard: HTTP 503", count: 0 }}
        products={[]}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Магазин тимчасово недоступний");
    expect(screen.queryByRole("list")).toBeNull();
  });
});
