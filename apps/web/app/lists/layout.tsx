import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Trakt - Lists",
};

export default function ListsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
