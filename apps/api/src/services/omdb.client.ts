export async function fetchImdbRating(imdbId: string): Promise<number | null> {
  const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.OMDB_API_KEY ?? ''}`;
  console.log(`[OMDB] Fetching IMDb rating for ${imdbId}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`[OMDB] Failed: ${res.status} ${res.statusText}`);
    return null;
  }
  const data = await res.json() as { imdbRating?: string };
  const rating = data.imdbRating ? parseFloat(data.imdbRating) : null;
  console.log(`[OMDB] IMDb rating: ${rating}`);
  return rating && !isNaN(rating) ? Math.round(rating * 10) : null;
}
