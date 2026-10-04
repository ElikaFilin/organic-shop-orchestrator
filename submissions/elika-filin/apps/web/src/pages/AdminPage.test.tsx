import type { AdminProductsResponse, AdminSession, AdminSettings, BasketResponse, Product } from "@organic/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  adminLogin,
  adminLogout,
  getAdminProducts,
  getAdminSession,
  getAdminSettings,
  getBasket,
  setProductVisibility,
  updateSettings,
} from "../api/client";
import { routes } from "../router";

vi.mock("../api/client", () => ({
  getProducts: vi.fn(),
  getBasket: vi.fn(),
  addToBasket: vi.fn(),
  updateBasketItem: vi.fn(),
  removeBasketItem: vi.fn(),
  clearBasket: vi.fn(),
  getAdminSession: vi.fn(),
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  getAdminSettings: vi.fn(),
  updateSettings: vi.fn(),
  getAdminProducts: vi.fn(),
  setProductVisibility: vi.fn(),
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
const hrechanyiChai: Product = {
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

const emptyBasket: BasketResponse = {
  id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc",
  items: [],
  totals: { count: 0, sum: 0 },
};

const liveSettings: AdminSettings = { dataSource: "live", visibility: { karashynyard: null, osio: null } };
const snapshotSettings: AdminSettings = { dataSource: "snapshot", visibility: { karashynyard: null, osio: null } };

const KARASHYNYARD = { key: "karashynyard", name: "Карашин Яр", url: "https://karashynyard.com.ua/#rec638772397" } as const;
const OSIO = { key: "osio", name: "OSIO organic", url: "https://osio-organic.com.ua/" } as const;

// The "four-product admin response": karashynyard live with two of three ticked, osio fallen back.
const fourProductResponse: AdminProductsResponse = {
  source: "live",
  shops: [
    { ...KARASHYNYARD, status: "live", total: 3, visible: 2 },
    { ...OSIO, status: "snapshot-fallback", error: "osio: HTTP 502", total: 1, visible: 1 },
  ],
  products: [
    { ...fileIndychky, visible: true },
    { ...kareTeliatyny, visible: true },
    { ...hrechanyiChai, visible: false },
    { ...kolrabi, visible: true },
  ],
};

// The same response in snapshot mode: both shops `snapshot`, no error.
const snapshotFourProductResponse: AdminProductsResponse = {
  ...fourProductResponse,
  source: "snapshot",
  shops: [
    { ...KARASHYNYARD, status: "snapshot", total: 3, visible: 2 },
    { ...OSIO, status: "snapshot", total: 1, visible: 1 },
  ],
};

/** The client's rejection shape: an Error that also carries the HTTP status. */
const withStatus = (message: string, status: number): Error => Object.assign(new Error(message), { status });

function renderAdminRoute() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/admin"] })} />);
}

/** Queried fresh every time: a section re-renders after each mutation. */
const region = (name: string) => screen.getByRole("region", { name });
const radio = (name: string) => within(screen.getByRole("group", { name: "Джерело даних" })).getByRole("radio", { name });

const loginHeading = () => screen.findByRole("heading", { level: 2, name: "Вхід для адміністратора" });
const panelHeading = () => screen.findByRole("heading", { level: 2, name: "Адмін-панель" });

function typeToken(token: string) {
  fireEvent.change(screen.getByLabelText("Токен адміністратора"), { target: { value: token } });
}

/** The mocks of "Authenticated shows the panel": a signed-in session, live settings, the four products. */
function mockAuthenticatedPanel() {
  vi.mocked(getAdminSession).mockResolvedValue({ authenticated: true });
  vi.mocked(getAdminSettings).mockResolvedValue(liveSettings);
  vi.mocked(getAdminProducts).mockResolvedValue(fourProductResponse);
}

async function renderPanel() {
  renderAdminRoute();
  await panelHeading();
}

beforeEach(() => {
  vi.resetAllMocks();
  // The layout loads the basket on mount; these tests only care about the admin page below it.
  vi.mocked(getBasket).mockResolvedValue(emptyBasket);
});

describe("Admin page resolves the session first", () => {
  test("Loading state", async () => {
    vi.mocked(getAdminSession).mockReturnValue(new Promise<AdminSession>(() => {}));

    renderAdminRoute();

    expect(await screen.findByRole("status")).toHaveTextContent("Завантажуємо…");
    expect(screen.queryByRole("heading", { name: "Вхід для адміністратора" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Адмін-панель" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Увійти" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(getAdminSettings).not.toHaveBeenCalled();
    expect(getAdminProducts).not.toHaveBeenCalled();
  });

  test("Not authenticated shows the login form", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ authenticated: false });

    renderAdminRoute();

    expect(await loginHeading()).toBeInTheDocument();
    expect(screen.getByLabelText("Токен адміністратора")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Увійти" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Адмін-панель" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getAdminSettings).not.toHaveBeenCalled();
    expect(getAdminProducts).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Адмін" })).toHaveAttribute("href", "/admin");
  });

  test("Authenticated shows the panel", async () => {
    mockAuthenticatedPanel();

    renderAdminRoute();

    expect(await panelHeading()).toBeInTheDocument();
    expect(radio("Наживо")).toBeChecked();
    expect(radio("Знімок")).not.toBeChecked();

    const karashynyard = region("Карашин Яр");
    expect(within(karashynyard).getByText("наживо")).toBeInTheDocument();
    expect(within(karashynyard).getByText("Видимих: 2")).toBeInTheDocument();
    expect(within(within(karashynyard).getByRole("list")).getAllByRole("listitem")).toHaveLength(3);
    expect(within(karashynyard).getByRole("checkbox", { name: "Філе індички, 1 кг" })).toBeChecked();
    expect(within(karashynyard).getByRole("checkbox", { name: "Каре молочної телятини, 1 кг" })).toBeChecked();
    expect(
      within(karashynyard).getByRole("checkbox", { name: "Гречаний чай з жасмином 100 г (99 чашок)" }),
    ).not.toBeChecked();

    const osio = region("OSIO organic");
    expect(within(osio).getByText("збережена копія")).toBeInTheDocument();
    expect(within(osio).getByText("Видимих: 1")).toBeInTheDocument();
    expect(within(osio).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(osio).getByRole("checkbox", { name: "Капуста кольрабі, органічна осіння" })).toBeChecked();

    expect(screen.getByRole("button", { name: "Вийти" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Вхід для адміністратора" })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getAdminSession).toHaveBeenCalledTimes(1);
    expect(getAdminSettings).toHaveBeenCalledTimes(1);
    expect(getAdminProducts).toHaveBeenCalledTimes(1);
  });

  // design.md D10: a rejected session check or panel load has no scenario of its own.
  test("Failed panel load", async () => {
    vi.mocked(getAdminSession).mockRejectedValue(new Error("GET /api/admin/session failed: 500"));

    renderAdminRoute();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Не вдалося завантажити адмін-панель"),
    );
    expect(screen.queryByRole("heading", { name: "Вхід для адміністратора" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Адмін-панель" })).toBeNull();
  });
});

describe("Login form", () => {
  test("Wrong token", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ authenticated: false });
    vi.mocked(adminLogin).mockRejectedValue(withStatus("POST /api/admin/login failed: 401", 401));
    renderAdminRoute();
    await loginHeading();

    typeToken("wrong-token");
    fireEvent.click(screen.getByRole("button", { name: "Увійти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Невірний токен");
    expect(adminLogin).toHaveBeenCalledTimes(1);
    expect(adminLogin).toHaveBeenCalledWith("wrong-token");
    expect(screen.getByRole("heading", { level: 2, name: "Вхід для адміністратора" })).toBeInTheDocument();
    expect(getAdminSettings).not.toHaveBeenCalled();
  });

  test("Admin not configured", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ authenticated: false });
    vi.mocked(adminLogin).mockRejectedValue(withStatus("POST /api/admin/login failed: 503", 503));
    renderAdminRoute();
    await loginHeading();

    typeToken("secret-token");
    fireEvent.click(screen.getByRole("button", { name: "Увійти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Адмінку не налаштовано");
    expect(adminLogin).toHaveBeenCalledTimes(1);
    expect(adminLogin).toHaveBeenCalledWith("secret-token");
    expect(screen.getByRole("heading", { level: 2, name: "Вхід для адміністратора" })).toBeInTheDocument();
    expect(screen.getByLabelText("Токен адміністратора")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Увійти" })).toBeInTheDocument();
  });

  test("Login failure other than 401/503 and alert reset", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ authenticated: false });
    vi.mocked(adminLogin)
      .mockRejectedValueOnce(withStatus("POST /api/admin/login failed: 500", 500))
      .mockResolvedValueOnce(undefined);
    vi.mocked(getAdminSettings).mockResolvedValue(liveSettings);
    vi.mocked(getAdminProducts).mockResolvedValue(fourProductResponse);
    renderAdminRoute();
    await loginHeading();

    typeToken("secret-token");
    fireEvent.click(screen.getByRole("button", { name: "Увійти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося увійти");
    expect(adminLogin).toHaveBeenCalledTimes(1);
    expect(adminLogin).toHaveBeenCalledWith("secret-token");
    expect(screen.getByRole("heading", { level: 2, name: "Вхід для адміністратора" })).toBeInTheDocument();
    expect(getAdminSettings).not.toHaveBeenCalled();
    expect(getAdminProducts).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Увійти" }));

    expect(await panelHeading()).toBeInTheDocument();
    expect(adminLogin).toHaveBeenCalledTimes(2);
    expect(adminLogin).toHaveBeenNthCalledWith(2, "secret-token");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getAdminSettings).toHaveBeenCalledTimes(1);
    expect(getAdminProducts).toHaveBeenCalledTimes(1);
  });

  test("Successful login opens the panel", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ authenticated: false });
    vi.mocked(adminLogin).mockResolvedValue(undefined);
    vi.mocked(getAdminSettings).mockResolvedValue(snapshotSettings);
    vi.mocked(getAdminProducts).mockResolvedValue(snapshotFourProductResponse);
    renderAdminRoute();
    await loginHeading();

    typeToken("secret-token");
    fireEvent.click(screen.getByRole("button", { name: "Увійти" }));

    expect(await panelHeading()).toBeInTheDocument();
    expect(adminLogin).toHaveBeenCalledTimes(1);
    expect(adminLogin).toHaveBeenCalledWith("secret-token");
    expect(radio("Знімок")).toBeChecked();
    expect(radio("Наживо")).not.toBeChecked();
    expect(within(region("Карашин Яр")).getByText("знімок")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getAdminSettings).toHaveBeenCalledTimes(1);
    expect(getAdminProducts).toHaveBeenCalledTimes(1);
  });
});

describe("Data source switch", () => {
  test("Radio switches the data source", async () => {
    mockAuthenticatedPanel();
    // The live and snapshot lists differ, so the sections are reloaded after the switch.
    vi.mocked(getAdminProducts)
      .mockResolvedValueOnce(fourProductResponse)
      .mockResolvedValueOnce(snapshotFourProductResponse);
    vi.mocked(updateSettings).mockResolvedValue(snapshotSettings);
    await renderPanel();

    fireEvent.click(radio("Знімок"));

    expect(await screen.findByRole("status")).toHaveTextContent("Збережено");
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({ dataSource: "snapshot" });
    expect(radio("Знімок")).toBeChecked();
    expect(radio("Наживо")).not.toBeChecked();
    await waitFor(() => expect(getAdminProducts).toHaveBeenCalledTimes(2));
    expect(await within(region("OSIO organic")).findByText("знімок")).toBeInTheDocument();
    expect(within(region("OSIO organic")).queryByText("збережена копія")).toBeNull();
    expect(within(region("Карашин Яр")).getByText("знімок")).toBeInTheDocument();
  });

  test("Source switch failure keeps the radio", async () => {
    mockAuthenticatedPanel();
    vi.mocked(updateSettings).mockRejectedValue(withStatus("PUT /api/admin/settings failed: 500", 500));
    await renderPanel();

    fireEvent.click(radio("Знімок"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося зберегти");
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({ dataSource: "snapshot" });
    expect(radio("Наживо")).toBeChecked();
    expect(radio("Знімок")).not.toBeChecked();
    expect(screen.queryByRole("status")).toBeNull();
    expect(getAdminProducts).toHaveBeenCalledTimes(1);
    expect(within(region("Карашин Яр")).getByText("наживо")).toBeInTheDocument();
  });

  test("Save failure clears the earlier success", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ authenticated: true });
    vi.mocked(getAdminSettings).mockResolvedValue(snapshotSettings);
    vi.mocked(getAdminProducts)
      .mockResolvedValueOnce(snapshotFourProductResponse)
      .mockResolvedValueOnce(fourProductResponse);
    vi.mocked(updateSettings)
      .mockResolvedValueOnce(liveSettings)
      .mockRejectedValueOnce(new Error("PUT /api/admin/settings failed: 500"));
    await renderPanel();

    fireEvent.click(radio("Наживо"));
    expect(await screen.findByRole("status")).toHaveTextContent("Збережено");

    fireEvent.click(radio("Знімок"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося зберегти");
    expect(screen.queryByText("Збережено")).toBeNull();
    expect(radio("Наживо")).toBeChecked();
    expect(radio("Знімок")).not.toBeChecked();
  });

  test("Reload failure after a successful save", async () => {
    mockAuthenticatedPanel();
    // The save applied; only the reload of the sections failed.
    vi.mocked(getAdminProducts)
      .mockResolvedValueOnce(fourProductResponse)
      .mockRejectedValueOnce(new Error("GET /api/admin/products failed: 500"));
    vi.mocked(updateSettings).mockResolvedValue(snapshotSettings);
    await renderPanel();

    fireEvent.click(radio("Знімок"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося завантажити адмін-панель");
    expect(screen.getByRole("status")).toHaveTextContent("Збережено");
    expect(screen.queryByText("Не вдалося зберегти")).toBeNull();
    expect(radio("Знімок")).toBeChecked();
  });
});

describe("Product visibility checkboxes", () => {
  test("Unticking hides a product", async () => {
    mockAuthenticatedPanel();
    vi.mocked(setProductVisibility).mockResolvedValue({
      id: "karashynyard:1498486363994",
      visible: false,
      visibility: ["karashynyard:1651059869009"],
    });
    await renderPanel();

    fireEvent.click(within(region("Карашин Яр")).getByRole("checkbox", { name: "Філе індички, 1 кг" }));

    expect(await within(region("Карашин Яр")).findByText("Видимих: 1")).toBeInTheDocument();
    expect(setProductVisibility).toHaveBeenCalledTimes(1);
    expect(setProductVisibility).toHaveBeenCalledWith("karashynyard:1498486363994", false);
    expect(within(region("Карашин Яр")).getByRole("checkbox", { name: "Філе індички, 1 кг" })).not.toBeChecked();
    expect(within(region("OSIO organic")).getByText("Видимих: 1")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("Ticking shows a product", async () => {
    mockAuthenticatedPanel();
    vi.mocked(setProductVisibility).mockResolvedValue({
      id: "karashynyard:1743423686258",
      visible: true,
      visibility: ["karashynyard:1498486363994", "karashynyard:1651059869009", "karashynyard:1743423686258"],
    });
    await renderPanel();

    fireEvent.click(
      within(region("Карашин Яр")).getByRole("checkbox", { name: "Гречаний чай з жасмином 100 г (99 чашок)" }),
    );

    expect(await within(region("Карашин Яр")).findByText("Видимих: 3")).toBeInTheDocument();
    expect(setProductVisibility).toHaveBeenCalledTimes(1);
    expect(setProductVisibility).toHaveBeenCalledWith("karashynyard:1743423686258", true);
    expect(
      within(region("Карашин Яр")).getByRole("checkbox", { name: "Гречаний чай з жасмином 100 г (99 чашок)" }),
    ).toBeChecked();
  });

  test("Save failure keeps the checkbox", async () => {
    mockAuthenticatedPanel();
    vi.mocked(setProductVisibility).mockRejectedValue(
      withStatus("PUT /api/admin/products/karashynyard:1498486363994/visibility failed: 500", 500),
    );
    await renderPanel();

    fireEvent.click(within(region("Карашин Яр")).getByRole("checkbox", { name: "Філе індички, 1 кг" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося зберегти");
    expect(setProductVisibility).toHaveBeenCalledTimes(1);
    expect(setProductVisibility).toHaveBeenCalledWith("karashynyard:1498486363994", false);
    expect(within(region("Карашин Яр")).getByRole("checkbox", { name: "Філе індички, 1 кг" })).toBeChecked();
    expect(within(region("Карашин Яр")).getByText("Видимих: 2")).toBeInTheDocument();
    expect(within(region("OSIO organic")).getByText("Видимих: 1")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("Status notes per shop", async () => {
    vi.mocked(getAdminSession).mockResolvedValue({ authenticated: true });
    vi.mocked(getAdminSettings).mockResolvedValue(snapshotSettings);
    vi.mocked(getAdminProducts).mockResolvedValue({
      source: "snapshot",
      shops: [
        { ...KARASHYNYARD, status: "snapshot", total: 1, visible: 1 },
        { ...OSIO, status: "unavailable", error: "osio: HTTP 503", total: 0, visible: 0 },
      ],
      products: [{ ...fileIndychky, visible: true }],
    });

    renderAdminRoute();

    const karashynyard = await screen.findByRole("region", { name: "Карашин Яр" });
    expect(within(karashynyard).getByText("знімок")).toBeInTheDocument();
    expect(within(karashynyard).getByText("Видимих: 1")).toBeInTheDocument();
    expect(within(within(karashynyard).getByRole("list")).getAllByRole("listitem")).toHaveLength(1);

    const osio = region("OSIO organic");
    expect(within(osio).getByText("недоступний")).toBeInTheDocument();
    expect(within(osio).getByText("Видимих: 0")).toBeInTheDocument();
    expect(within(osio).queryByRole("list")).toBeNull();
  });
});

describe("Logout", () => {
  test("Logout returns to the login form", async () => {
    mockAuthenticatedPanel();
    vi.mocked(adminLogout).mockResolvedValue(undefined);
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Вийти" }));

    expect(await loginHeading()).toBeInTheDocument();
    expect(adminLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Адмін-панель" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Вийти" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    // No second session check: the page knows it just signed out.
    expect(getAdminSession).toHaveBeenCalledTimes(1);
  });
});
