<div align="center">
  <h1>🚀 Smart Sheets API</h1>
  <p><b>Transform Google Sheets into a fast, dynamic, and self-cleaning NoSQL Database.</b></p>
</div>

---

## 🌟 Overview

Tired of setting up complex backend servers and databases for small projects or MVPs? 
This script turns any Google Sheet into a fully-fledged, smart API. It is incredibly easy to use, supports dynamic schemas, and automatically cleans up after itself to keep your data lightweight and fast.

## ✨ Key Features

- **Basic Security** — Built-in Secret Key validation prevents unauthorized access.
- **Dynamic Schema** — Sending data with new columns? The script automatically creates the headers in the sheet!
- **Smart Upsert** — Define columns to check against. Match found? It updates. No match? It inserts.
- **Advanced Queries** — Filter data using `where` conditions and limit returned fields using `select`.
- **Forgiving Inputs (DX)** — Forgot to send an Array? Passing a single String like `select: "email"` or `checkBy: "phone"` works perfectly. Missing keys are handled gracefully without crashing.
- **Data Caching (`resHash`)** — Generates a data hash. Send it back in your next request to receive a `not_modified` response if nothing changed, saving bandwidth.
- **Garbage Collection** — Automatically deletes empty rows and columns after every operation.
- **Standardized Response** — Clean, predictable JSON format for every request.

---

## 🛠️ Installation

1. Create a new [Google Sheet](https://sheets.new/).
2. From the top menu, select **Extensions** > **Apps Script**.
3. Delete the default code and paste the contents of `script.js` (from this repository) into the editor.
4. Update the `SECRET_KEY` on line 1 with your own secure password.
5. Click **Deploy** > **New Deployment**.
6. Select the type as **Web App** and set **Who has access** to **Anyone**.
7. Copy the generated **Web App URL**. This is your API Endpoint! 🎉

---

## 📖 API Reference & Usage

> **Note:** All requests must be `POST` requests and contain a JSON payload.

### 1. Read Data
Fetch all data, filter by conditions, or select specific columns.

~~~javascript
fetch("YOUR_API_URL", {
  method: "POST",
  body: JSON.stringify({
    key: "my_secret_key", // Required
    action: "read",       // Required
    sheetName: "Users",   
    
    // Optional Settings:
    where: { status: "active", age: 25 }, 
    select: "email",      // Pro Tip: You can pass a String instead of an Array for a single column!
  })
});
~~~

### 2. The Power of `resHash` (Caching Example)
To save bandwidth and load times, you can use the `resHash` feature. The API generates a unique fingerprint for your requested data.

~~~javascript
// 1. Get the previously saved hash (if any)
const savedHash = localStorage.getItem("my_users_hash") || "";

fetch("YOUR_API_URL", {
  method: "POST",
  body: JSON.stringify({
    key: "my_secret_key",
    action: "read",
    sheetName: "Users",
    resHash: savedHash // 2. Send the hash to the server
  })
})
.then(res => res.json())
.then(result => {
  
  if (result.status === "not_modified") {
    console.log("⚡ Data unchanged! Use your locally cached data.");
    // Do not update UI, just use existing data.
  } 
  
  else if (result.status === "success") {
    console.log("🔄 New data received!", result.data.items);
    // 3. Save the NEW hash for the next time
    localStorage.setItem("my_users_hash", result.data.resHash);
  }

});
~~~

### 3. Write / Upsert Data
Insert new rows or update existing ones seamlessly.

~~~javascript
fetch("YOUR_API_URL", {
  method: "POST",
  body: JSON.stringify({
    key: "my_secret_key",
    action: "write",
    sheetName: "Users",
    
    // Check if the "phone" exists. 
    // Yes -> Update. No -> Insert.
    checkBy: "phone", // Pro Tip: String accepted instead of ["phone"]
    
    data: {
      phone: "01012345678",
      name: "John Doe",
      new_column: "Auto-created!"
    }
  })
});
~~~

---

## 📥 Response Format

The API always returns a predictable JSON object containing `status` and `data`.

### Read Success
~~~json
{
  "status": "success",
  "data": {
    "items": [{"name": "John Doe", "phone": "01012345678"}],
    "count": 1,
    "resHash": "f5e6d7c8"
  }
}
~~~

### Not Modified (Cache Hit)
~~~json
{
  "status": "not_modified",
  "data": {
    "resHash": "f5e6d7c8",
    "message": "لم تتغير البيانات"
  }
}
~~~

### Write Success
~~~json
{
  "status": "success",
  "data": {
    "action": "updated", 
    "message": "تم تحديث البيانات بنجاح"
  }
}
~~~

### Error
~~~json
{
  "status": "error",
  "data": "Access Denied: Invalid Secret Key"
}
~~~

---

## 📝 Error Logging

No more silent failures! If the script encounters a runtime error, it automatically creates a sheet named **`Logs`** and records the timestamp, error message, and the exact payload that caused it. This makes debugging effortless.

---
<div align="center">
  <i>Created with ❤️ by <b>Nether Dragon</b></i>
</div>
