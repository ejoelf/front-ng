// src/utils/toast.js

function show(opts) {
  // ToastProvider expone show en window cuando está montado
  const fn = window.__toastShow;
  if (typeof fn !== "function") {
    // fallback sin romper
    console.warn("ToastProvider no está montado. Toast ignorado:", opts);
    return null;
  }
  return fn(opts);
}

export const toast = {
  info(message, title = "") {
    return show({ type: "info", title, message });
  },
  success(message, title = "") {
    return show({ type: "success", title, message });
  },
  error(message, title = "") {
    return show({ type: "error", title, message });
  },
  warning(message, title = "") {
    return show({ type: "warning", title, message });
  },
};
