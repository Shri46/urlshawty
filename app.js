const STORAGE_KEY = "url-shortener-links-v1";

const form = document.querySelector("#shortenForm");
const longUrlInput = document.querySelector("#longUrl");
const aliasInput = document.querySelector("#customAlias");
const tagInput = document.querySelector("#tagInput");
const formMessage = document.querySelector("#formMessage");
const searchInput = document.querySelector("#searchLinks");
const linksList = document.querySelector("#linksList");
const emptyState = document.querySelector("#emptyState");
const template = document.querySelector("#linkCardTemplate");
const linkCount = document.querySelector("#linkCount");
const clickCount = document.querySelector("#clickCount");
const resultPanel = document.querySelector(".result-panel");
const latestLink = document.querySelector("#latestLink");
const copyLatest = document.querySelector("#copyLatest");
const exportCsv = document.querySelector("#exportCsv");
const importCsv = document.querySelector("#importCsv");
const fileModeNotice = document.querySelector("#fileModeNotice");

let links = loadLinks();
let latestShortUrl = "";

function loadLinks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveLinks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol).href;
}

function makeAlias(value) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || Math.random().toString(36).slice(2, 8);
}

function shortUrlFor(alias) {
  if (window.location.protocol === "file:") {
    return `${window.location.origin}${window.location.pathname}#${alias}`;
  }

  return `${window.location.origin}/s/${alias}`;
}

function setMessage(message = "", isError = true) {
  formMessage.textContent = message;
  formMessage.style.color = isError ? "var(--warning)" : "var(--accent-dark)";
}

async function copyText(text, button) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("Clipboard API not available");
    }
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      console.error("Fallback copy failed: ", e);
    }
    document.body.removeChild(textarea);
  }
  const original = button.textContent;
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = original;
  }, 1100);
}

function createLinkCard(link) {
  const node = template.content.firstElementChild.cloneNode(true);
  const shortLink = node.querySelector(".short-link");
  const longLink = node.querySelector(".long-link");
  const tag = node.querySelector(".tag");
  const meta = node.querySelector(".meta");
  const copyBtn = node.querySelector(".copy-btn");
  const openBtn = node.querySelector(".open-btn");
  const deleteBtn = node.querySelector(".delete-btn");
  const shortUrl = shortUrlFor(link.alias);

  shortLink.href = shortUrl;
  shortLink.textContent = shortUrl;
  longLink.href = link.url;
  longLink.textContent = link.url;
  tag.textContent = link.tag;
  meta.textContent = `${link.clicks} visits · Created ${new Date(link.createdAt).toLocaleDateString()}`;

  shortLink.addEventListener("click", () => recordClick(link.alias));
  copyBtn.addEventListener("click", () => copyText(shortUrl, copyBtn));
  openBtn.addEventListener("click", () => {
    recordClick(link.alias);
    window.open(link.url, "_blank", "noopener,noreferrer");
  });
  deleteBtn.addEventListener("click", () => {
    links = links.filter((item) => item.alias !== link.alias);
    saveLinks();
    renderLinks();
  });

  return node;
}

function renderLinks() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = links.filter((link) =>
    [link.alias, link.url, link.tag].some((value) => value.toLowerCase().includes(query))
  );

  linksList.replaceChildren(...filtered.map(createLinkCard));
  emptyState.hidden = filtered.length > 0;

  const visits = links.reduce((total, link) => total + link.clicks, 0);
  linkCount.textContent = `${links.length} ${links.length === 1 ? "link" : "links"}`;
  clickCount.textContent = `${visits} ${visits === 1 ? "visit" : "visits"}`;
}

function recordClick(alias) {
  const link = links.find((item) => item.alias === alias);
  if (!link) {
    return;
  }
  link.clicks += 1;
  saveLinks();
  renderLinks();
}

function handleHashRoute() {
  const pathMatch = window.location.pathname.match(/^\/s\/([a-z0-9-]+)$/i);
  const alias = pathMatch?.[1] ?? window.location.hash.slice(1);

  if (!alias) {
    return;
  }
  const link = links.find((item) => item.alias === alias);
  if (link) {
    recordClick(alias);
    window.location.href = link.url;
  }
}

function showLatest(link) {
  latestShortUrl = shortUrlFor(link.alias);
  latestLink.href = latestShortUrl;
  latestLink.textContent = latestShortUrl;
  resultPanel.hidden = false;
}

function downloadCsv() {
  const rows = [
    ["alias", "url", "tag", "clicks", "createdAt"],
    ...links.map((link) => [link.alias, link.url, link.tag, link.clicks, link.createdAt]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "short-links.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.slice(1).map((line) => {
    const cells = line.match(/("([^"]|"")*"|[^,]+)/g)?.map((cell) =>
      cell.replace(/^"|"$/g, "").replaceAll('""', '"')
    ) ?? [];

    return {
      alias: makeAlias(cells[0] ?? ""),
      url: normalizeUrl(cells[1] ?? ""),
      tag: (cells[2] ?? "").trim(),
      clicks: Number.parseInt(cells[3] ?? "0", 10) || 0,
      createdAt: cells[4] || new Date().toISOString(),
    };
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setMessage();

  let url;
  try {
    url = normalizeUrl(longUrlInput.value);
  } catch {
    setMessage("Enter a valid destination URL.");
    return;
  }

  const alias = makeAlias(aliasInput.value);
  if (links.some((link) => link.alias === alias)) {
    setMessage("That alias is already in use.");
    return;
  }

  const link = {
    alias,
    url,
    tag: tagInput.value.trim(),
    clicks: 0,
    createdAt: new Date().toISOString(),
  };

  links = [link, ...links];
  saveLinks();
  renderLinks();
  showLatest(link);
  form.reset();
  setMessage("Short link created.", false);
});

searchInput.addEventListener("input", renderLinks);

copyLatest.addEventListener("click", () => {
  if (latestShortUrl) {
    copyText(latestShortUrl, copyLatest);
  }
});

exportCsv.addEventListener("click", downloadCsv);

importCsv.addEventListener("change", async () => {
  const file = importCsv.files?.[0];
  if (!file) {
    return;
  }

  try {
    const importedLinks = parseCsv(await file.text());
    const merged = [...links];
    importedLinks.forEach((link) => {
      if (!merged.some((item) => item.alias === link.alias)) {
        merged.push(link);
      }
    });
    links = merged;
    saveLinks();
    renderLinks();
    setMessage(`Imported ${importedLinks.length} links.`, false);
  } catch {
    setMessage("Could not import that CSV file.");
  } finally {
    importCsv.value = "";
  }
});

window.addEventListener("hashchange", handleHashRoute);

renderLinks();
fileModeNotice.hidden = window.location.protocol !== "file:";
handleHashRoute();
