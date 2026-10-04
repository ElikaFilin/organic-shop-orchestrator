import type { BasketLine as BasketLineModel, BasketResponse, Product } from "@organic/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { removeBasketItem, updateBasketItem } from "../api/client";
import { BasketLine } from "./BasketLine";

vi.mock("../api/client", () => ({
  getProducts: vi.fn(),
  getBasket: vi.fn(),
  addToBasket: vi.fn(),
  updateBasketItem: vi.fn(),
  removeBasketItem: vi.fn(),
  clearBasket: vi.fn(),
}));

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

const line: BasketLineModel = { productId: fileIndychky.id, quantity: 2, product: fileIndychky };

const basketAfterChange: BasketResponse = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [{ ...line, quantity: 3 }],
  totals: { count: 3, sum: 1995 },
};

function renderLine(model: BasketLineModel = line) {
  const onMutationFailed = vi.fn();
  render(
    <ul>
      <BasketLine line={model} onMutationFailed={onMutationFailed} />
    </ul>,
  );
  return { onMutationFailed };
}

beforeEach(() => {
  vi.resetAllMocks();
});

test("Shows the product, its unit price and the line sum", () => {
  renderLine();

  expect(screen.getByRole("img", { name: "Філе індички, 1 кг" })).toHaveAttribute("src", fileIndychky.imageUrl);
  expect(screen.getByText("Філе індички, 1 кг")).toBeInTheDocument();
  expect(screen.getByText("1 кг")).toBeInTheDocument();
  expect(screen.getByText("665 ₴")).toBeInTheDocument();
  expect(screen.getByText("1330 ₴")).toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "Кількість" })).toHaveValue(2);
});

test("A product the catalog no longer serves keeps its controls", () => {
  renderLine({ productId: "osio:000000000000000000000000", quantity: 1, product: null });

  expect(screen.getByText("Товар недоступний")).toBeInTheDocument();
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByRole("spinbutton", { name: "Кількість" })).toHaveValue(1);
  expect(screen.getByRole("button", { name: "Видалити" })).toBeInTheDocument();
});

test("Changing the quantity calls updateBasketItem", async () => {
  vi.mocked(updateBasketItem).mockResolvedValue(basketAfterChange);
  const { onMutationFailed } = renderLine();

  fireEvent.change(screen.getByRole("spinbutton", { name: "Кількість" }), { target: { value: "3" } });

  await waitFor(() => expect(updateBasketItem).toHaveBeenCalledWith("karashynyard:1498486363994", 3));
  await waitFor(() => expect(onMutationFailed).toHaveBeenCalledWith(false));
});

test("A quantity outside 1..99 is not sent", () => {
  renderLine();

  fireEvent.change(screen.getByRole("spinbutton", { name: "Кількість" }), { target: { value: "" } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Кількість" }), { target: { value: "100" } });

  expect(updateBasketItem).not.toHaveBeenCalled();
});

test("Видалити calls removeBasketItem, and a rejection is reported", async () => {
  vi.mocked(removeBasketItem).mockRejectedValue(new Error("DELETE /api/basket/items/karashynyard:1498486363994 failed: 500"));
  const { onMutationFailed } = renderLine();

  fireEvent.click(screen.getByRole("button", { name: "Видалити" }));

  await waitFor(() => expect(removeBasketItem).toHaveBeenCalledWith("karashynyard:1498486363994"));
  await waitFor(() => expect(onMutationFailed).toHaveBeenCalledWith(true));
});
