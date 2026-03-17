(function () {
  "use strict";

  const API_BASE_URL = window.location.origin;

  function executeMethod(name, params) {
    return new Promise((resolve) => {
      window.Asc.plugin.executeMethod(name, params, function (result) {
        resolve(result);
      });
    });
  }

  function callCommand(fn, isNoCalc, isRecalc) {
    return new Promise((resolve) => {
      window.Asc.plugin.callCommand(fn, isNoCalc, isRecalc);
      window.Asc.plugin.onCommandCallback = function (result) {
        window.Asc.plugin.onCommandCallback = null;
        resolve(result);
      };
    });
  }

  function getEditorSelectionOptions() {
    return {
      Numbering: false,
      Math: false,
      TableCellSeparator: "\n",
      ParaSeparator: "\n",
      TabSymbol: String.fromCharCode(9)
    };
  }

  async function getSelectedText() {
    const text = await executeMethod("GetSelectedText", [getEditorSelectionOptions()]);
    return (text || "").trim();
  }

  async function apiGet(path) {
    const response = await fetch(`${API_BASE_URL}${path}`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  }

  async function apiPost(path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  }

  async function apiPut(path, body) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  }

  async function apiDelete(path) {
    const response = await fetch(`${API_BASE_URL}${path}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  }

  function setStatus(message) {
    const el = document.getElementById("statusText");
    if (el) el.textContent = message;
  }

  function setBusy(isBusy) {
    document.querySelectorAll("button").forEach((btn) => {
      btn.disabled = isBusy;
    });
  }

  window.RG = window.RG || {};
  Object.assign(window.RG, {
    API_BASE_URL,
    executeMethod,
    callCommand,
    getSelectedText,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    setStatus,
    setBusy
  });
})();
