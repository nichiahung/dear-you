const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const googleBooksApiKey = defineSecret("GOOGLE_BOOKS_API_KEY");
const SEARCH_FIELDS = "key,title,author_name,first_publish_year,cover_i,isbn";

exports.searchBooks = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    secrets: [googleBooksApiKey],
    timeoutSeconds: 20,
    memory: "256MiB"
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }

    const query = String(req.query.q || "").trim();
    if (!query) {
      res.status(400).json({ error: "missing_query" });
      return;
    }

    try {
      const [googleResults, openLibraryResults] = await Promise.all([
        searchGoogleBooks(query).catch((err) => {
          console.warn("Google Books search failed:", err.message);
          return [];
        }),
        searchOpenLibrary(query).catch((err) => {
          console.warn("Open Library search failed:", err.message);
          return [];
        })
      ]);

      res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.json({ books: mergeBooks([...googleResults, ...openLibraryResults], query).slice(0, 8) });
    } catch (err) {
      console.error("Book search failed:", err);
      res.status(500).json({ error: "book_search_failed" });
    }
  }
);

async function searchGoogleBooks(query) {
  const variants = googleSearchVariants(query);
  const results = await Promise.all(variants.map((variant) =>
    searchGoogleBooksVariant(variant).catch((err) => {
      console.warn(`Google Books variant failed (${variant.q}):`, err.message);
      return [];
    })
  ));
  return mergeBooks(results.flat(), query);
}

async function searchGoogleBooksVariant(variant) {
  const params = googleBooksParams(variant);
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
  return (data.items || [])
    .map(googleBookFromVolume)
    .filter((book) => book.title);
}

function googleSearchVariants(query) {
  const cjkChunkedQuery = chunkCjkQuery(query);
  const variants = [
    { q: query, country: "TW" },
    { q: `intitle:${query}`, country: "TW" }
  ];

  if (hasCjk(query)) {
    variants.push(
      { q: query, country: "TW", langRestrict: "zh" },
      { q: `intitle:${query}`, country: "TW", langRestrict: "zh" }
    );
    if (cjkChunkedQuery && cjkChunkedQuery !== query) {
      variants.push(
        { q: cjkChunkedQuery, country: "TW", langRestrict: "zh" },
        { q: `intitle:${cjkChunkedQuery}`, country: "TW", langRestrict: "zh" }
      );
    }
  }

  return uniqueVariants(variants);
}

function googleBooksParams(variant) {
  const params = new URLSearchParams({
    q: variant.q,
    maxResults: "8",
    printType: "books",
    projection: "lite",
    country: variant.country || "TW"
  });

  if (variant.langRestrict) params.set("langRestrict", variant.langRestrict);

  let key = "";
  try {
    key = googleBooksApiKey.value();
  } catch (_) {
    key = "";
  }
  if (key) params.set("key", key);

  return params;
}

function googleBookFromVolume(item) {
  const info = item.volumeInfo || {};
  const author = Array.isArray(info.authors) ? info.authors.slice(0, 2).join(", ") : "";
  const coverUrl = normalizeGoogleCover(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "");
  return normalizeBook({
    id: `google-${item.id}`,
    provider: "google",
    providerId: item.id,
    title: info.title,
    author,
    year: parseYear(info.publishedDate),
    coverUrl,
    isbn: primaryIsbn(info.industryIdentifiers)
  });
}

async function searchOpenLibrary(query) {
  let docs = await searchOpenLibraryDocs("title", query);
  if (docs.length === 0) docs = await searchOpenLibraryDocs("q", query);
  return docs.map((doc) => normalizeBook({
    id: `openlibrary-${safeId(doc.key || doc.title)}`,
    provider: "openlibrary",
    providerId: doc.key || "",
    title: doc.title,
    author: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 2).join(", ") : "",
    year: doc.first_publish_year || "",
    coverUrl: openLibraryCoverUrl(doc)
  })).filter((book) => book.title);
}

async function searchOpenLibraryDocs(field, query) {
  const params = new URLSearchParams({
    [field]: query,
    limit: "8",
    fields: SEARCH_FIELDS
  });
  const data = await fetchJson(`https://openlibrary.org/search.json?${params.toString()}`);
  return data.docs || [];
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "DearYouBook/1.0 (Firebase Functions book search)"
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function normalizeBook(book) {
  return {
    id: book.id || `${book.provider}-${safeId(book.title)}`,
    provider: book.provider || "unknown",
    providerId: book.providerId || "",
    title: book.title || "",
    author: book.author || "Unknown author",
    year: book.year || "",
    coverUrl: book.coverUrl || "",
    isbn: book.isbn || ""
  };
}

function mergeBooks(books, query = "") {
  const byKey = new Map();
  for (const book of books) {
    const key = book.isbn || `${normalizeSearchText(book.title)}::${normalizeSearchText(book.author)}`;
    const existing = byKey.get(key);
    if (!existing || bookScore(book, query) > bookScore(existing, query)) {
      byKey.set(key, book);
    }
  }
  return [...byKey.values()].sort((a, b) => bookScore(b, query) - bookScore(a, query));
}

function normalizeGoogleCover(url) {
  return url ? url.replace(/^http:\/\//, "https://") : "";
}

function openLibraryCoverUrl(doc) {
  if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
  const isbn = Array.isArray(doc.isbn) ? doc.isbn.find(Boolean) : "";
  return isbn ? `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg` : "";
}

function parseYear(value) {
  const match = String(value || "").match(/\d{4}/);
  return match ? match[0] : "";
}

function primaryIsbn(identifiers) {
  if (!Array.isArray(identifiers)) return "";
  const isbn13 = identifiers.find((item) => item.type === "ISBN_13" && item.identifier);
  const isbn10 = identifiers.find((item) => item.type === "ISBN_10" && item.identifier);
  return isbn13?.identifier || isbn10?.identifier || "";
}

function safeId(value) {
  return String(value || Date.now()).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function bookScore(book, query) {
  const title = normalizeSearchText(book.title);
  const normalizedQuery = normalizeSearchText(query);
  let score = 0;
  if (book.coverUrl) score += 4;
  if (book.provider === "google") score += 2;
  if (title && normalizedQuery && title === normalizedQuery) score += 8;
  else if (title && normalizedQuery && title.includes(normalizedQuery)) score += 5;
  if (book.isbn) score += 1;
  return score;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[《》「」『』"'’:：,，.。-]/g, "")
    .replace(/[的之]/g, "");
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function chunkCjkQuery(value) {
  const text = String(value || "").trim();
  if (!/^[\u3400-\u9fff]{4,}$/.test(text)) return "";
  const chunks = text.match(/.{1,2}/g) || [];
  return chunks.join(" ");
}

function uniqueVariants(variants) {
  const seen = new Set();
  return variants.filter((variant) => {
    const key = JSON.stringify(variant);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
