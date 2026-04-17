type RuntimeRequire = (id: string) => unknown;

function getRuntimeRequire(): RuntimeRequire | null {
  const candidate = (globalThis as { require?: unknown }).require;
  return typeof candidate === "function" ? candidate as RuntimeRequire : null;
}

export async function tryCopyToClipboard(text: string): Promise<boolean> {
  if (!text.trim()) {
    return false;
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // Continue to Electron clipboard fallback.
  }

  try {
    const runtimeRequire = getRuntimeRequire();
    if (!runtimeRequire) {
      return false;
    }
    const electron = runtimeRequire("electron") as { clipboard?: { writeText?: (value: string) => void } };
    if (typeof electron.clipboard?.writeText === "function") {
      electron.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    return false;
  }

  return false;
}
