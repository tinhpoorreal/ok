const data = window.CASHBACK_DATA || { summary: [], cards: [], openQuestions: [] };

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const state = {
  query: "",
  category: "all",
  bank: "all",
  verifyQuery: "",
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function extractUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s|]+/);
  return match ? match[0] : "";
}

function renderMetrics() {
  const totalCards = data.totalCards || data.cards.length;
  const banks = unique(data.cards.map((card) => card.bank));
  const enriched = data.cards.filter((card) => normalize(card.cashback).includes("%") || normalize(card.cashback).includes("diem")).length;

  document.querySelector("#totalCards").textContent = totalCards.toLocaleString("vi-VN");
  document.querySelector("#totalBanks").textContent = banks.length.toLocaleString("vi-VN");
  document.querySelector("#enrichedCards").textContent = enriched.toLocaleString("vi-VN");
  document.querySelector("#openQuestions").textContent = (data.totalOpenQuestions || data.openQuestions.length).toLocaleString("vi-VN");
}

function renderCategoryBars() {
  const container = document.querySelector("#categoryBars");
  const max = Math.max(...data.summary.map((item) => Number(item.count) || 0));

  container.innerHTML = data.summary
    .map((item) => {
      const percent = max ? ((Number(item.count) || 0) / max) * 100 : 0;
      return `
        <div class="bar-row">
          <strong>${escapeHtml(item.category)}</strong>
          <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
          <span>${escapeHtml(item.count)}</span>
        </div>
      `;
    })
    .join("");
}

function renderFilters() {
  const categories = unique(data.cards.map((card) => card.category));
  const banks = unique(data.cards.map((card) => card.bank));
  const categoryFilter = document.querySelector("#categoryFilter");
  const bankFilter = document.querySelector("#bankFilter");

  categoryFilter.innerHTML = `<option value="all">Tất cả danh mục</option>${categories.map((category) => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`).join("")}`;
  bankFilter.innerHTML = `<option value="all">Tất cả ngân hàng</option>${banks.map((bank) => `<option value="${escapeAttr(bank)}">${escapeHtml(bank)}</option>`).join("")}`;
}

function filteredCards() {
  const q = normalize(state.query);
  return data.cards.filter((card) => {
    const matchesCategory = state.category === "all" || card.category === state.category;
    const matchesBank = state.bank === "all" || card.bank === state.bank;
    const text = normalize([card.category, card.bank, card.name, card.cashback, card.cap, card.fee, card.note].join(" "));
    return matchesCategory && matchesBank && text.includes(q);
  });
}

function renderCards() {
  const cards = filteredCards().slice(0, 60);
  const container = document.querySelector("#cardGrid");

  if (!cards.length) {
    container.innerHTML = `<p class="muted">Không tìm thấy thẻ phù hợp.</p>`;
    return;
  }

  container.innerHTML = cards
    .map((card) => {
      const needsVerify = normalize(card.note).includes("verify") || normalize(card.note).includes("can ") || !card.cashback;
      const sourceUrl = card.url || extractUrl(card.note);
      return `
        <article class="card-item">
          <div class="card-meta">
            <span class="pill">${escapeHtml(card.category)}</span>
            <span class="pill">${escapeHtml(card.bank)}</span>
            ${needsVerify ? `<span class="pill warn">Cần kiểm tra</span>` : ""}
          </div>
          <h3>${escapeHtml(card.name || "Chưa có tên thẻ")}</h3>
          <p><strong>Ưu đãi:</strong> ${escapeHtml(card.cashback || "Chưa cập nhật")}</p>
          <p><strong>Trần:</strong> ${escapeHtml(card.cap || "Chưa rõ")} · <strong>PTN:</strong> ${escapeHtml(card.fee || "Chưa rõ")}</p>
          <p>${escapeHtml(card.note || "Không có ghi chú bổ sung.")}</p>
          ${sourceUrl ? `<a href="${escapeAttr(sourceUrl)}" target="_blank" rel="noreferrer">Mở nguồn RCGV</a>` : ""}
        </article>
      `;
    })
    .join("");
}

function calculateCashback() {
  const spend = Number(document.querySelector("#spendAmount").value) || 0;
  const rate = Number(document.querySelector("#cashbackRate").value) || 0;
  const cap = Number(document.querySelector("#monthlyCap").value) || 0;
  const raw = spend * (rate / 100);
  const monthly = cap > 0 ? Math.min(raw, cap) : raw;
  const yearly = monthly * 12;

  document.querySelector("#calculatorResult").textContent = `${currency.format(monthly)} / tháng · ${currency.format(yearly)} / năm`;
}

function renderVerifyRows() {
  const q = normalize(state.verifyQuery);
  const rows = data.openQuestions
    .filter((item) => normalize([item.category, item.bank, item.name, item.reason].join(" ")).includes(q))
    .slice(0, 120);

  document.querySelector("#verifyRows").innerHTML = rows
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(item.bank)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.reason)}</td>
        </tr>
      `,
    )
    .join("");
}

function bindEvents() {
  document.querySelector("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderCards();
  });
  document.querySelector("#categoryFilter").addEventListener("change", (event) => {
    state.category = event.target.value;
    renderCards();
  });
  document.querySelector("#bankFilter").addEventListener("change", (event) => {
    state.bank = event.target.value;
    renderCards();
  });
  document.querySelector("#verifySearch").addEventListener("input", (event) => {
    state.verifyQuery = event.target.value;
    renderVerifyRows();
  });
  document.querySelector("#calculatorForm").addEventListener("input", calculateCashback);
}

renderMetrics();
renderCategoryBars();
renderFilters();
renderCards();
renderVerifyRows();
calculateCashback();
bindEvents();
