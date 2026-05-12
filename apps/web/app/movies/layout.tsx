import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Trakt - Movie",
};

export default function MoviesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
