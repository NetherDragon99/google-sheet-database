const SECRET_KEY = "my_secret_key"; 

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  let payload = {};
  
  try {
    if (!e.postData || !e.postData.contents) {
      return sendResponse("error", "No data sent in the request");
    }

    payload = JSON.parse(e.postData.contents);
    
    if (payload.key !== SECRET_KEY) {
      return sendResponse("error", "Access Denied: Invalid Secret Key");
    }

    const sheetName = payload.sheetName;
    if (!sheetName || typeof sheetName !== "string" || sheetName.trim() === "") {
      return sendResponse("error", "Sheet name (sheetName) is missing or invalid");
    }

    const action = payload.action; 
    
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);
    }

    let result = {};

    if (action === "read") {
      result = handleRead(sheet, payload);
    } else if (action === "write") {
      result = handleWrite(sheet, payload);
    } else {
      return sendResponse("error", "Action type (action) is unknown or missing");
    }

    cleanEmptySpace(sheet);

    return sendResponse(result.status, result.data);

  } catch (error) {
    logError(error, payload);
    return sendResponse("error", "Internal server error: " + error.message);
  } finally {
    lock.releaseLock();
  }
}

// =====================================
// Read System
// =====================================
function handleRead(sheet, payload) {
  let where = payload.where;
  if (typeof where !== 'object' || where === null || Array.isArray(where)) where = {};

  let select = payload.select;
  if (typeof select === 'string' && select.trim() !== "") select = [select.trim()];
  else if (!Array.isArray(select)) select = [];

  const resHash = payload.resHash || ""; 

  const dataRange = sheet.getDataRange().getValues();
  if (dataRange.length === 0 || dataRange[0].length === 0 || dataRange[0][0] === "") {
    return { status: "success", data: { items: [], count: 0, resHash: "" } };
  }

  const headers = dataRange.shift(); 
  let results = [];
  const hasWhereConditions = Object.keys(where).length > 0;

  for (let i = 0; i < dataRange.length; i++) {
    const row = dataRange[i];
    let rowObj = {};
    headers.forEach((h, index) => { if (h) rowObj[h] = row[index]; });

    let isMatch = true;
    if (hasWhereConditions) {
      for (let key in where) {
        if (rowObj[key] != where[key]) { isMatch = false; break; }
      }
    }

    if (isMatch) {
      if (select.length > 0) {
        let selectedObj = {};
        select.forEach(col => { if (rowObj[col] !== undefined) selectedObj[col] = rowObj[col]; });
        results.push(selectedObj);
      } else {
        results.push(rowObj);
      }
    }
  }

  const currentHash = generateHash(results);

  if (resHash && resHash === currentHash) {
    return { status: "not_modified", data: { resHash: currentHash, message: "Data not modified" } };
  }

  return { status: "success", data: { items: results, count: results.length, resHash: currentHash } };
}

// =====================================
// Write / Upsert System
// =====================================
function handleWrite(sheet, payload) {
  let data = payload.data; 
  if (typeof data !== 'object' || data === null || Array.isArray(data) || Object.keys(data).length === 0) {
    return { status: "error", data: "No valid data provided for insertion or update" };
  }

  let checkBy = payload.checkBy;
  if (typeof checkBy === 'string' && checkBy.trim() !== "") checkBy = [checkBy.trim()];
  else if (!Array.isArray(checkBy)) checkBy = [];

  const headers = getAndSyncHeaders(sheet, data);
  const allValues = sheet.getDataRange().getValues();
  
  let foundRowIndex = -1;

  if (checkBy.length > 0 && allValues.length > 1) {
    for (let i = 1; i < allValues.length; i++) {
      let isMatch = true;
      for (let j = 0; j < checkBy.length; j++) {
        let colName = checkBy[j];
        let colIndex = headers.indexOf(colName);
        if (colIndex === -1 || allValues[i][colIndex] != data[colName]) {
          isMatch = false; break;
        }
      }
      if (isMatch) { foundRowIndex = i; break; }
    }
  }

  if (foundRowIndex > -1) {
    let rowToUpdate = headers.map((h, idx) => data[h] !== undefined ? data[h] : allValues[foundRowIndex][idx]);
    sheet.getRange(foundRowIndex + 1, 1, 1, headers.length).setValues([rowToUpdate]);
    return { status: "success", data: { action: "updated", message: "Data updated successfully" } };
  } else {
    let newRow = headers.map(h => data[h] !== undefined ? data[h] : "");
    sheet.appendRow(newRow);
    return { status: "success", data: { action: "inserted", message: "New data inserted successfully" } };
  }
}

// =====================================
// Helper Functions
// =====================================

function sendResponse(status, dataContent) {
  const responseObj = { status: status, data: dataContent };
  return ContentService.createTextOutput(JSON.stringify(responseObj))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateHash(dataObj) {
  if (!dataObj || dataObj.length === 0) return "";
  const rawString = JSON.stringify(dataObj);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, rawString, Utilities.Charset.UTF_8);
  let hex = "";
  for (let i = 0; i < digest.length; i++) {
    let byte = digest[i];
    if (byte < 0) byte += 256;
    let byteStr = byte.toString(16);
    if (byteStr.length == 1) byteStr = "0" + byteStr;
    hex += byteStr;
  }
  return hex;
}

function getAndSyncHeaders(sheet, dataObj) {
  let headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  let modified = false;
  Object.keys(dataObj).forEach(key => {
    if (key && !headers.includes(key)) {
      headers.push(key);
      modified = true; 
    }
  });

  if (modified && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return headers;
}

function cleanEmptySpace(sheet) {
  const maxRows = sheet.getMaxRows();
  const lastRow = sheet.getLastRow();
  if (maxRows > lastRow && lastRow > 0) sheet.deleteRows(lastRow + 1, maxRows - lastRow);

  const maxCols = sheet.getMaxColumns();
  const lastCol = sheet.getLastColumn();
  if (maxCols > lastCol && lastCol > 0) sheet.deleteColumns(lastCol + 1, maxCols - lastCol);
}

function logError(error, payload) {
  let logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Logs");
  if (!logSheet) {
    logSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("Logs");
    logSheet.appendRow(["Timestamp", "Error", "Payload"]);
  }
  const safePayload = payload ? JSON.stringify(payload) : "No Payload";
  logSheet.appendRow([new Date(), error.message, safePayload]);
          }
