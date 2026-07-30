import type { Metadata } from "next";

import { AccountClient } from "./account-client";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in to Buddy Billiards to validate venues, save trips, and go Premium.",
};

export default function AccountPage() {
  return <AccountClient />;
}
