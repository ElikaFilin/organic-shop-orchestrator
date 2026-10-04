# shop-adapters Specification

## Purpose

Fetches one shop's products from the shop's live source — the Tilda page of Карашин Яр or the JSON API behind
OSIO organic — and normalizes them into the shared `Product` shape, reporting upstream failures as typed
results so the catalog can fall back to that shop's snapshot instead of failing.

## Requirements

### Requirement: Karashynyard adapter parses the Tilda store page
The karashynyard adapter SHALL GET `https://karashynyard.com.ua/` and return one `Product` per store card
(`<div class="t776__col … js-product" data-product-lid="<id>">` inside a record
`<div id="rec…" data-record-type="776">`) in page order: `sourceId` = the lid, `name` from
`field="li_title__<id>"`, `description` from `li_descr__<id>`, `price` = the integer in `li_price__<id>`,
`imageUrl` from `data-original`, `productUrl` = `https://karashynyard.com.ua/#<recId>`, `category` = the text
of the nearest preceding record's `t-title` element, `unit` = the quantity phrase of the name (number, optional
range, unit word кг/г/шт/л/мл), `inStock` = true. Tags and surrounding whitespace are stripped from text. The
`t776__product-full js-product` popup blocks that repeat a card's lid SHALL NOT produce products.

#### Scenario: Fixture page yields its products in page order
- **WHEN** the adapter's fetch resolves with status 200 and the body of `apps/api/fixtures/karashynyard.html`
  (records rec2364055923, rec638772397, rec2366129053, rec638782031, rec2375538863, rec638793505 — five
  `t776__col` cards, plus one `<div class="t776__product-full js-product" data-product-lid="…">` popup block
  per card carrying the same lid and the same `li_title__`/`li_price__` fields, which is not a card)
- **THEN** the result is `{ ok: true, products }` and `products.map((p) => p.sourceId)` equals
  `["1498486363994", "1628604400123", "1781040705497", "1652947963962"]`
- **AND** `products[0]` equals `{ id: "karashynyard:1498486363994", shopKey: "karashynyard", shopName: "Карашин Яр", sourceId: "1498486363994", name: "Філе індички, 1 кг", price: 665, currency: "UAH", imageUrl: "https://static.tildacdn.net/tild3635-3935-4665-b364-633939613631/___13.jpg", productUrl: "https://karashynyard.com.ua/#rec638772397", description: "Ніжне філе без кістки для котлет, запікання, тушкування та дитячих страв.", category: "Індичка з вільного вигулу", unit: "1 кг", inStock: true }`
- **AND** `products[2]` has `name: "Фермерське курча 800 г - 1,1 кг"`, `price: 545`,
  `productUrl: "https://karashynyard.com.ua/#rec638782031"`,
  `category: "Курка та інша птиця з вільного вигулу (качка, перепела, цесарка)"`, `unit: "800 г - 1,1 кг"`

#### Scenario: Repeated product id keeps the first card
- **WHEN** the same fixture is parsed — its last record rec638793505 holds a card whose `data-product-lid` is
  again `1498486363994`, titled "Домашня сметана, 0,5 л" with price 270 (Tilda reuses lids across records)
- **THEN** exactly one product has `sourceId: "1498486363994"`, and it is `name: "Філе індички, 1 кг"`,
  `price: 665`, `productUrl: "https://karashynyard.com.ua/#rec638772397"`
- **AND** no product has `name: "Домашня сметана, 0,5 л"`

#### Scenario: Page without store records is a failure
- **WHEN** the adapter's fetch resolves with status 200 and the body
  `<html><body><p>Технічні роботи</p></body></html>`
- **THEN** the result is `{ ok: false, error: "karashynyard: no product cards found" }` and nothing is thrown

### Requirement: Osio adapter maps the products API
The osio adapter SHALL GET `https://arsubs-production-1-back-t5tdi.ondigitalocean.app/v1/products` with the
request header `Application-Instance: 3fc23022-4cf1-4d8b-a24c-c50e2651d4e0` (the shop's public tenant id, shipped in
its own JS bundle; without it the API answers `400 Failed to determine the application`) and map
each array item to a `Product` in response order: `sourceId` = `id`, `name` = trimmed `name`, `price` =
`price`, `imageUrl` = `imageUrl`, `productUrl` = `https://osio-organic.com.ua/products/<id>`, `category` =
trimmed `categoryName`, `unit` = trimmed `unit`, `inStock` = `!isComingSoon`, `description` = `description`
with whitespace runs collapsed to one space and, when longer than 300 characters, cut at the last space before
position 300 and suffixed with `…`. An item that lacks a required field (`id`, `name`, numeric `price`, `imageUrl`,
`unit`, `categoryName`, string `description`, boolean `isComingSoon`) SHALL be skipped, like a Tilda card without an
integer price or without an image (`data-original`, else `src`); a response whose items are all malformed is the `"osio: no products"` failure.

#### Scenario: Fixture response yields twelve products in response order
- **WHEN** the adapter's fetch resolves with status 200 and the body of `apps/api/fixtures/osio.json` (12 items)
- **THEN** the result is `{ ok: true, products }` with 12 products, `products[0].id` =
  `"osio:6abcf192b7db2532803d266d"` and `products[11].id` = `"osio:6aa15f6d98ecadd65969cc45"`
- **AND** `products[0]` equals `{ id: "osio:6abcf192b7db2532803d266d", shopKey: "osio", shopName: "OSIO organic", sourceId: "6abcf192b7db2532803d266d", name: "Капуста кольрабі, органічна осіння", price: 195, currency: "UAH", imageUrl: "https://fra1.digitaloceanspaces.com/arsubs-1/6abcf18f504a4d6030570003", productUrl: "https://osio-organic.com.ua/products/6abcf192b7db2532803d266d", description: "🥬 Кольрабі — соковита, хрустка капуста з ніжним солодкуватим смаком. Ось чим вона корисна: • Вітамін С підтримує імунну систему, потрібен для утворення колагену та допомагає засвоювати залізо з рослинної їжі. • Клітковина сприяє регулярному випорожненню, підтримує кишкову мікрофлору й допомагає…", category: "Овочі", unit: "Качан 350-450 г", inStock: true }`
  (the same description string as that product's entry in `data/shops/osio.json`)
- **AND** `products[1]` has `name: "Щавлик органічний, осінній"` (the fixture's trailing space removed),
  `price: 150`, `unit: "100 г"`, `category: "Зелень"`, `inStock: true`

#### Scenario: Malformed item is skipped
- **WHEN** the adapter's fetch resolves with status 200 and the 12 fixture items where item index 2 has
  `description: null`
- **THEN** the result is `ok: true` with 11 products, `products[2].id` is `"osio:" + <fixture item index 3 id>` and no
  product has the index-2 item's id

#### Scenario: Request carries the tenant header
- **WHEN** the adapter's `fetchProducts()` runs with a stub fetch that records its arguments and resolves with status 200
  and the body of `apps/api/fixtures/osio.json`
- **THEN** the stub was called once with url `https://arsubs-production-1-back-t5tdi.ondigitalocean.app/v1/products`
  and an init whose `headers` equals `{ "Application-Instance": "3fc23022-4cf1-4d8b-a24c-c50e2651d4e0" }`

#### Scenario: Coming-soon item is out of stock
- **WHEN** the adapter's fetch resolves with status 200 and a body that is a one-item array holding the
  fixture's twelfth item (`id: "6aa15f6d98ecadd65969cc45"`, `price: 315`) with `isComingSoon` set to `true`
- **THEN** the result has exactly one product, with `id: "osio:6aa15f6d98ecadd65969cc45"`,
  `name: "Перець солодкий червоний і жовтий , органічний"`, `price: 315`, `inStock: false`

#### Scenario: Non-JSON body is a failure
- **WHEN** the adapter's fetch resolves with status 200 and the body `<!doctype html><title>502 Bad Gateway</title>`
- **THEN** the result is `{ ok: false, error: "osio: invalid JSON" }`

#### Scenario: Empty product list is a failure
- **WHEN** the adapter's fetch resolves with status 200 and the body `[]`
- **THEN** the result is `{ ok: false, error: "osio: no products" }`

### Requirement: Upstream failures are typed results
An adapter SHALL never throw. A rejected fetch, a non-2xx status, an unparseable body and a body with zero
products each produce `{ ok: false, error: "<shopKey>: <reason>" }`, where the reason is `HTTP <status>` for
a non-2xx answer and the error's message for a rejected fetch.

#### Scenario: Non-2xx status
- **WHEN** the karashynyard adapter's fetch resolves with status 503 and the body `Service Unavailable`
- **THEN** the result is `{ ok: false, error: "karashynyard: HTTP 503" }`

#### Scenario: Network error
- **WHEN** the osio adapter's fetch rejects with `new Error("ECONNRESET")`
- **THEN** the adapter's promise resolves (does not reject) to `{ ok: false, error: "osio: ECONNRESET" }`
