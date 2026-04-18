const ICONS = {
  cultural: "assets/cultural.png",
  natural: "assets/natural.png",
  mixed: "assets/mixed.png",
};

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0a1020" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a1020" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6fa3ff" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#1f2b40" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#101c33" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#17243a" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#22334f" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#131e33" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0c1f2e" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4dcfe4" }],
  },
];

let map;
let infoWindow;
let sites = [];
let markers = [];
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

window.initMap = async function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 20, lng: 0 },
    zoom: 2,
    styles: MAP_STYLE,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: "greedy",
  });

  infoWindow = new google.maps.InfoWindow({ maxWidth: 320 });

  await loadData();
  setupFilters();
  setupStatsControls();
  updateUI();
};

async function loadData() {
  const response = await fetch("data/whc-sites-2025.csv");
  const text = await response.text();
  const rows = parseCSV(text);

  sites = rows
    .map((row, index) => ({
      ...row,
      _index: index,
    }))
    .filter((row) => row.latitude && row.longitude);

  allStates = getUniqueStates(sites).sort((a, b) => a.localeCompare(b));
  allRegions = Array.from(
    new Set(sites.map((site) => site.region_en).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  createMarkers();
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

function createMarkers() {
  const bounds = new google.maps.LatLngBounds();

  markers = sites
    .map((site) => {
      const lat = parseFloat(site.latitude);
      const lng = parseFloat(site.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }

      const visited = isVisited(site);
      const categoryKey = normalizeCategory(site.category);
      const iconUrl = ICONS[categoryKey] || ICONS.cultural;
      const iconSize = visited ? 36 : 30;

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        icon: {
          url: iconUrl,
          scaledSize: new google.maps.Size(iconSize, iconSize),
          anchor: new google.maps.Point(iconSize / 2, iconSize / 2),
          labelOrigin: new google.maps.Point(iconSize / 2, iconSize / 2),
        },
        label: visited
          ? {
              text: "✓",
              color: "#00f6ff",
              fontWeight: "900",
              fontSize: "20px",
            }
          : null,
        optimized: true,
        zIndex: visited ? 999 : 1,
        title: site.name_en || site.name_zh || "World Heritage",
      });

      marker.addListener("click", () => {
        infoWindow.setContent(renderInfoWindow(site));
        infoWindow.open(map, marker);
      });

      bounds.extend({ lat, lng });

      return { marker, site };
    })
    .filter(Boolean);

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds);
  }
}

function renderInfoWindow(site) {
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
  return String(category || "")
    .trim()
    .toLowerCase();
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
  markers.forEach(({ marker, site }) => {
    marker.setVisible(visibleSet.has(site._index));
  });
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
