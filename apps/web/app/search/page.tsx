import { Suspense } from "react";
import { SearchResults } from "./search-results";

export const metadata = { title: "Search — Trakt" };

export default function SearchPage() {
  return (
    <div className="flex flex-col gap-stack-md">
      <h1 className="text-h2 font-black tracking-tight text-on-surface">Search</h1>
      <Suspense>
        <SearchResults />
      </Suspense>
    </div>
  );
}
