import type { BasketResponse, CatalogResponse, Product } from "@organic/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { addToBasket, getBasket, getProducts } from "../api/client";
import { routes } from "../router";
import { ProductCard } from "./ProductCard";

vi.mock("../api/client", () => ({
  getProducts: vi.fn(),
  getBasket: vi.fn(),
  addToBasket: vi.fn(),
  updateBasketItem: vi.fn(),
  removeBasketItem: vi.fn(),
  clearBasket: vi.fn(),
}));

// Full objects as in data/shops/*.json.
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
const kareTeliatyny: Product = {
  id: "karashynyard:1651059869009",
  shopKey: "karashynyard",
  shopName: "Карашин Яр",
  sourceId: "1651059869009",
  name: "Каре молочної телятини, 1 кг",
  price: 1410,
  currency: "UAH",
  imageUrl: "https://static.tildacdn.net/tild3839-3761-4639-a262-303261303632/___84.jpg",
  productUrl: "https://karashynyard.com.ua/#rec638780644",
  description: "Ніжне рожеве каре молочної телятини на кістці для стейків, гриля та запікання.",
  category: "Молочна телятина та фермерська яловичина",
  unit: "1 кг",
  inStock: true,
};
const kolrabi: Product = {
  id: "osio:6abcf192b7db2532803d266d",
  shopKey: "osio",
  shopName: "OSIO organic",
  sourceId: "6abcf192b7db2532803d266d",
  name: "Капуста кольрабі, органічна осіння",
  price: 195,
  currency: "UAH",
  imageUrl: "https://fra1.digitaloceanspaces.com/arsubs-1/6abcf18f504a4d6030570003",
  productUrl: "https://osio-organic.com.ua/products/6abcf192b7db2532803d266d",
  description:
    "🥬 Кольрабі — соковита, хрустка капуста з ніжним солодкуватим смаком. Ось чим вона корисна: • Вітамін С підтримує імунну систему, потрібен для утворення колагену та допомагає засвоювати залізо з рослинної їжі. • Клітковина сприяє регулярному випорожненню, підтримує кишкову мікрофлору й допомагає…",
  category: "Овочі",
  unit: "Качан 350-450 г",
  inStock: true,
};

// The "Two shops with products" response of add-catalog.
const twoShopsResponse: CatalogResponse = {
  source: "live",
  shops: [
    { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397", status: "live", count: 2 },
    { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/", status: "live", count: 1 },
  ],
  products: [fileIndychky, kareTeliatyny, kolrabi],
};

const emptyBasket: BasketResponse = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [],
  totals: { count: 0, sum: 0 },
};

const oneLineBasket: BasketResponse = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [{ productId: "karashynyard:1498486363994", quantity: 1, product: fileIndychky }],
  totals: { count: 1, sum: 665 },
};

beforeEach(() => {
  vi.resetAllMocks();
});

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

test("Add from the catalog card", async () => {
  vi.mocked(getProducts).mockResolvedValue(twoShopsResponse);
  vi.mocked(getBasket).mockResolvedValue(emptyBasket);
  vi.mocked(addToBasket).mockResolvedValue(oneLineBasket);
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);

  expect(await screen.findAllByRole("button", { name: "Додати в кошик" })).toHaveLength(3);
  expect(await screen.findByRole("link", { name: "Кошик (0)" })).toHaveAttribute("href", "/basket");
  expect(screen.queryByRole("status")).toBeNull();
  const [firstCard, secondCard, thirdCard] = screen.getAllByRole("listitem");
  if (!firstCard || !secondCard || !thirdCard) throw new Error("expected three product cards");

  fireEvent.click(within(firstCard).getByRole("button", { name: "Додати в кошик" }));

  expect(await within(firstCard).findByRole("status")).toHaveTextContent("Додано");
  expect(within(secondCard).queryByRole("status")).toBeNull();
  expect(within(thirdCard).queryByRole("status")).toBeNull();
  expect(addToBasket).toHaveBeenCalledTimes(1);
  expect(addToBasket).toHaveBeenCalledWith("karashynyard:1498486363994", 1);
  expect(await screen.findByRole("link", { name: "Кошик (1)" })).toHaveAttribute("href", "/basket");
});

test("Double click adds once", async () => {
  vi.mocked(getProducts).mockResolvedValue(twoShopsResponse);
  vi.mocked(getBasket).mockResolvedValue(emptyBasket);
  let deliverBasket: (basket: BasketResponse) => void = () => {};
  vi.mocked(addToBasket).mockReturnValue(
    new Promise<BasketResponse>((resolve) => {
      deliverBasket = resolve;
    }),
  );
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
  const [firstCard] = await screen.findAllByRole("listitem");
  if (!firstCard) throw new Error("expected a product card");
  const button = within(firstCard).getByRole("button", { name: "Додати в кошик" });

  fireEvent.click(button);
  expect(button).toBeDisabled();
  fireEvent.click(button);

  expect(addToBasket).toHaveBeenCalledTimes(1);
  deliverBasket(oneLineBasket);
  expect(await within(firstCard).findByRole("status")).toHaveTextContent("Додано");
});

test("Add fails", async () => {
  vi.mocked(getProducts).mockResolvedValue(twoShopsResponse);
  vi.mocked(getBasket).mockResolvedValue(emptyBasket);
  vi.mocked(addToBasket).mockRejectedValue(new Error("POST /api/basket/items failed: 500"));
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);

  expect(await screen.findAllByRole("button", { name: "Додати в кошик" })).toHaveLength(3);
  expect(await screen.findByRole("link", { name: "Кошик (0)" })).toHaveAttribute("href", "/basket");
  const [firstCard, secondCard, thirdCard] = screen.getAllByRole("listitem");
  if (!firstCard || !secondCard || !thirdCard) throw new Error("expected three product cards");

  fireEvent.click(within(firstCard).getByRole("button", { name: "Додати в кошик" }));

  expect(await within(firstCard).findByRole("status")).toHaveTextContent("Не вдалося додати");
  expect(within(secondCard).queryByRole("status")).toBeNull();
  expect(within(thirdCard).queryByRole("status")).toBeNull();
  expect(addToBasket).toHaveBeenCalledTimes(1);
  expect(addToBasket).toHaveBeenCalledWith("karashynyard:1498486363994", 1);
  // Enabled again, so the buyer can retry; the header keeps the last known count.
  expect(within(firstCard).getByRole("button", { name: "Додати в кошик" })).toBeEnabled();
  expect(screen.getByRole("link", { name: "Кошик (0)" })).toHaveAttribute("href", "/basket");
});
