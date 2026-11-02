export function allowNavigation() { return window.dispatchEvent(new Event("qc:before-navigate", { cancelable: true })); }
