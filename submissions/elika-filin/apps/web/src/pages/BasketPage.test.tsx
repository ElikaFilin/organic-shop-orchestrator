import type { BasketResponse, Product } from "@organic/shared";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { clearBasket, getBasket, removeBasketItem, updateBasketItem } from "../api/client";
import { routes } from "../router";

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

const BASKET_A = "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc";
const BASKET_B = "6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f";

const fileIndychkyLine = { productId: "karashynyard:1498486363994", quantity: 2, product: fileIndychky };
const kolrabiLine = { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: kolrabi };

// The "two-line basket": 2 × Філе індички at 665 and 1 × кольрабі at 195.
const twoLineBasket: BasketResponse = {
  id: BASKET_A,
  items: [fileIndychkyLine, kolrabiLine],
  totals: { count: 3, sum: 1525 },
};

const emptyBasket: BasketResponse = { id: BASKET_A, items: [], totals: { count: 0, sum: 0 } };

function renderBasketRoute() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/basket"] })} />);
}

/** The basket list's items, re-read after every mutation because the lines re-render. */
async function findLines(): Promise<HTMLElement[]> {
  return within(await screen.findByRole("list")).getAllByRole("listitem");
}

function line(items: HTMLElement[], index: number): HTMLElement {
  const item = items[index];
  if (!item) throw new Error(`no basket line ${index}`);
  return item;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("BasketPage", () => {
  test("Two lines with totals", async () => {
    vi.mocked(getBasket).mockResolvedValue(twoLineBasket);

    renderBasketRoute();

    const items = await findLines();
    expect(screen.getByRole("heading", { level: 2, name: "Кошик" })).toBeInTheDocument();
    expect(items).toHaveLength(2);

    const first = line(items, 0);
    expect(within(first).getByRole("img", { name: "Філе індички, 1 кг" })).toHaveAttribute(
      "src",
      "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg",
    );
    expect(within(first).getByText("Філе індички, 1 кг")).toBeInTheDocument();
    expect(within(first).getByText("1 кг")).toBeInTheDocument();
    expect(within(first).getByText("665 ₴")).toBeInTheDocument();
    expect(within(first).getByText("1330 ₴")).toBeInTheDocument();
    const firstQuantity = within(first).getByRole("spinbutton", { name: "Кількість" });
    expect(firstQuantity).toHaveValue(2);
    expect(firstQuantity).toHaveAttribute("min", "1");
    expect(firstQuantity).toHaveAttribute("max", "99");
    expect(within(first).getByRole("button", { name: "Видалити" })).toBeInTheDocument();

    const second = line(items, 1);
    expect(within(second).getByRole("img", { name: "Капуста кольрабі, органічна осіння" })).toBeInTheDocument();
    expect(within(second).getByText("Капуста кольрабі, органічна осіння")).toBeInTheDocument();
    expect(within(second).getByText("Качан 350-450 г")).toBeInTheDocument();
    // Unit price and line sum are the same string at quantity 1: formatPrice(195) twice.
    expect(within(second).getAllByText("195 ₴")).toHaveLength(2);
    expect(within(second).getByRole("spinbutton", { name: "Кількість" })).toHaveValue(1);
    expect(within(second).getByRole("button", { name: "Видалити" })).toBeInTheDocument();

    expect(screen.getByText("Разом: 1525 ₴")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Очистити кошик" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Кошик (3)" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("Empty basket", async () => {
    vi.mocked(getBasket).mockResolvedValue(emptyBasket);

    renderBasketRoute();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Кошик порожній"));
    expect(screen.getByRole("heading", { level: 2, name: "Кошик" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "До каталогу" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button", { name: "Очистити кошик" })).toBeNull();
    expect(screen.queryByText(/^Разом:/)).toBeNull();
    expect(screen.getByRole("link", { name: "Кошик (0)" })).toBeInTheDocument();
  });

  test("Changing the quantity updates the line", async () => {
    vi.mocked(getBasket).mockResolvedValue(twoLineBasket);
    vi.mocked(updateBasketItem).mockResolvedValue({
      ...twoLineBasket,
      items: [{ ...fileIndychkyLine, quantity: 3 }, kolrabiLine],
      totals: { count: 4, sum: 2190 },
    });
    renderBasketRoute();
    const before = await findLines();

    fireEvent.change(within(line(before, 0)).getByRole("spinbutton", { name: "Кількість" }), {
      target: { value: "3" },
    });

    expect(await screen.findByText("Разом: 2190 ₴")).toBeInTheDocument();
    expect(updateBasketItem).toHaveBeenCalledTimes(1);
    expect(updateBasketItem).toHaveBeenCalledWith("karashynyard:1498486363994", 3);
    expect(within(line(await findLines(), 0)).getByText("1995 ₴")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Кошик (4)" })).toBeInTheDocument();
  });

  test("Removing a line", async () => {
    vi.mocked(getBasket).mockResolvedValue(twoLineBasket);
    vi.mocked(removeBasketItem).mockResolvedValue({
      id: BASKET_A,
      items: [kolrabiLine],
      totals: { count: 1, sum: 195 },
    });
    renderBasketRoute();
    const before = await findLines();

    fireEvent.click(within(line(before, 0)).getByRole("button", { name: "Видалити" }));

    expect(await screen.findByText("Разом: 195 ₴")).toBeInTheDocument();
    expect(removeBasketItem).toHaveBeenCalledTimes(1);
    expect(removeBasketItem).toHaveBeenCalledWith("karashynyard:1498486363994");
    const after = await findLines();
    expect(after).toHaveLength(1);
    const only = line(after, 0);
    expect(within(only).getByText("Капуста кольрабі, органічна осіння")).toBeInTheDocument();
    expect(within(only).getAllByText("195 ₴")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Кошик (1)" })).toBeInTheDocument();
  });

  test("Quantity input keeps focus across an update", async () => {
    const oneLine: BasketResponse = {
      id: BASKET_A,
      items: [{ ...fileIndychkyLine, quantity: 1 }],
      totals: { count: 1, sum: 665 },
    };
    vi.mocked(getBasket).mockResolvedValue(oneLine);
    vi.mocked(updateBasketItem).mockResolvedValue({
      ...oneLine,
      items: [{ ...fileIndychkyLine, quantity: 2 }],
      totals: { count: 2, sum: 1330 },
    });
    renderBasketRoute();
    const input = within(line(await findLines(), 0)).getByRole("spinbutton", { name: "Кількість" });
    input.focus();
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "2" } });

    expect(await screen.findByText("Разом: 1330 ₴")).toBeInTheDocument();
    const after = within(line(await findLines(), 0)).getByRole("spinbutton", { name: "Кількість" });
    // Same row, same element: the line's identity is its productId, not its quantity.
    expect(after).toBe(input);
    expect(after).toHaveValue(2);
    expect(after).toHaveFocus();
  });

  test("Clearing the basket", async () => {
    vi.mocked(getBasket).mockResolvedValue(twoLineBasket);
    vi.mocked(clearBasket).mockResolvedValue(emptyBasket);
    renderBasketRoute();
    await findLines();

    fireEvent.click(screen.getByRole("button", { name: "Очистити кошик" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Кошик порожній"));
    expect(clearBasket).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "До каталогу" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("link", { name: "Кошик (0)" })).toBeInTheDocument();
  });

  test("Removing a line fails", async () => {
    vi.mocked(getBasket).mockResolvedValue(twoLineBasket);
    vi.mocked(removeBasketItem).mockRejectedValue(
      new Error("DELETE /api/basket/items/karashynyard:1498486363994 failed: 500"),
    );
    renderBasketRoute();
    const before = await findLines();

    fireEvent.click(within(line(before, 0)).getByRole("button", { name: "Видалити" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Не вдалося оновити кошик");
    expect(await findLines()).toHaveLength(2);
    expect(screen.getByText("Разом: 1525 ₴")).toBeInTheDocument();
  });

  test("Line without a product", async () => {
    vi.mocked(getBasket).mockResolvedValue({
      id: BASKET_B,
      items: [fileIndychkyLine, { productId: "osio:000000000000000000000000", quantity: 1, product: null }],
      totals: { count: 2, sum: 1330 },
    });

    renderBasketRoute();

    const items = await findLines();
    expect(items).toHaveLength(2);
    const second = line(items, 1);
    expect(within(second).getByText("Товар недоступний")).toBeInTheDocument();
    expect(within(second).getByRole("button", { name: "Видалити" })).toBeInTheDocument();
    expect(within(second).queryByRole("img")).toBeNull();
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("alt", "Філе індички, 1 кг");
    expect(screen.getByText("Разом: 1330 ₴")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Кошик (2)" })).toBeInTheDocument();
  });
});

/** Lets a mutation's rejection reach the component before the page is inspected. */
function settleMutation() {
  return act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

// Design assumptions D8 and D9 — no spec scenario pins these states, so they are tested here on their own.
describe("BasketPage outside the ready state", () => {
  test("Loading state while the basket is fetched", async () => {
    let deliverBasket: (basket: BasketResponse) => void = () => {};
    vi.mocked(getBasket).mockReturnValue(
      new Promise<BasketResponse>((resolve) => {
        deliverBasket = resolve;
      }),
    );

    renderBasketRoute();

    expect(screen.getByRole("heading", { level: 2, name: "Кошик" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Завантажуємо кошик…");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(/^Разом:/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Очистити кошик" })).toBeNull();
    expect(screen.getByRole("link", { name: "Кошик (0)" })).toBeInTheDocument();

    deliverBasket(twoLineBasket);

    expect(await findLines()).toHaveLength(2);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Разом: 1525 ₴")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Кошик (3)" })).toBeInTheDocument();
  });

  test("Error state when the basket cannot be loaded", async () => {
    vi.mocked(getBasket).mockRejectedValue(new Error("GET /api/basket failed: 503"));

    renderBasketRoute();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Не вдалося завантажити кошик"));
    expect(screen.getByRole("heading", { level: 2, name: "Кошик" })).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(/^Разом:/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Очистити кошик" })).toBeNull();
    expect(screen.getByRole("link", { name: "Кошик (0)" })).toBeInTheDocument();
  });

  test("A rejected mutation leaves the last known basket on screen", async () => {
    vi.mocked(getBasket).mockResolvedValue(twoLineBasket);
    vi.mocked(updateBasketItem).mockRejectedValue(
      new Error("PATCH /api/basket/items/karashynyard:1498486363994 failed: 400"),
    );
    vi.mocked(removeBasketItem).mockRejectedValue(
      new Error("DELETE /api/basket/items/karashynyard:1498486363994 failed: 404"),
    );
    renderBasketRoute();
    const before = await findLines();

    fireEvent.change(within(line(before, 0)).getByRole("spinbutton", { name: "Кількість" }), {
      target: { value: "3" },
    });
    await settleMutation();
    expect(updateBasketItem).toHaveBeenCalledTimes(1);
    expect(updateBasketItem).toHaveBeenCalledWith("karashynyard:1498486363994", 3);

    fireEvent.click(within(line(await findLines(), 0)).getByRole("button", { name: "Видалити" }));
    await settleMutation();
    expect(removeBasketItem).toHaveBeenCalledTimes(1);
    expect(removeBasketItem).toHaveBeenCalledWith("karashynyard:1498486363994");

    const after = await findLines();
    expect(after).toHaveLength(2);
    expect(within(line(after, 0)).getByText("Філе індички, 1 кг")).toBeInTheDocument();
    expect(within(line(after, 0)).getByText("1330 ₴")).toBeInTheDocument();
    expect(within(line(after, 1)).getAllByText("195 ₴")).toHaveLength(2);
    expect(screen.getByText("Разом: 1525 ₴")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Кошик (3)" })).toBeInTheDocument();
  });
});
