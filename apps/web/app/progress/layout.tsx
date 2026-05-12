import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Trakt - Progress",
};

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return children;
}
