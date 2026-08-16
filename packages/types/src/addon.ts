export interface AddonCatalogEntry {
  type: 'movie' | 'series';
  id: string;
  name: string;
}

export interface AddonMetaObject {
  id: string;
  type: 'movie' | 'series';
  name: string;
  poster?: string;
  year?: number;
}

export interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  resources: string[];
  types: string[];
  catalogs: AddonCatalogEntry[];
  idPrefixes: string[];
}
