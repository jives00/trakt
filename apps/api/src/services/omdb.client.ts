export async function fetchImdbRating(imdbId: string): Promise<number | null> {
  const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.OMDB_API_KEY ?? ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const data = await res.json() as { imdbRating?: string };
  const rating = data.imdbRating ? parseFloat(data.imdbRating) : null;
  return rating && !isNaN(rating) ? Math.round(rating * 10) : null;
}
