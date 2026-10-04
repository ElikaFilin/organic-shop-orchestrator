import type { CatalogResponse } from "@organic/shared";
import { render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBasket, getProducts } from "../api/client";
import { routes } from "../router";

vi.mock("../api/client", () => ({
  getProducts: vi.fn(),
  getBasket: vi.fn(),
  addToBasket: vi.fn(),
  updateBasketItem: vi.fn(),
  removeBasketItem: vi.fn(),
  clearBasket: vi.fn(),
}));
const getProductsMock = vi.mocked(getProducts);

type ShopSummary = CatalogResponse["shops"][number];
type Product = CatalogResponse["products"][number];

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

const karashynyardLive: ShopSummary = {
  key: "karashynyard",
  name: "Карашин Яр",
  url: "https://karashynyard.com.ua/#rec638772397",
  status: "live",
  count: 2,
};
const osioLive: ShopSummary = {
  key: "osio",
  name: "OSIO organic",
  url: "https://osio-organic.com.ua/",
  status: "live",
  count: 1,
};

function twoShopsResponse(overrides: Partial<CatalogResponse> = {}): CatalogResponse {
  return {
    source: "live",
    shops: [karashynyardLive, osioLive],
    products: [fileIndychky, kareTeliatyny, kolrabi],
    ...overrides,
  };
}

function renderRoute() {
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

beforeEach(() => {
  getProductsMock.mockReset();
  // The layout loads the basket on mount; these tests only care about the catalog below it.
  vi.mocked(getBasket).mockReset().mockResolvedValue({
    id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
    items: [],
    totals: { count: 0, sum: 0 },
  });
});

describe("CatalogPage", () => {
  test("Two shops with products", async () => {
    getProductsMock.mockResolvedValue(twoShopsResponse());

    renderRoute();

    const karashynyardLink = await screen.findByRole("link", { name: "Карашин Яр" });
    expect(screen.getByRole("heading", { level: 1, name: "Organic Catalog" })).toBeInTheDocument();
    expect(karashynyardLink).toHaveAttribute("href", "https://karashynyard.com.ua/#rec638772397");
    expect(screen.getByRole("link", { name: "OSIO organic" })).toHaveAttribute("href", "https://osio-organic.com.ua/");

    const karashynyardSection = screen.getByRole("region", { name: "Карашин Яр" });
    const osioSection = screen.getByRole("region", { name: "OSIO organic" });
    expect(within(within(karashynyardSection).getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
    expect(within(within(osioSection).getByRole("list")).getAllByRole("listitem")).toHaveLength(1);

    expect(screen.getByRole("img", { name: "Філе індички, 1 кг" })).toHaveAttribute(
      "src",
      "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg",
    );
    expect(screen.getByText("665 ₴")).toBeInTheDocument();
    expect(screen.getByText("1410 ₴")).toBeInTheDocument();
    expect(screen.getByText("195 ₴")).toBeInTheDocument();
    expect(screen.getAllByText("1 кг")).toHaveLength(2);
    expect(screen.getByText("Качан 350-450 г")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "У магазині: Філе індички, 1 кг" })).toHaveAttribute(
      "href",
      "https://karashynyard.com.ua/#rec638772397",
    );
    expect(
      screen.getByRole("link", { name: "У магазині: Капуста кольрабі, органічна осіння" }),
    ).toHaveAttribute("href", "https://osio-organic.com.ua/products/6abcf192b7db2532803d266d");

    expect(screen.queryByRole("status")).toBeNull();
  });

  test("Loading state", async () => {
    getProductsMock.mockReturnValue(new Promise<CatalogResponse>(() => {}));

    renderRoute();

    expect(await screen.findByRole("status")).toHaveTextContent("Завантажуємо каталог…");
    expect(screen.queryByRole("list")).toBeNull();
  });

  test("Error state", async () => {
    getProductsMock.mockRejectedValue(new Error("GET /api/products failed: 503"));

    renderRoute();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Не вдалося завантажити каталог"),
    );
    expect(screen.queryByRole("list")).toBeNull();
  });

  test("Snapshot fallback note per shop", async () => {
    getProductsMock.mockResolvedValue(
      twoShopsResponse({
        shops: [{ ...karashynyardLive, status: "snapshot-fallback", error: "karashynyard: HTTP 503" }, osioLive],
      }),
    );

    renderRoute();

    const karashynyardSection = await screen.findByRole("region", { name: "Карашин Яр" });
    const osioSection = screen.getByRole("region", { name: "OSIO organic" });
    expect(within(karashynyardSection).getByRole("status")).toHaveTextContent("Показано збережену копію");
    expect(within(osioSection).queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  test("Unavailable shop", async () => {
    getProductsMock.mockResolvedValue(
      twoShopsResponse({
        shops: [
          { ...karashynyardLive, status: "unavailable", error: "karashynyard: HTTP 503", count: 0 },
          osioLive,
        ],
        products: [kolrabi],
      }),
    );

    renderRoute();

    const karashynyardSection = await screen.findByRole("region", { name: "Карашин Яр" });
    const osioSection = screen.getByRole("region", { name: "OSIO organic" });
    expect(within(karashynyardSection).getByRole("status")).toHaveTextContent("Магазин тимчасово недоступний");
    expect(within(karashynyardSection).queryByRole("list")).toBeNull();
    expect(within(within(osioSection).getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  });

  test("Shop with no products", async () => {
    getProductsMock.mockResolvedValue(
      twoShopsResponse({
        source: "snapshot",
        shops: [
          { ...karashynyardLive, status: "snapshot", count: 0 },
          { ...osioLive, status: "snapshot" },
        ],
        products: [kolrabi],
      }),
    );

    renderRoute();

    const karashynyardSection = await screen.findByRole("region", { name: "Карашин Яр" });
    expect(within(karashynyardSection).getByRole("status")).toHaveTextContent("Немає товарів");
    expect(within(karashynyardSection).queryByRole("list")).toBeNull();
  });

  test("Chosen snapshot mode shows no note", async () => {
    getProductsMock.mockResolvedValue(
      twoShopsResponse({
        source: "snapshot",
        shops: [
          { ...karashynyardLive, status: "snapshot" },
          { ...osioLive, status: "snapshot" },
        ],
      }),
    );

    renderRoute();

    const karashynyardSection = await screen.findByRole("region", { name: "Карашин Яр" });
    const osioSection = screen.getByRole("region", { name: "OSIO organic" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(within(within(karashynyardSection).getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
    expect(within(within(osioSection).getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  });
});
