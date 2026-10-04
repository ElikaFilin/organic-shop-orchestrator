import type { AdminProduct, AdminShopSummary, ShopStatus } from "@organic/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { AdminShopSection } from "./AdminShopSection";

// The three karashynyard products of the "four-product admin response" — full objects as in
// data/shops/karashynyard.json — with their visibility flags.
const fileIndychky: AdminProduct = {
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
  visible: true,
};
const kareTeliatyny: AdminProduct = {
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
  visible: true,
};
const hrechanyiChai: AdminProduct = {
  id: "karashynyard:1743423686258",
  shopKey: "karashynyard",
  shopName: "Карашин Яр",
  sourceId: "1743423686258",
  name: "Гречаний чай з жасмином 100 г (99 чашок)",
  price: 480,
  currency: "UAH",
  imageUrl: "https://static.tildacdn.net/tild3162-6539-4631-a163-616164333338/___-_2026-06-12T1958.jpg",
  productUrl: "https://karashynyard.com.ua/#rec877944979",
  description: "М’який гречаний чай із ніжним квітковим ароматом жасмину. Добре смакує теплим або охолодженим.",
  category: "Солодощі, какао та чай до фермерського кошика",
  unit: "100 г",
  inStock: true,
  visible: false,
};

const products: AdminProduct[] = [fileIndychky, kareTeliatyny, hrechanyiChai];

const shop: AdminShopSummary = {
  key: "karashynyard",
  name: "Карашин Яр",
  url: "https://karashynyard.com.ua/#rec638772397",
  status: "live",
  total: 3,
  visible: 2,
};

function renderSection(overrides: Partial<AdminShopSummary> = {}, list: AdminProduct[] = products) {
  const onToggle = vi.fn<(id: string, visible: boolean) => void>();
  render(<AdminShopSection shop={{ ...shop, ...overrides }} products={list} onToggle={onToggle} />);
  return { onToggle, region: screen.getByRole("region", { name: "Карашин Яр" }) };
}

const statusNotes: Array<{ status: ShopStatus; error?: string; note: string }> = [
  { status: "live", note: "наживо" },
  { status: "snapshot", note: "знімок" },
  { status: "snapshot-fallback", error: "karashynyard: HTTP 503", note: "збережена копія" },
  { status: "unavailable", note: "недоступний" },
];

test.each(statusNotes)("Status note per status ($status)", ({ status, error, note }) => {
  const { region } = renderSection(error === undefined ? { status } : { status, error });

  expect(within(region).getByText(note)).toBeInTheDocument();
  // A label, not a live region: "Збережено" stays the page's only role="status".
  expect(screen.queryByRole("status")).toBeNull();
});

test("Counts the ticked products and lists every product", () => {
  const { region } = renderSection();

  expect(within(region).getByRole("heading", { level: 3, name: "Карашин Яр" })).toBeInTheDocument();
  expect(within(region).getByText("Видимих: 2")).toBeInTheDocument();
  expect(within(region).getAllByRole("listitem")).toHaveLength(3);
  expect(within(region).getByRole("checkbox", { name: "Філе індички, 1 кг" })).toBeChecked();
  expect(within(region).getByRole("checkbox", { name: "Каре молочної телятини, 1 кг" })).toBeChecked();
  expect(within(region).getByRole("checkbox", { name: "Гречаний чай з жасмином 100 г (99 чашок)" })).not.toBeChecked();
});

test("No list when the shop has no products", () => {
  const { region } = renderSection({ status: "unavailable", total: 0, visible: 0 }, []);

  expect(within(region).getByText("Видимих: 0")).toBeInTheDocument();
  expect(within(region).queryByRole("list")).toBeNull();
});

test("Checkbox change calls back with id and checked", () => {
  const { onToggle } = renderSection();

  fireEvent.click(screen.getByRole("checkbox", { name: "Гречаний чай з жасмином 100 г (99 чашок)" }));
  expect(onToggle).toHaveBeenCalledWith("karashynyard:1743423686258", true);

  fireEvent.click(screen.getByRole("checkbox", { name: "Філе індички, 1 кг" }));
  expect(onToggle).toHaveBeenCalledWith("karashynyard:1498486363994", false);

  expect(onToggle).toHaveBeenCalledTimes(2);
});
