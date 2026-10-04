import type { Product } from "@organic/shared";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ProductCard } from "./ProductCard";

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

test("Card shows the image, unit, price and a link named after the product", () => {
  render(
    <ul>
      <ProductCard product={fileIndychky} />
    </ul>,
  );

  expect(screen.getByRole("img", { name: "Філе індички, 1 кг" })).toHaveAttribute(
    "src",
    "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg",
  );
  expect(screen.getByText("665 ₴")).toBeInTheDocument();
  expect(screen.getByText("1 кг")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "У магазині: Філе індички, 1 кг" })).toHaveAttribute(
    "href",
    "https://karashynyard.com.ua/#rec638772397",
  );
});
