import type { BasketResponse, CatalogResponse, Product } from "@organic/shared";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, expect, test, vi } from "vitest";
import { getBasket, getProducts } from "./api/client";
import { App } from "./App";
import { routes } from "./router";

vi.mock("./api/client", () => ({
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

// The "two-line basket" of basket-web: 2 × Філе індички at 665 and 1 × кольрабі at 195.
const twoLineBasket: BasketResponse = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [
    { productId: "karashynyard:1498486363994", quantity: 2, product: fileIndychky },
    { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: kolrabi },
  ],
  totals: { count: 3, sum: 1525 },
};

const emptyBasket: BasketResponse = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [],
  totals: { count: 0, sum: 0 },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProducts).mockResolvedValue(twoShopsResponse);
  vi.mocked(getBasket).mockResolvedValue(twoLineBasket);
});

test("renders the shop name as the page heading", () => {
  // App is the layout and renders an <Outlet />, so it needs a router around it; no child route here.
  const router = createMemoryRouter([{ path: "/", Component: App }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Organic Catalog");
});

test("Header link counts the lines on mount", async () => {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);

  expect(await screen.findByRole("link", { name: "Кошик (3)" })).toHaveAttribute("href", "/basket");
  expect(getBasket).toHaveBeenCalledTimes(1);
});

test("Header navigation on the catalog page", async () => {
  vi.mocked(getBasket).mockResolvedValue(emptyBasket);

  /** The three links, in order, with their targets — the same on every route. */
  async function expectNavigation() {
    const nav = await screen.findByRole("navigation");
    await within(nav).findByRole("link", { name: "Кошик (0)" });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAccessibleName("Каталог");
    expect(links[0]).toHaveAttribute("href", "/");
    expect(links[1]).toHaveAccessibleName("Кошик (0)");
    expect(links[1]).toHaveAttribute("href", "/basket");
    expect(links[2]).toHaveAccessibleName("Адмін");
    expect(links[2]).toHaveAttribute("href", "/admin");
  }

  const catalog = render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
  await expectNavigation();
  catalog.unmount();

  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/basket"] })} />);
  await expectNavigation();
});
