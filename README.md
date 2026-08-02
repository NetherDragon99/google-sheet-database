# 🚀 Google Sheets Smart Backend API

Turn your standard, boring Google Sheets into a **blazing-fast, intelligent, and highly optimized Backend API**. This script goes way beyond simple CRUD operations; it features advanced hashing, bandwidth-saving differential updates, automatic sheet pruning, and aggressive error handling.

---

## ✨ Supercharged Features

### 🛡️ 1. The Magic of "resHash" & Differential Updates (Bandwidth Saver)
Fetching thousands of rows every time a user opens your app is a massive waste of mobile data and loading time. We solved this using a **Smart Hashing System (MD5)** combined with a persistent `_Cache` sheet. Here is exactly how it works:

* **Step 1 (First Load):** Your frontend requests data. The server sends the full dataset and calculates a unique fingerprint for this exact data state called `resHash` (e.g., "a1b2c3"). You save this hash in your app's `localStorage`.
* **Step 2 (Subsequent Requests):** Next time, your app asks for data but includes the saved `resHash: "a1b2c3"` and sets `onlyChanges: true`.
* **Step 3 (The Server's Job):** * If the sheet hasn't changed at all, the server instantly replies with `status: "not_modified"`. *(0 bytes of data wasted!)*
  * If changes happened (e.g., row 5 was updated, row 10 was deleted), the server compares the row-level hashes stored securely in the `_Cache` sheet against the live sheet data.
* **Step 4 (The Smart Response):** The server sends back **ONLY** the modified/new rows in an `updated` array, and the IDs of removed rows in a `deleted` array, along with a **new** `resHash` for the next request.
* **Collision-Free:** Every specific query (e.g., filtering by "gender: male") gets its own unique hash track. Users will never receive mismatched cached data.
* **Auto-Pruning Cache:** The `_Cache` sheet cleans itself! Any cache record older than **30 days** is quietly deleted in the background so your spreadsheet never bloats.

### 🧘‍♂️ 2. Forgiving & Dynamic Inputs (Schema-less)
You don't need to send every single column in your payload, and you don't need to pre-define headers manually. 
* **Missing Data?** No problem. Leave fields empty or omit them entirely. The script will handle them gracefully without overwriting existing cell data with blanks.
* **New Columns?** If you send a new JSON key that doesn't exist in the sheet's headers yet, the script will automatically append that new column to your sheet on the fly.

### 🧹 3. Aggressive Auto-Cleanup (The Vacuum)
Google Sheets is notorious for keeping "ghost rows" (empty rows with hidden spaces) which slows down queries. This script acts like a vacuum cleaner:
* It scans the sheet from bottom to top and deletes any trailing empty rows/columns.
* It even detects and deletes **empty rows stuck in the MIDDLE of your data**. 
* Result: A perfectly clean sheet with 0 wasted space, meaning faster processing times.

### 📋 4. Automated Error Logging (`Logs` Sheet)
If a request fails silently, you won't be left in the dark. The script catches internal server errors and logs the exact Timestamp, Error Message, and the Payload that caused the crash into a dedicated `Logs` sheet.

---

## 📡 API Reference & Usage

All requests must be sent as `POST` requests. 
> **⚠️ Critical CORS Fix:** Always use `Content-Type: text/plain;charset=utf-8` and `redirect: "follow"` in your frontend `fetch` headers to prevent Google from blocking your request via CORS.

### 📖 1. Read Data (With Smart Diffing)

Fetch your data, and use `onlyChanges` to get only the updates since your last fetch.

```javascript
const response = await fetch("YOUR_WEB_APP_URL", {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  redirect: "follow",
  body: JSON.stringify({
    key: "my_secret_key",      // Security key to prevent unauthorized access
    action: "read",            // The action type
    sheetName: "users",        // Target sheet name
    where: { gender: "male" }, // (Optional) Filter results
    select: ["id", "userName"],// (Optional) Return only specific columns
    resHash: localStorage.getItem("my_hash") || "", // Pass your last known hash
    onlyChanges: true          // Enable bandwidth-saving diffs
  })
});

const result = await response.json();
```

**Understanding the Response:**
* **`status: "not_modified"`** ➔ Absolutely nothing changed. Do nothing and use your local data.
* **`result.data.isDiff === true`** ➔ Only partial changes happened. 
  * Add/Update your local state with items inside `result.data.updated`.
  * Remove items from your local state found in `result.data.deleted`.
* **`result.data.isDiff === false`** ➔ Full dataset received in `result.data.items` (happens on the very first load or if the cache expired).
* **Important:** Always save the newly received `result.data.resHash` to your LocalStorage for the next request!

---

### ✍️ 2. Write / Upsert Data

Insert a new row, or seamlessly update an existing one if it matches your primary keys.

```javascript
const response = await fetch("YOUR_WEB_APP_URL", {
  method: "POST",
  headers: { "Content-Type": "text/plain;charset=utf-8" },
  redirect: "follow",
  body: JSON.stringify({
    key: "my_secret_key",
    action: "write",
    sheetName: "users",
    checkBy: ["id"], // Tell the script to check if this ID already exists
    data: {
      id: "user_123",
      userName: "Steven",
      // Notice we left out "email" or "phone"? The script is forgiving and won't crash!
      newField: "VIP" // This will automatically create a new column called 'newField'
    }
  })
});

const result = await response.json();
```
*If `user_123` is found, their row is updated. If not, a new row is appended exactly below the last real data entry, leaving zero gaps.*

---

## ⚙️ Deployment Instructions

1. Open your Google Sheet > **Extensions** > **Apps Script**.
2. Paste the provided backend code into the editor.
3. Change `SECRET_KEY` at the top of the code to your own secure password.
4. Click **Deploy** (top right) > **New deployment**.
5. Select type: **Web app**.
6. Set **Execute as** to **Me**.
7. Set **Who has access** to **Anyone**.
8. Click **Deploy** and copy the generated Web App URL.

> **🔥 THE GOLDEN RULE:** If you ever modify the Apps Script code in the future, you **MUST** deploy a **New Version** (`Deploy` > `Manage deployments` > `Edit ✏️` > `New version`). If you just click save, Google will continue running your old code!

---
<div align="center">
  <i>Created with ❤️ by <b>Nether Dragon</b></i>
</div>