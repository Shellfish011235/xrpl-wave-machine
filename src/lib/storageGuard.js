/*
 * Embedded previews and privacy-restricted browsers can expose localStorage
 * while throwing SecurityError on writes. The app should keep running even
 * when persistence is unavailable.
 */
export function installStorageGuard() {
  if (typeof window === "undefined" || typeof Storage === "undefined") return;

  try {
    const originalSetItem = Storage.prototype.setItem;
    if (originalSetItem.__waveMachineGuarded) return;

    function guardedSetItem(key, value) {
      try {
        return originalSetItem.call(this, key, value);
      } catch (error) {
        console.warn(`[Wave Machine] Storage write skipped for ${String(key)}:`, error);
        return undefined;
      }
    }

    guardedSetItem.__waveMachineGuarded = true;
    Storage.prototype.setItem = guardedSetItem;
  } catch (error) {
    console.warn("[Wave Machine] Could not install storage guard:", error);
  }
}
