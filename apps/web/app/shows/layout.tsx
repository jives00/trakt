import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Trakt - Show",
};

export default function ShowsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
