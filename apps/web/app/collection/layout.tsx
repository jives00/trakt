import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Trakt - Collection",
};

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
