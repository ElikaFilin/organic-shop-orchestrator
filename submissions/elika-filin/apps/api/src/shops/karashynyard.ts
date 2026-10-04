import { SHOPS, type Product } from "@organic/shared";
import type { FetchLike, ShopAdapter, ShopFetchResult } from "./types";

const SHOP_KEY = "karashynyard";
const PAGE_URL = "https://karashynyard.com.ua/";

// The page is one Tilda document: records open with `<div id="recNNN" … data-record-type="NN">`, product cards
// live in type-776 records, and the category of a card is the title of the nearest preceding heading record.
const RECORD_RE = /<div id="(rec\d+)"[^>]*\sdata-record-type="(\d+)"[^>]*>/g;
// Only `t776__col … js-product` is a card. Every record also carries one `t776__product-full js-product` popup
// block per card with the same lid, so matching on `js-product` alone would double every product.
const CARD_RE = /<div class="t776__col[^"]*js-product" data-product-lid="(\d+)"/g;
const TITLE_RE = /<div class="[^"]*t-title[^"]*"[^>]*>([\s\S]*?)<\/div>/;
// Tilda lazy-loads: the real picture is in `data-original`, `src` holds a placeholder — but some cards ship
// only `src`, so it is the fallback. A card with neither is not shown at all.
const IMAGE_RE = /data-original="([^"]+)"/;
const IMAGE_FALLBACK_RE = /<img[^>]*\ssrc="([^"]+)"/;
// The closing guard is the Unicode lookahead, not `\b`: in JavaScript `\b` is ASCII-only even with the `u`
// flag, so there is never a word boundary after a Cyrillic unit word.
const UNIT_RE =
  /\d+(?:[.,]\d+)?(?:\s*(?:кг|г|шт|мл|л))?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*(?:кг|г|шт|мл|л)(?![\p{L}\p{N}])/u;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity, body: string) => {
    if (!body.startsWith("#")) return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
    const code = body.startsWith("#x") ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

/** Strip tags, decode entities, collapse whitespace runs to one space. */
function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function fieldText(cardHtml: string, field: string, lid: string): string | undefined {
  const match = new RegExp(`field="${field}__${lid}"\\s*>([\\s\\S]*?)</div>`).exec(cardHtml);
  return match ? plainText(match[1] ?? "") : undefined;
}

function readCard(cardHtml: string, lid: string, recordId: string, category: string): Product | undefined {
  const name = fieldText(cardHtml, "li_title", lid);
  const price = fieldText(cardHtml, "li_price", lid);
  if (!name || !price || !/^\d+$/.test(price)) return undefined;
  const imageUrl = IMAGE_RE.exec(cardHtml)?.[1] ?? IMAGE_FALLBACK_RE.exec(cardHtml)?.[1];
  if (!imageUrl) return undefined;
  return {
    id: `${SHOP_KEY}:${lid}`,
    shopKey: SHOP_KEY,
    shopName: SHOPS[SHOP_KEY].name,
    sourceId: lid,
    name,
    price: Number(price),
    currency: "UAH",
    imageUrl,
    productUrl: `${PAGE_URL}#${recordId}`,
    description: fieldText(cardHtml, "li_descr", lid) ?? "",
    category,
    unit: UNIT_RE.exec(name)?.[0] ?? "",
    inStock: true,
  };
}

/** Pure parser over the Tilda page — the fixture tests call it without any fetch. */
export function parseKarashynyardHtml(html: string): Product[] {
  const products: Product[] = [];
  const seen = new Set<string>();
  let category = "";

  const records = [...html.matchAll(RECORD_RE)];
  records.forEach((record, index) => {
    const recordId = record[1] ?? "";
    const body = html.slice(record.index + record[0].length, records[index + 1]?.index ?? html.length);
    if (record[2] !== "776") {
      const title = TITLE_RE.exec(body);
      if (title) category = plainText(title[1] ?? "");
      return;
    }
    const cards = [...body.matchAll(CARD_RE)];
    cards.forEach((card, cardIndex) => {
      const lid = card[1] ?? "";
      // Tilda reuses lids across records; ids must be unique, so the first card with a lid wins.
      if (seen.has(lid)) return;
      const product = readCard(body.slice(card.index, cards[cardIndex + 1]?.index ?? body.length), lid, recordId, category);
      if (!product) return;
      seen.add(lid);
      products.push(product);
    });
  });

  return products;
}

export function createKarashynyardAdapter({ fetch }: { fetch: FetchLike }): ShopAdapter {
  return {
    shop: { key: SHOP_KEY, ...SHOPS[SHOP_KEY] },
    async fetchProducts(): Promise<ShopFetchResult> {
      try {
        const response = await fetch(PAGE_URL);
        if (!response.ok) return { ok: false, error: `${SHOP_KEY}: HTTP ${response.status}` };
        const products = parseKarashynyardHtml(await response.text());
        if (products.length === 0) return { ok: false, error: `${SHOP_KEY}: no product cards found` };
        return { ok: true, products };
      } catch (error) {
        return { ok: false, error: `${SHOP_KEY}: ${error instanceof Error ? error.message : String(error)}` };
      }
    },
  };
}
