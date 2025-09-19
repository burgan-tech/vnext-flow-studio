export interface AssetDef {
  domain: string;
  flow: string;
  key: string;
  version: string;
  def: any;
  uri?: string;
}

export interface Registries {
  tasks: AssetDef[];
  functions: AssetDef[];
  extensions: AssetDef[];
  views: AssetDef[];
  schemas: AssetDef[];
}

export function indexByKey(assets: AssetDef[]): Map<string, AssetDef[]> {
  const map = new Map<string, AssetDef[]>();
  for (const a of assets) {
    const k = `${a.domain}/${a.flow}/${a.key}`;
    const existing = map.get(k) || [];
    map.set(k, [...existing, a].sort((x, y) =>
      y.version.localeCompare(x.version, 'en', { numeric: true })
    ));
  }
  return map;
}

export function resolve(
  map: Map<string, AssetDef[]>,
  domain: string,
  flow: string,
  key: string,
  version: string
): AssetDef | undefined {
  const arr = map.get(`${domain}/${flow}/${key}`) || [];
  return arr.find(a => a.version === version);
}

export function resolveLatest(
  map: Map<string, AssetDef[]>,
  domain: string,
  flow: string,
  key: string
): AssetDef | undefined {
  const arr = map.get(`${domain}/${flow}/${key}`) || [];
  return arr[0]; // First is latest due to sorting
}