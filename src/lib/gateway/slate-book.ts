import { PolymarketApi } from '../polymarket-api';
import { createGateway } from './trade-book';
import { PolymarketGateway } from './PolymarketGateway';
import { SlateResolver } from './slate-resolver';

export interface SlateBook {
    api: PolymarketApi;
    gateway: PolymarketGateway;
    resolver: SlateResolver;
}

/** Entry point for slate scans — shared by sovereign report and daily scanner. */
export function loadSlateBook(api = new PolymarketApi(), gateway = createGateway()): SlateBook {
    const resolver = new SlateResolver(api, gateway);
    return { api, gateway, resolver };
}