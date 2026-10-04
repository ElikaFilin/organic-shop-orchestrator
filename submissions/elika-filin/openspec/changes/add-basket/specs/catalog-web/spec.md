# Spec Delta

## ADDED Requirements

### Requirement: Product card adds to the basket
Every product card on route `/` SHALL contain a button "Додати в кошик". Clicking it SHALL call the API
client's `addToBasket(productId, 1)` for that card's product; after the call resolves the card SHALL show the
text "Додано" in an element with `role="status"` and the header basket link SHALL show the returned
`totals.count`. While the call is pending the button SHALL be `disabled`, so a double click adds once. If the call
rejects, the card SHALL show "Не вдалося додати" in an element with `role="status"`. Before any click the cards render
no `role="status"` element.

#### Scenario: Add from the catalog card
- **WHEN** `getProducts()` resolves with the "Two shops with products" response of `add-catalog` (3 products:
  `karashynyard:1498486363994` "Філе індички, 1 кг" 665, `karashynyard:1651059869009` "Каре молочної
  телятини, 1 кг" 1410, `osio:6abcf192b7db2532803d266d` "Капуста кольрабі, органічна осіння" 195),
  `getBasket()` resolves with
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [], totals: { count: 0, sum: 0 } }`, `addToBasket`
  resolves with
  `{ id: "0f3c9d6e-7a1b-4c2d-9e8f-123456789abc", items: [ { productId: "karashynyard:1498486363994", quantity: 1, product: <the full karashynyard:1498486363994 Product, price 665> } ], totals: { count: 1, sum: 665 } }`,
  route `/` is rendered and the user clicks the button "Додати в кошик" inside the first card
- **THEN** before the click there are 3 buttons named "Додати в кошик", a link named "Кошик (0)" with
  `href="/basket"` and no element with `role="status"`
- **AND** after the click `addToBasket` was called once with `("karashynyard:1498486363994", 1)`, the first
  card contains an element with `role="status"` showing "Додано", the other two cards contain no
  `role="status"` element, and the header link reads "Кошик (1)" with `href="/basket"`

#### Scenario: Double click adds once
- **WHEN** `addToBasket` resolves only after a tick and the card's "Додати в кошик" is clicked twice in a row
- **THEN** the button is `disabled` after the first click, `addToBasket` was called exactly once, and after the
  promise resolves the card shows "Додано"

#### Scenario: Add fails
- **WHEN** `addToBasket` rejects with `Error("POST /api/basket/items failed: 500")` and "Додати в кошик" is clicked
- **THEN** the card shows "Не вдалося додати" in an element with `role="status"` and the button is enabled again
