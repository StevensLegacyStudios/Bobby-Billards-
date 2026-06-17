import { AutoDevProvider } from "./autodev";
import { MockProvider } from "./mock";
import type { Car, InventoryProvider, SearchQuery } from "./types";

export type { Car, SearchQuery } from "./types";

function selectProvider(): { provider: InventoryProvider; live: boolean } {
  const choice = (process.env.INVENTORY_PROVIDER || "auto").toLowerCase();
  const key = process.env.AUTODEV_API_KEY;

  if (choice === "mock") return { provider: new MockProvider(), live: false };
  if ((choice === "autodev" || choice === "auto") && key) {
    return { provider: new AutoDevProvider(key), live: true };
  }
  return { provider: new MockProvider(), live: false };
}

export interface SearchResult {
  cars: Car[];
  providerName: string;
  live: boolean;
  /** True if a live provider was configured but we fell back to sample data. */
  usedFallback: boolean;
  error?: string;
}

export async function searchInventory(query: SearchQuery): Promise<SearchResult> {
  const { provider, live } = selectProvider();
  try {
    const cars = await provider.search(query);
    // If a live provider returns nothing, surface sample data so the UI isn't empty.
    if (live && cars.length === 0) {
      const cars2 = await new MockProvider().search(query);
      return { cars: cars2, providerName: "Sample data", live: false, usedFallback: true };
    }
    return { cars, providerName: provider.name, live, usedFallback: false };
  } catch (err) {
    const cars = await new MockProvider().search(query);
    return {
      cars,
      providerName: "Sample data",
      live: false,
      usedFallback: live,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
