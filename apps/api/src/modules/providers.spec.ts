import { providerStatusOf, providerRefOf, amountForProvider, providerAuthHeaders, cfgOf } from './providers';
const cfg=cfgOf({});
describe('generic provider mapping (koi bhi PG/wallet/bank)',()=>{
 it('status words map hote hain',()=>{ expect(providerStatusOf({status:'captured'},cfg)).toBe('SUCCESS'); expect(providerStatusOf({state:'declined'},cfg)).toBe('FAILED'); expect(providerStatusOf({status:'initiated'},cfg)).toBe('PROCESSING'); expect(providerStatusOf({},cfg)).toBe('PROCESSING'); });
 it('ref aur amount unit',()=>{ expect(providerRefOf({txnId:'T123'},cfg)).toBe('T123'); expect(amountForProvider(19900,cfg)).toBe(19900); expect(amountForProvider(19900,{...cfg,amountUnit:'rupees'})).toBe(199); });
 it('auth headers type ke hisab se',()=>{ expect(providerAuthHeaders({apiKey:'K'},cfg)).toEqual({authorization:'Bearer K'}); expect(providerAuthHeaders({apiKey:'K'},{...cfg,authType:'API_KEY_HEADER',apiKeyHeader:'x-merchant-key'})).toEqual({'x-merchant-key':'K'}); expect(providerAuthHeaders({apiKey:'K',apiSecret:'S'},{...cfg,authType:'BASIC'})).toEqual({authorization:'Basic '+Buffer.from('K:S').toString('base64')}); });
});
