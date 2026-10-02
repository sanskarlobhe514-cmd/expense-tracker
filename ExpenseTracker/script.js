"use strict";

/* =========================================================
   MY MONEY - SUPABASE VERSION
   ========================================================= */

const SUPABASE_URL =
  "https://wksfumaieynyeasdnusd.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_zxY1MMQMkMV9CRBdk25FuQ_lfVodAa7";

const TABLE_NAME = "transactions";

let supabaseClient = null;
let currentUser = null;
let transactionsCache = [];

/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function currentMonth() {
  return localDateString().slice(0, 7);
}

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value;
  }
}

/* =========================================================
   SUPABASE
   ========================================================= */

async function loadSupabaseLibrary() {
  if (window.supabase) {
    return;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src =
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    script.onload = resolve;

    script.onerror = () => {
      reject(
        new Error("Could not load Supabase.")
      );
    };

    document.head.appendChild(script);
  });
}

async function initializeSupabase() {
  await loadSupabaseLibrary();

  supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

  const {
    data: { user },
    error
  } = await supabaseClient.auth.getUser();

  if (error) {
    console.error("Supabase auth error:", error);
    throw error;
  }

  if (!user) {
    throw new Error(
      "No logged-in user found. Please log in again."
    );
  }

  currentUser = user;

  console.log(
    "Supabase connected. User:",
    currentUser.id
  );
}

/* =========================================================
   LOAD TRANSACTIONS FROM SUPABASE
   ========================================================= */

async function loadTransactions() {
  if (!supabaseClient || !currentUser) {
    return [];
  }

  const { data, error } =
    await supabaseClient
      .from(TABLE_NAME)
      .select("*")
      .eq("user_id", currentUser.id)
      .order("transaction_date", {
        ascending: false
      });

  if (error) {
    console.error(
      "Could not load transactions:",
      error
    );

    throw error;
  }

  transactionsCache =
    (data || []).map((item) => ({
      id: item.id,
      type: item.type,
      amount: Number(item.amount),
      description: item.description || "",
      category: item.category || "",
      date:
        item.transaction_date ||
        item.date ||
        "",
      createdAt:
        item.created_at
          ? new Date(item.created_at).getTime()
          : Date.now()
    }));

  return transactionsCache;
}

function getTransactions() {
  return transactionsCache;
}

function monthTransactions(month) {
  return getTransactions().filter(
    (item) =>
      item.date &&
      item.date.startsWith(month)
  );
}

/* =========================================================
   TOTALS
   ========================================================= */

function totals(transactions) {
  const income =
    transactions
      .filter(
        (item) =>
          item.type === "income"
      )
      .reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );

  const expenses =
    transactions
      .filter(
        (item) =>
          item.type === "expense"
      )
      .reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );

  return {
    income,
    expenses,
    balance: income - expenses
  };
}

/* =========================================================
   TRANSACTION HTML
   ========================================================= */

function transactionMarkup(
  item,
  showDelete = false
) {
  const isIncome =
    item.type === "income";

  const sign =
    isIncome ? "+" : "−";

  const amountClass =
    isIncome
      ? "income-text"
      : "expense-text";

  const symbol =
    isIncome ? "↗" : "↙";

  const description =
    item.description ||
    (isIncome
      ? "Income"
      : "Expense");

  const category =
    isIncome
      ? "Income"
      : (item.category || "Other");

  return `
    <div class="transaction-row">

      <div class="transaction-icon">
        ${symbol}
      </div>

      <div class="transaction-info">

        <p class="transaction-title">
          ${escapeHTML(description)}
        </p>

        <p class="transaction-meta">
          ${escapeHTML(category)}
          ·
          ${escapeHTML(
            formatDate(item.date)
          )}
        </p>

      </div>

      <div class="transaction-actions">

        <span class="transaction-amount ${amountClass}">
          ${sign}${money(item.amount)}
        </span>

        ${
          showDelete
            ? `
              <button
                class="delete-button"
                type="button"
                data-delete="${escapeHTML(item.id)}">
                Delete
              </button>
            `
            : ""
        }

      </div>

    </div>
  `;
}

function renderTransactionList(
  element,
  transactions,
  showDelete = false
) {
  if (!element) return;

  if (transactions.length === 0) {
    element.innerHTML = `
      <div class="empty-state">
        No entries found.
        Add your first income or expense!
      </div>
    `;

    return;
  }

  element.innerHTML =
    transactions
      .map((item) =>
        transactionMarkup(
          item,
          showDelete
        )
      )
      .join("");
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const monthInput =
    $("dashboardMonth");

  if (!monthInput) return;

  const month =
    monthInput.value ||
    currentMonth();

  const transactions =
    monthTransactions(month);

  const summary =
    totals(transactions);

  setText(
    "totalIncome",
    money(summary.income)
  );

  setText(
    "totalExpenses",
    money(summary.expenses)
  );

  setText(
    "totalBalance",
    money(summary.balance)
  );

  setText(
    "moneyLeft",
    money(
      Math.max(
        0,
        summary.balance
      )
    )
  );

  const note =
    $("moneyLeftNote");

  if (note) {
    note.textContent =
      summary.balance < 0
        ? "You spent more than your income"
        : "Your remaining money";
  }

  const recent =
    [...transactions]
      .sort(
        (a, b) =>
          b.date.localeCompare(
            a.date
          ) ||
          Number(
            b.createdAt || 0
          ) -
          Number(
            a.createdAt || 0
          )
      )
      .slice(0, 6);

  renderTransactionList(
    $("recentTransactions"),
    recent
  );

  renderCategoryBreakdown(
    transactions
  );

  renderMonthlyChart();
}

function initializeDashboard() {
  const monthInput =
    $("dashboardMonth");

  if (!monthInput) return;

  monthInput.value =
    currentMonth();

  monthInput.addEventListener(
    "change",
    renderDashboard
  );

  renderDashboard();
}

/* =========================================================
   CATEGORY BREAKDOWN
   ========================================================= */

function renderCategoryBreakdown(
  transactions
) {
  const element =
    $("categoryBreakdown");

  if (!element) return;

  const expenses =
    transactions.filter(
      (item) =>
        item.type === "expense"
    );

  const categoryTotals = {};

  expenses.forEach((item) => {
    const category =
      item.category || "Other";

    categoryTotals[category] =
      (categoryTotals[category] || 0) +
      Number(item.amount);
  });

  const entries =
    Object.entries(
      categoryTotals
    ).sort(
      (a, b) => b[1] - a[1]
    );

  const totalExpense =
    expenses.reduce(
      (sum, item) =>
        sum + Number(item.amount),
      0
    );

  if (entries.length === 0) {
    element.innerHTML = `
      <div class="empty-state">
        No expenses recorded this month.
      </div>
    `;

    return;
  }

  element.innerHTML =
    entries
      .map(
        ([category, amount]) => {

          const percentage =
            totalExpense > 0
              ? (amount /
                  totalExpense) *
                100
              : 0;

          return `
            <div>

              <div class="category-heading">
                <span>
                  ${escapeHTML(category)}
                </span>

                <span>
                  ${money(amount)}
                </span>
              </div>

              <div class="progress-track">

                <div
                  class="progress-fill"
                  style="width:${percentage.toFixed(1)}%">
                </div>

              </div>

            </div>
          `;
        }
      )
      .join("");
}

/* =========================================================
   MONTHLY CHART
   ========================================================= */

function renderMonthlyChart() {
  const element =
    $("monthlyChart");

  if (!element) return;

  const now =
    new Date();

  const months = [];

  for (
    let offset = 5;
    offset >= 0;
    offset--
  ) {

    const date =
      new Date(
        now.getFullYear(),
        now.getMonth() -
          offset,
        1
      );

    const key =
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

    const summary =
      totals(
        monthTransactions(key)
      );

    months.push({
      key,

      label:
        date.toLocaleDateString(
          "en-IN",
          { month: "short" }
        ),

      income:
        summary.income,

      expenses:
        summary.expenses
    });
  }

  const maxValue =
    Math.max(
      1,
      ...months.flatMap(
        (month) => [
          month.income,
          month.expenses
        ]
      )
    );

  element.innerHTML =
    months
      .map((month) => {

        const incomeHeight =
          (month.income /
            maxValue) *
          100;

        const expenseHeight =
          (month.expenses /
            maxValue) *
          100;

        return `
          <div
            class="month-column"
            title="${escapeHTML(
              month.key
            )}">

            <div class="bar-pair">

              <div
                class="chart-bar income-bar"
                style="height:${incomeHeight}%">
              </div>

              <div
                class="chart-bar expense-bar"
                style="height:${expenseHeight}%">
              </div>

            </div>

            <span class="month-label">
              ${escapeHTML(
                month.label
              )}
            </span>

          </div>
        `;
      })
      .join("");
}

/* =========================================================
   ADD ENTRY FORM
   ========================================================= */

function initializeAddForm() {

  const form =
    $("transactionForm");

  if (!form) return;

  const typeInput =
    $("transactionType");

  const categoryDetails =
    $("expenseDetails");

  const categoryInput =
    $("category");

  const dateInput =
    $("date");

  const descriptionInput =
    $("description");

  const message =
    $("formMessage");

  const typeButtons =
    document.querySelectorAll(
      ".type-choice"
    );

  if (
    !typeInput ||
    !categoryDetails ||
    !categoryInput ||
    !dateInput ||
    !descriptionInput
  ) {
    console.error(
      "Required form element is missing."
    );

    return;
  }

  dateInput.value =
    localDateString();

  function selectType(type) {

    typeInput.value =
      type;

    typeButtons.forEach(
      (button) => {

        const active =
          button.dataset.type ===
          type;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      }
    );

    categoryDetails.hidden =
      type === "income";

    categoryInput.required =
      type === "expense";

    descriptionInput.placeholder =
      type === "income"
        ? "e.g. Salary, gift, other income"
        : "e.g. Lunch, groceries, bus ticket";

    if (message) {
      message.textContent = "";
    }
  }

  typeButtons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const type =
            button.dataset.type;

          if (
            type === "income" ||
            type === "expense"
          ) {
            selectType(type);
          }
        }
      );
    }
  );

  selectType("expense");

  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const amount =
        Number(
          $("amount").value
        );

      const type =
        typeInput.value;

      const description =
        descriptionInput
          .value
          .trim();

      const date =
        dateInput.value;

      const category =
        type === "expense"
          ? categoryInput.value
          : "";

      if (
        !["income", "expense"]
          .includes(type)
      ) {
        message.textContent =
          "Please choose Income or Expense.";

        return;
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        message.textContent =
          "Enter an amount greater than zero.";

        $("amount").focus();

        return;
      }

      if (
        !description ||
        !date
      ) {
        message.textContent =
          "Please complete all required fields.";

        return;
      }

      if (
        !supabaseClient ||
        !currentUser
      ) {
        message.textContent =
          "You are not logged in.";

        return;
      }

      message.textContent =
        "Saving...";

      try {

        const { data, error } =
          await supabaseClient
            .from(TABLE_NAME)
            .insert({
              user_id:
                currentUser.id,

              type:
                type,

              amount:
                amount,

              description:
                description,

              category:
                category,

              transaction_date:
                date
            })
            .select()
            .single();

        if (error) {
          throw error;
        }

        console.log(
          "Transaction saved:",
          data
        );

        await loadTransactions();

        message.textContent =
          "Transaction saved successfully!";

        form.reset();

        dateInput.value =
          localDateString();

        selectType(
          "expense"
        );

        renderDashboard();
        renderHistory();

        $("amount").focus();

      } catch (error) {

        console.error(
          "Save transaction error:",
          error
        );

        message.textContent =
          `Could not save: ${error.message}`;
      }
    }
  );
}

/* =========================================================
   HISTORY
   ========================================================= */

function getFilteredTransactions() {

  const monthInput =
    $("historyMonth");

  const typeInput =
    $("typeFilter");

  const searchInput =
    $("searchInput");

  const month =
    monthInput
      ? monthInput.value
      : "";

  const type =
    typeInput
      ? typeInput.value
      : "all";

  const query =
    searchInput
      ? searchInput.value
          .trim()
          .toLowerCase()
      : "";

  return getTransactions()
    .filter(
      (item) =>
        !month ||
        item.date.startsWith(month)
    )
    .filter(
      (item) =>
        type === "all" ||
        item.type === type
    )
    .filter(
      (item) =>
        `${item.description || ""} ${
          item.category || ""
        }`
          .toLowerCase()
          .includes(query)
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(
          a.date
        ) ||
        Number(
          b.createdAt || 0
        ) -
        Number(
          a.createdAt || 0
        )
    );
}

function renderHistory() {

  const list =
    $("allTransactions");

  if (!list) return;

  const monthInput =
    $("historyMonth");

  const month =
    monthInput
      ? monthInput.value
      : currentMonth();

  const summary =
    totals(
      monthTransactions(month)
    );

  const filtered =
    getFilteredTransactions();

  setText(
    "historyIncome",
    money(summary.income)
  );

  setText(
    "historyExpenses",
    money(summary.expenses)
  );

  setText(
    "historyBalance",
    money(summary.balance)
  );

  setText(
    "transactionCount",
    `${filtered.length} ${
      filtered.length === 1
        ? "entry"
        : "entries"
    } shown`
  );

  renderTransactionList(
    list,
    filtered,
    true
  );
}

function initializeHistory() {

  const monthInput =
    $("historyMonth");

  if (!monthInput) return;

  monthInput.value =
    currentMonth();

  $("historyMonth")
    ?.addEventListener(
      "change",
      renderHistory
    );

  $("typeFilter")
    ?.addEventListener(
      "change",
      renderHistory
    );

  $("searchInput")
    ?.addEventListener(
      "input",
      renderHistory
    );

  $("clearFilters")
    ?.addEventListener(
      "click",
      () => {

        monthInput.value =
          currentMonth();

        $("typeFilter").value =
          "all";

        $("searchInput").value =
          "";

        renderHistory();
      }
    );

  $("allTransactions")
    ?.addEventListener(
      "click",
      async (event) => {

        const button =
          event.target.closest(
            "[data-delete]"
          );

        if (!button) return;

        const id =
          button.dataset.delete;

        if (
          !confirm(
            "Delete this transaction?"
          )
        ) {
          return;
        }

        try {

          const { error } =
            await supabaseClient
              .from(TABLE_NAME)
              .delete()
              .eq("id", id)
              .eq(
                "user_id",
                currentUser.id
              );

          if (error) {
            throw error;
          }

          await loadTransactions();

          renderHistory();
          renderDashboard();

        } catch (error) {

          console.error(
            "Delete error:",
            error
          );

          alert(
            `Could not delete: ${error.message}`
          );
        }
      }
    );

  $("exportCsv")
    ?.addEventListener(
      "click",
      exportCsv
    );

  renderHistory();
}

/* =========================================================
   CSV EXPORT
   ========================================================= */

function exportCsv() {

  const transactions =
    getFilteredTransactions();

  if (transactions.length === 0) {
    alert(
      "There are no entries to export."
    );

    return;
  }

  function quoteCsv(value) {
    return `"${String(
      value ?? ""
    ).replace(
      /"/g,
      '""'
    )}"`;
  }

  const rows = [
    [
      "Date",
      "Type",
      "Description",
      "Category",
      "Amount"
    ],

    ...transactions.map(
      (item) => [
        item.date,

        item.type === "income"
          ? "Income"
          : "Expense",

        item.description || "",

        item.category || "",

        Number(item.amount)
          .toFixed(2)
      ]
    )
  ];

  const csv =
    "\uFEFF" +
    rows
      .map(
        (row) =>
          row
            .map(quoteCsv)
            .join(",")
      )
      .join("\r\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `my-money-${currentMonth()}.csv`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

/* =========================================================
   START APP
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      await initializeSupabase();

      await loadTransactions();

      initializeDashboard();

      initializeAddForm();

      initializeHistory();

      renderDashboard();

      renderHistory();

      console.log(
        "My Money connected to Supabase successfully."
      );

    } catch (error) {

      console.error(
        "Startup error:",
        error
      );

      const message =
        $("formMessage");

      if (message) {
        message.textContent =
          error.message;
      }
    }
  }
);