# basket-web Specification

## Purpose

The buyer's side of the basket: a header link that always shows how many items are in it, the `/basket` page
to review the lines, change quantities, remove lines or empty the basket, and the API-client functions every
basket call goes through.

## Requirements

### Requirement: Header basket link
The layout header SHALL show a link to `/basket` with the text "Кошик (N)", where N is `totals.count` of the
basket loaded once on mount through `getBasket()` (0 while nothing is loaded or the basket is empty). Every
successful basket mutation (`addToBasket`, `updateBasketItem`, `removeBasketItem`, `clearBasket`) SHALL update
N from the basket it returns, without a second `getBasket()` call.

#### Scenario: Header link counts the lines on mount
- **WHEN** `getProducts()` resolves with the "Two shops with products" response of `add-catalog`,
  `getBasket()` resolves with
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [ { productId: "karashynyard:1498486363994", quantity: 2, product: <full Product "Філе індички, 1 кг", price 665, unit "1 кг"> }, { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: <full Product "Капуста кольрабі, органічна осіння", price 195, unit "Качан 350-450 г"> } ], totals: { count: 3, sum: 1525 } }`
  (the "two-line basket" below) and route `/` is rendered
- **THEN** a link named "Кошик (3)" with `href="/basket"` is rendered and `getBasket` was called exactly once

### Requirement: Basket page lists the lines
Route `/basket` SHALL render a level-2 heading "Кошик" and, for a basket with lines, a list (`<ul>`) with one
item per line in basket order, each showing the product image (`alt` = name), the name, the unit, the unit
price formatted "<price> ₴", a number input labelled "Кількість" (`min` 1, `max` 99, value = quantity), the
line sum "<price × quantity> ₴" and a button "Видалити"; after the list the text "Разом: <totals.sum> ₴" and
a button "Очистити кошик". Prices use the catalog's `formatPrice` (no thousands separator).

#### Scenario: Two lines with totals
- **WHEN** `getBasket()` resolves with the two-line basket (2 × `karashynyard:1498486363994` at 665,
  1 × `osio:6abcf192b7db2532803d266d` at 195, totals count 3, sum 1525) and route `/basket` is rendered
- **THEN** a level-2 heading "Кошик" is shown; the list has 2 items; the first item contains an image with
  `alt="Філе індички, 1 кг"` and `src="https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg"`,
  the texts "Філе індички, 1 кг", "1 кг", "665 ₴" and "1330 ₴", a spinbutton named "Кількість" with value 2,
  `min="1"` and `max="99"`, and a button "Видалити"; the second item contains an image with
  `alt="Капуста кольрабі, органічна осіння"`, the texts "Капуста кольрабі, органічна осіння" and
  "Качан 350-450 г", the text "195 ₴" exactly twice (unit price and line sum — at quantity 1 both are
  `formatPrice(195)`), a spinbutton named "Кількість" with value 1 and a button "Видалити"
- **AND** the text "Разом: 1525 ₴", a button "Очистити кошик" and a link "Кошик (3)" are shown, and no
  element with `role="status"` is rendered

### Requirement: Empty basket page
When the basket has no lines, route `/basket` SHALL render the heading "Кошик", the text "Кошик порожній" in
an element with `role="status"` and a link "До каталогу" to `/`, and no list, no total and no
"Очистити кошик" button.

#### Scenario: Empty basket
- **WHEN** `getBasket()` resolves with
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }` and route
  `/basket` is rendered
- **THEN** a level-2 heading "Кошик" is shown, an element with `role="status"` shows "Кошик порожній", a link
  named "До каталогу" has `href="/"`, no list is rendered, no button "Очистити кошик" and no text starting
  with "Разом:" is rendered, and the header link reads "Кошик (0)"

### Requirement: Change a line's quantity on the page
Changing the "Кількість" input of a line to an integer 1..99 SHALL call `updateBasketItem(productId, quantity)`
and re-render the page and the header from the basket it returns.

A line's identity on the page SHALL be its `productId` (not its quantity), so a server-confirmed update re-renders the
row in place and the focused input keeps focus.

#### Scenario: Changing the quantity updates the line
- **WHEN** route `/basket` is rendered with the two-line basket, `updateBasketItem` resolves with the same
  basket except the karashynyard line has `quantity: 3` and `totals: { count: 4, sum: 2190 }`, and the user
  changes the first "Кількість" input to `3`
- **THEN** `updateBasketItem` was called once with `("karashynyard:1498486363994", 3)`, the first item shows
  "1995 ₴", the text "Разом: 2190 ₴" is shown and the header link reads "Кошик (4)"

#### Scenario: Quantity input keeps focus across an update
- **WHEN** `getBasket()` resolves with one line `karashynyard:1498486363994` × 1, the "Кількість" input is focused and
  changed to `2`, and `updateBasketItem` resolves with the same basket at `quantity: 2`
- **THEN** after the update the spinbutton named "Кількість" shows `2`, is the same DOM element as before, and is still
  `document.activeElement`

### Requirement: Remove a line on the page
Clicking a line's "Видалити" button SHALL call `removeBasketItem(productId)` and re-render the page and the
header from the basket it returns.

#### Scenario: Removing a line
- **WHEN** route `/basket` is rendered with the two-line basket, `removeBasketItem` resolves with
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [ { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: <full Product, price 195> } ], totals: { count: 1, sum: 195 } }`
  and the user clicks the first "Видалити" button
- **THEN** `removeBasketItem` was called once with `"karashynyard:1498486363994"`, the list has 1 item showing
  "Капуста кольрабі, органічна осіння" and the text "195 ₴" exactly twice (unit price and line sum of a
  quantity-1 line), the text "Разом: 195 ₴" is shown and the header link reads "Кошик (1)"

### Requirement: Clear the basket on the page
Clicking "Очистити кошик" SHALL call `clearBasket()` and render the empty state from the basket it returns.

A rejected mutation (`updateBasketItem`, `removeBasketItem`, `clearBasket`) SHALL show "Не вдалося оновити кошик" in
an element with `role="status"` and keep the last known basket on screen.

#### Scenario: Clearing the basket
- **WHEN** route `/basket` is rendered with the two-line basket, `clearBasket` resolves with
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }` and the user
  clicks "Очистити кошик"
- **THEN** `clearBasket` was called once, an element with `role="status"` shows "Кошик порожній", a link
  named "До каталогу" is shown, no list is rendered and the header link reads "Кошик (0)"

#### Scenario: Removing a line fails
- **WHEN** `getBasket()` resolves with the two lines of "Two lines with totals", the first line's "Видалити" is clicked
  and `removeBasketItem` rejects with `Error("DELETE /api/basket/items/karashynyard:1498486363994 failed: 500")`
- **THEN** an element with `role="status"` shows "Не вдалося оновити кошик", the list still has 2 items and
  "Разом: 1525 ₴" is still shown

### Requirement: Unavailable product line
A line whose `product` is `null` SHALL render the text "Товар недоступний" instead of the image, name, unit,
unit price and line sum, and SHALL keep its "Кількість" input and "Видалити" button so the buyer can drop it;
it adds nothing to the total.

#### Scenario: Line without a product
- **WHEN** `getBasket()` resolves with
  `{ id: "6d2a1f0c-3b4e-4f5a-8c7d-0a1b2c3d4e5f", items: [ { productId: "karashynyard:1498486363994", quantity: 2, product: <full Product, price 665> }, { productId: "osio:000000000000000000000000", quantity: 1, product: null } ], totals: { count: 2, sum: 1330 } }`
  and route `/basket` is rendered
- **THEN** the list has 2 items; the second item shows "Товар недоступний" and a button "Видалити" and contains
  no image; exactly one image is rendered, with `alt="Філе індички, 1 кг"`; the text "Разом: 1330 ₴" and the
  header link "Кошик (2)" are shown

### Requirement: Basket functions of the API client
`src/api/client.ts` SHALL export `getBasket()` (`GET /api/basket`), `addToBasket(productId, quantity)`
(`POST /api/basket/items`, JSON body `{ productId, quantity }`), `updateBasketItem(productId, quantity)`
(`PATCH /api/basket/items/<productId>`, body `{ quantity }`), `removeBasketItem(productId)`
(`DELETE /api/basket/items/<productId>`) and `clearBasket()` (`DELETE /api/basket`). Each calls `fetch` with
`credentials: "same-origin"`, validates a 2xx JSON body with the shared basket response schema and returns
it, and rejects a non-2xx answer with `Error("<METHOD> <path> failed: <status>")`. Components never call
`fetch`.

The `productId` in a path SHALL be percent-encoded with `encodeURIComponent` except the `:` between shop key and
source id, which stays literal (RFC 3986 allows it in a path segment and the sibling scenarios pin the literal form).

#### Scenario: getBasket requests the basket
- **WHEN** global `fetch` answers with status 200 and the JSON body
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [ { productId: "osio:6abcf192b7db2532803d266d", quantity: 1, product: <the full osio:6abcf192b7db2532803d266d Product from data/shops/osio.json, price 195> } ], totals: { count: 1, sum: 195 } }`
- **THEN** `getBasket()` resolves with an object deep-equal to that body and `fetch` was called once with
  `"/api/basket"` and an init object whose `credentials` is `"same-origin"`

#### Scenario: Mutations send method, path and JSON body
- **WHEN** global `fetch` answers `POST` with status 201 and every other call with status 200, always with
  the body `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }`, and
  `addToBasket("karashynyard:1498486363994", 1)` is awaited
- **THEN** `fetch` was called with `"/api/basket/items"` and an init whose `method` is `"POST"`,
  `credentials` is `"same-origin"`, `headers` include `"Content-Type": "application/json"` and `body` is
  `'{"productId":"karashynyard:1498486363994","quantity":1}'`
- **WHEN** `updateBasketItem("karashynyard:1498486363994", 3)` is awaited
- **THEN** `fetch` was called with `"/api/basket/items/karashynyard:1498486363994"` and an init whose
  `method` is `"PATCH"`, `headers` include `"Content-Type": "application/json"`, `body` is
  `'{"quantity":3}'` and `credentials` is `"same-origin"`
- **WHEN** `removeBasketItem("karashynyard:1498486363994")` is awaited
- **THEN** `fetch` was called with `"/api/basket/items/karashynyard:1498486363994"` and an init whose
  `method` is `"DELETE"`, `body` is `undefined` and `credentials` is `"same-origin"`
- **WHEN** `clearBasket()` is awaited
- **THEN** `fetch` was called with `"/api/basket"` and an init whose `method` is `"DELETE"` and
  `credentials` is `"same-origin"`, and each of the four calls resolved with an object deep-equal to the
  empty-basket body

#### Scenario: Product id is URL-encoded in the path
- **WHEN** `fetch` is stubbed to resolve `200` with an empty basket body and `updateBasketItem("osio:a#b", 2)` is called
- **THEN** `fetch` was called with the path `/api/basket/items/osio:a%23b`

#### Scenario: Failed request rejects with method, path and status
- **WHEN** global `fetch` answers with status 404 and the body `{ error: "Product not found" }`
- **THEN** `addToBasket("osio:000000000000000000000000", 1)` rejects with an `Error` whose message is
  `POST /api/basket/items failed: 404`
- **WHEN** global `fetch` answers with status 404 and the body `{ error: "Basket item not found" }`
- **THEN** `updateBasketItem("karashynyard:1498486363994", 2)` rejects with an `Error` whose message is
  `PATCH /api/basket/items/karashynyard:1498486363994 failed: 404`
- **WHEN** global `fetch` answers with status 503
- **THEN** `getBasket()` rejects with an `Error` whose message is `GET /api/basket failed: 503`
