import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Trakt - Ratings",
};

export default function RatingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
