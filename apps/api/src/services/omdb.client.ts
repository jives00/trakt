export async function fetchRtRatings(imdbId: string): Promise<{ criticScore: number | null; audienceScore: number | null }> {
  const url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${process.env.OMDB_API_KEY ?? ''}`;
  const res = await fetch(url);
  if (!res.ok) return { criticScore: null, audienceScore: null };
  const data = await res.json() as { Ratings?: { Source: string; Value: string }[] };
  const ratings = data.Ratings ?? [];
  const rt = ratings.find(r => r.Source === 'Rotten Tomatoes');
  const audience = ratings.find(r => r.Source === 'Rotten Tomatoes Audience');
  const parse = (v: string | undefined) => v ? (parseInt(v.replace('%', ''), 10) || null) : null;
  return { criticScore: parse(rt?.Value), audienceScore: parse(audience?.Value) };
}
