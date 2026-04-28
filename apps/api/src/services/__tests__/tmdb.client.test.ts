import { describe, it, expect } from 'vitest';
import { transformMovie, transformShow, transformSearchResult } from '../tmdb.client';

const movieFixture = {
  id: 550,
  title: 'Fight Club',
  release_date: '1999-10-15',
  overview: 'An insomniac office worker...',
  poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
  backdrop_path: '/52AfXWuXCHn3UjD17rBruA9f5qb.jpg',
  runtime: 139,
  genres: [{ id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
};

const showFixture = {
  id: 1396,
  name: 'Breaking Bad',
  first_air_date: '2008-01-20',
  overview: 'A high school chemistry teacher...',
  poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
  backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
  status: 'Ended',
  networks: [{ id: 174, name: 'AMC' }],
  genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
};

describe('transformMovie', () => {
  it('maps TMDB fields to Movie type', () => {
    const m = transformMovie(movieFixture);
    expect(m.tmdbId).toBe(550);
    expect(m.title).toBe('Fight Club');
    expect(m.year).toBe(1999);
    expect(m.runtimeMin).toBe(139);
    expect(m.genres).toEqual(['Drama', 'Thriller']);
    expect(m.posterPath).toBe('/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg');
  });

  it('handles missing optional fields', () => {
    const m = transformMovie({ id: 1, title: 'Bare', release_date: '' });
    expect(m.year).toBe(0);
    expect(m.runtimeMin).toBeNull();
    expect(m.genres).toEqual([]);
  });
});

describe('transformShow', () => {
  it('maps TMDB fields to TvShow type', () => {
    const s = transformShow(showFixture);
    expect(s.tmdbId).toBe(1396);
    expect(s.title).toBe('Breaking Bad');
    expect(s.year).toBe(2008);
    expect(s.network).toBe('AMC');
    expect(s.status).toBe('Ended');
    expect(s.genres).toEqual(['Drama', 'Crime']);
  });

  it('handles missing network', () => {
    const s = transformShow({ id: 1, name: 'Bare' });
    expect(s.network).toBeNull();
  });
});

describe('transformSearchResult', () => {
  it('maps a movie result', () => {
    const r = transformSearchResult({ ...movieFixture, media_type: 'movie' });
    expect(r?.mediaType).toBe('movie');
    expect(r?.tmdbId).toBe(550);
    expect(r?.year).toBe(1999);
  });

  it('maps a tv result', () => {
    const r = transformSearchResult({ ...showFixture, media_type: 'tv' });
    expect(r?.mediaType).toBe('show');
    expect(r?.title).toBe('Breaking Bad');
  });

  it('returns null for person results', () => {
    expect(transformSearchResult({ media_type: 'person', id: 1 })).toBeNull();
  });

  it('handles missing year gracefully', () => {
    const r = transformSearchResult({ id: 1, media_type: 'movie', title: 'X' });
    expect(r?.year).toBeNull();
  });
});
