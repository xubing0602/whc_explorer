const ICONS = {
  cultural: "assets/cultural.png",
  natural: "assets/natural.png",
  mixed: "assets/mixed.png",
};

const GLOBE_IMAGE_URL =
  "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg";
const BUMP_IMAGE_URL =
  "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png";
const BACKGROUND_IMAGE_URL =
  "https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png";
const COUNTRIES_GEOJSON_URL =
  "https://unpkg.com/three-globe@2.31.0/example/country-polygons/ne_110m_admin_0_countries.geojson";

let globe;
let sites = [];
let markerData = [];
let allStates = [];
let allRegions = [];
let statsAll = [];
let statsVisited = [];
let statsScope = "all";
const BAR_UNIT_PX = 16;

const filters = {
  name: "",
  danger: "all",
  category: "all",
  state: "all",
  region: "all",
  been: "all",
};

window.addEventListener("DOMContentLoaded", init);

async function init() {
  initGlobe();
  await loadData();
  setupFilters();
  setupStatsControls();
  setupInfoCard();
  updateUI();
}

function initGlobe() {
  const mapEl = document.getElementById("map");

  globe = Globe()(mapEl)
    .globeImageUrl(GLOBE_IMAGE_URL)
    .bumpImageUrl(BUMP_IMAGE_URL)
    .backgroundImageUrl(BACKGROUND_IMAGE_URL)
    .showAtmosphere(true)
    .atmosphereColor("#4fc3f7")
    .atmosphereAltitude(0.18)
    .polygonAltitude(0.006)
    .polygonCapColor(() => "rgba(80, 180, 255, 0.05)")
    .polygonSideColor(() => "rgba(0,0,0,0)")
    .polygonStrokeColor(() => "#6fd4ff")
    .htmlAltitude(0.01)
    .htmlLat((d) => d.lat)
    .htmlLng((d) => d.lng)
    .htmlElement((d) => buildMarkerEl(d));

  // Load countries for borders
  fetch(COUNTRIES_GEOJSON_URL)
    .then((r) => r.json())
    .then((geo) => globe.polygonsData(geo.features))
    .catch((err) => console.warn("country polygons failed", err));

  // Controls: smooth auto-rotate off, damping, zoom limits
  const controls = globe.controls();
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 180;
  controls.maxDistance = 600;

  // Initial camera altitude
  globe.pointOfView({ lat: 20, lng: 10, altitude: 2.4 }, 0);

  // Resize to container
  const resize = () => {
    globe.width(mapEl.clientWidth);
    globe.height(mapEl.clientHeight);
  };
  resize();
  window.addEventListener("resize", resize);
}

function buildMarkerEl(d) {
  const el = document.createElement("div");
  el.className = "globe-marker" + (d.visited ? " visited" : "");
  el.style.setProperty("--size", d.visited ? "32px" : "26px");
  el.innerHTML = `
    <img src="${d.icon}" alt="" draggable="false" />
    ${d.visited ? '<span class="tick">✓</span>' : ""}
  `;
  el.title = d.title;
  el.addEventListener("click", (ev) => {
    ev.stopPropagation();
    openInfoCard(d.site);
    globe.pointOfView(
      { lat: d.lat, lng: d.lng, altitude: Math.max(0.9, currentAltitude() * 0.7) },
      700
    );
  });
  return el;
}

function currentAltitude() {
  const pov = globe.pointOfView();
  return pov && typeof pov.altitude === "number" ? pov.altitude : 2.4;
}

async function loadData() {
  const response = await fetch("data/whc-sites-2025.csv");
  const text = await response.text();
  const rows = parseCSV(text);

  sites = rows
    .map((row, index) => ({ ...row, _index: index }))
    .filter((row) => row.latitude && row.longitude);

  allStates = getUniqueStates(sites).sort((a, b) => a.localeCompare(b));
  allRegions = Array.from(
    new Set(sites.map((site) => site.region_en).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  markerData = sites
    .map((site) => {
      const lat = parseFloat(site.latitude);
      const lng = parseFloat(site.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      const categoryKey = normalizeCategory(site.category);
      const visited = isVisited(site);
      return {
        site,
        lat,
        lng,
        visited,
        icon: ICONS[categoryKey] || ICONS.cultural,
        title: site.name_en || site.name_zh || "World Heritage",
      };
    })
    .filter(Boolean);

  buildStats();
  updateSummaryCounts();
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      continue;
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = (rows.shift() || []).map((h) =>
    h.replace(/^\ufeff/, "").trim()
  );

  return rows
    .filter((r) => r.length > 1)
    .map((r) => {
      const obj = {};
      header.forEach((key, idx) => {
        obj[key] = r[idx] ?? "";
      });
      return obj;
    });
}

function setupInfoCard() {
  document.getElementById("info-close").addEventListener("click", () => {
    document.getElementById("info-card").hidden = true;
  });
}

function openInfoCard(site) {
  const card = document.getElementById("info-card");
  document.getElementById("info-body").innerHTML = renderInfoContent(site);
  card.hidden = false;
}

function renderInfoContent(site) {
  const zhName = site.name_zh && site.name_zh.trim();
  const enName = site.name_en && site.name_en.trim();
  const descRaw = site.short_description_zh || site.short_description_en || "";
  const desc = htmlToText(descRaw) || "暂无简介";
  const danger = site.danger === "1" ? "是" : "否";
  const area = site.area_hectares
    ? `${formatNumber(site.area_hectares)} ha`
    : "-";

  return `
    <div class="info-window">
      <div class="info-title">
        <div class="zh">${escapeHTML(zhName || enName || "-")}</div>
        ${zhName ? `<div class="en">${escapeHTML(enName || "-")}</div>` : ""}
      </div>
      <div class="info-desc">${escapeHTML(desc)}</div>
      <div class="info-grid">
        <div><span>入选年份</span>${escapeHTML(site.date_inscribed || "-")}</div>
        <div><span>濒危</span>${danger}</div>
        <div><span>面积</span>${escapeHTML(area)}</div>
        <div><span>类别</span>${escapeHTML(site.category || "-")}</div>
        <div><span>国家或地区</span>${escapeHTML(site.states_name_en || "-")}</div>
        <div><span>区域</span>${escapeHTML(site.region_en || "-")}</div>
      </div>
    </div>
  `;
}

function htmlToText(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value) {
  const number = parseFloat(value);
  if (Number.isNaN(number)) return value;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(number);
}

function normalizeCategory(category) {
  return String(category || "").trim().toLowerCase();
}

function isVisited(site) {
  return String(site.been || "").trim().toUpperCase() === "Y";
}

function splitStates(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getUniqueStates(list) {
  const set = new Set();
  list.forEach((site) => {
    splitStates(site.states_name_en).forEach((state) => set.add(state));
  });
  return Array.from(set);
}

function setupFilters() {
  const nameInput = document.getElementById("filter-name");
  const stateSelect = document.getElementById("filter-state");
  const regionSelect = document.getElementById("filter-region");

  nameInput.addEventListener("input", (event) => {
    filters.name = event.target.value.trim();
    updateUI();
  });

  setupChipGroup("filter-danger", "danger");
  setupChipGroup("filter-category", "category");
  setupChipGroup("filter-been", "been");

  stateSelect.addEventListener("change", (event) => {
    filters.state = event.target.value;
    updateUI();
  });

  regionSelect.addEventListener("change", (event) => {
    filters.region = event.target.value;
    updateUI();
  });

  populateSelect(stateSelect, allStates, "all");
  populateSelect(regionSelect, allRegions, "all");
}

function setupChipGroup(containerId, key) {
  const container = document.getElementById(containerId);
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    filters[key] = button.dataset.value;
    container
      .querySelectorAll("button")
      .forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    updateUI();
  });
}

function populateSelect(select, values, currentValue) {
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "全部";
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = currentValue;
}

function updateUI() {
  const filtered = getFilteredSites();
  updateMarkerVisibility(filtered);
  updateSummaryCounts(filtered.length);
  updateFilterCounts();
  updateStatsView();
}

function updateMarkerVisibility(filteredSites) {
  const visibleSet = new Set(filteredSites.map((site) => site._index));
  const visible = markerData.filter((d) => visibleSet.has(d.site._index));
  globe.htmlElementsData(visible);
}

function updateSummaryCounts(currentCount) {
  const totalCount = sites.length;
  const visitedCount = sites.filter((site) => isVisited(site)).length;
  const displayCurrent =
    typeof currentCount === "number" ? currentCount : totalCount;

  document.getElementById("results-count").textContent = displayCurrent;
  document.getElementById("total-count").textContent = totalCount;
  document.getElementById("visited-count").textContent = visitedCount;
}

function getFilteredSites(ignoreKey) {
  return sites.filter((site) => {
    if (ignoreKey !== "name" && filters.name) {
      const query = filters.name.toLowerCase();
      const zh = (site.name_zh || "").toLowerCase();
      const en = (site.name_en || "").toLowerCase();
      if (!zh.includes(query) && !en.includes(query)) return false;
    }

    if (ignoreKey !== "danger" && filters.danger !== "all") {
      if (site.danger !== filters.danger) return false;
    }

    if (ignoreKey !== "category" && filters.category !== "all") {
      if (site.category !== filters.category) return false;
    }

    if (ignoreKey !== "state" && filters.state !== "all") {
      const states = splitStates(site.states_name_en);
      if (!states.includes(filters.state)) return false;
    }

    if (ignoreKey !== "region" && filters.region !== "all") {
      if (site.region_en !== filters.region) return false;
    }

    if (ignoreKey !== "been" && filters.been !== "all") {
      const visited = isVisited(site);
      if (filters.been === "visited" && !visited) return false;
      if (filters.been === "not" && visited) return false;
    }

    return true;
  });
}

function updateFilterCounts() {
  updateChipCounts("filter-danger", "danger", (site) => site.danger);
  updateChipCounts("filter-category", "category", (site) => site.category);
  updateChipCounts("filter-been", "been", (site) =>
    isVisited(site) ? "visited" : "not"
  );

  updateSelectCounts("filter-state", "state", (site) =>
    splitStates(site.states_name_en)
  );
  updateSelectCounts("filter-region", "region", (site) => [site.region_en]);
}

function updateChipCounts(containerId, key, getValue) {
  const base = getFilteredSites(key);
  const counts = new Map();
  base.forEach((site) => {
    const value = getValue(site);
    if (Array.isArray(value)) {
      value.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
    } else {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  });

  const container = document.getElementById(containerId);
  container.querySelectorAll("button[data-value]").forEach((button) => {
    const value = button.dataset.value;
    const count = value === "all" ? base.length : counts.get(value) || 0;
    const countEl = button.querySelector(".chip-count");
    if (countEl) countEl.textContent = count;
    button.disabled = count === 0 && value !== "all";
  });
}

function updateSelectCounts(selectId, key, getValue) {
  const select = document.getElementById(selectId);
  const base = getFilteredSites(key);
  const counts = new Map();

  base.forEach((site) => {
    const values = getValue(site) || [];
    values
      .filter(Boolean)
      .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  });

  let currentValue = select.value;
  const values = selectId === "filter-state" ? allStates : allRegions;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = `全部 (${base.length})`;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} (${counts.get(value) || 0})`;
    if ((counts.get(value) || 0) === 0) {
      option.disabled = true;
    }
    select.appendChild(option);
  });

  const currentCount = counts.get(currentValue) || 0;
  if (!values.includes(currentValue) || currentCount === 0) {
    currentValue = "all";
  }

  select.value = currentValue;
  filters[key] = currentValue;
}

function buildStats() {
  statsAll = buildStatsForList(sites);
  statsVisited = buildStatsForList(sites.filter((site) => isVisited(site)));
}

function buildStatsForList(list) {
  const map = new Map();

  list.forEach((site) => {
    const categoryKey = normalizeCategory(site.category);
    const states = splitStates(site.states_name_en);

    states.forEach((state) => {
      if (!map.has(state)) {
        map.set(state, {
          state,
          cultural: 0,
          natural: 0,
          mixed: 0,
          total: 0,
        });
      }
      const entry = map.get(state);
      if (categoryKey === "cultural") entry.cultural += 1;
      if (categoryKey === "natural") entry.natural += 1;
      if (categoryKey === "mixed") entry.mixed += 1;
      entry.total += 1;
    });
  });

  return Array.from(map.values());
}

function setupStatsControls() {
  const tabs = document.getElementById("stats-tabs");
  const sortSelect = document.getElementById("stats-sort");

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scope]");
    if (!button) return;
    statsScope = button.dataset.scope;
    tabs
      .querySelectorAll("button")
      .forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    updateStatsView();
  });

  sortSelect.addEventListener("change", () => {
    updateStatsView();
  });
}

function updateStatsView() {
  const sortKey = document.getElementById("stats-sort").value;
  const data = statsScope === "all" ? statsAll : statsVisited;
  const sorted = data
    .slice()
    .sort((a, b) => b[sortKey] - a[sortKey] || a.state.localeCompare(b.state));

  renderStatsChart(sorted, sortKey);
}

function renderStatsChart(data, key) {
  const container = document.getElementById("stats-chart");
  container.innerHTML = "";

  if (!data.length) {
    container.textContent = "暂无数据";
    return;
  }

  data.forEach((item) => {
    const row = document.createElement("div");
    row.className = "chart-row";
    const label = document.createElement("div");
    label.className = "chart-label";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = `${item.state} (${item.total})`;
    label.appendChild(title);

    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.width = `${item.total * BAR_UNIT_PX}px`;

    const culturalSeg = document.createElement("div");
    culturalSeg.className = "chart-segment cultural";
    culturalSeg.style.width = `${item.cultural * BAR_UNIT_PX}px`;
    culturalSeg.textContent = item.cultural ? item.cultural : "";

    const naturalSeg = document.createElement("div");
    naturalSeg.className = "chart-segment natural";
    naturalSeg.style.width = `${item.natural * BAR_UNIT_PX}px`;
    naturalSeg.textContent = item.natural ? item.natural : "";

    const mixedSeg = document.createElement("div");
    mixedSeg.className = "chart-segment mixed";
    mixedSeg.style.width = `${item.mixed * BAR_UNIT_PX}px`;
    mixedSeg.textContent = item.mixed ? item.mixed : "";

    bar.appendChild(culturalSeg);
    bar.appendChild(naturalSeg);
    bar.appendChild(mixedSeg);

    row.appendChild(label);
    row.appendChild(bar);
    container.appendChild(row);
  });
}
