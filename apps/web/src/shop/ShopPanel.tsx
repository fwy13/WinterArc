import { useState } from 'react';
import { AVATAR_FRAMES, PLAYER_SKINS, THEMES, type AccountProfile } from 'winterarc-profile';
import { account, api, presentProfile, rewardPresentationBusy } from '../account/service';
import AvatarPhoto from '../account/AvatarPhoto';
import WalletWheel from '../account/WalletWheel';
import SkinPreview from './SkinPreview';
import { useStore } from '../hooks/useStore';
import { useI18n, type TranslationKey } from '../i18n';
import { primary, secondary } from '../components/ui';

type Tab = 'frames' | 'skins' | 'themes' | 'wheel';
type Kind = 'frame' | 'skin' | 'theme';

export default function ShopPanel({ inRoom, onClose }: { inRoom: boolean; onClose(): void }) {
  const me = useStore(account), spinning = useStore(rewardPresentationBusy);
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('frames');
  const [selected, select] = useState(me?.frameId || 'none');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  
  const locked = busy || spinning;
  if (!me) return null;
  
  const kind: Kind = tab === 'skins' ? 'skin' : tab === 'themes' ? 'theme' : 'frame';
  const catalog = kind === 'skin' ? PLAYER_SKINS : kind === 'theme' ? THEMES : AVATAR_FRAMES;
  const item = catalog.find(value => value.id === selected) || catalog[0];
  const equipped = kind === 'skin' ? me.skinId : kind === 'theme' ? me.theme : me.frameId;
  const owned = item.cost === 0 || me.owned.includes(`${kind}:${item.id}`);
  
  const title = (id: string) => t((kind === 'skin' ? `shop.skin.${id}` : kind === 'theme' ? `account.theme.${id}` : `social.frame.${id}`) as TranslationKey);
  
  const fail = (e: unknown) => {
    const key = `account.error.${e instanceof Error ? e.message : 'SERVER_ERROR'}` as TranslationKey;
    setError(t(key) === key ? t('account.error.SERVER_ERROR') : t(key));
  };
  
  const act = async () => {
    if (locked) return;
    if (!owned && !confirmation) { setConfirmation(true); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await api<{ profile: AccountProfile }>('/shop/item', { kind, itemId: item.id, action: owned ? 'equip' : 'buy' });
      presentProfile(result.profile);
      setSuccess(t(owned ? 'shop.equippedMessage' : 'shop.boughtMessage'));
    } catch (e) { fail(e); }
    finally { setBusy(false); setConfirmation(false); }
  };
  
  const preview = (id: string, size: number) => kind === 'skin'
    ? <div className="max-w-full" style={{ width: size, height: size }}><SkinPreview skinId={id} color={me.color} /></div>
    : kind === 'frame' ? <AvatarPhoto player={{ ...me, frameId: id }} size={size} />
    : <div className="grid place-items-center rounded-lg border border-fir/20" style={{ width: size, height: size, backgroundColor: THEMES.find(v => v.id === id)?.color }}><AvatarPhoto player={me} size={Math.round(size * .65)} /></div>;
    
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0c2c25]/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={t('shop.title')}>
      <section className="mx-auto max-w-6xl overflow-hidden rounded-xl border-2 border-[#d9c69f] bg-paper shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-fir px-4 py-4 text-paper sm:px-6">
          <div><p className="text-[10px] uppercase tracking-[.25em]">Winter Arc · Boutique</p><h2 className="font-note text-3xl font-bold">{t('shop.title')}</h2></div>
          <div className="flex items-center gap-3"><span className="rounded-full border border-amber-200/40 bg-black/10 px-4 py-2 font-mono font-bold text-amber-100">💵 {me.tokens}</span><button className={secondary} disabled={locked} onClick={onClose}>{t('common.close')}</button></div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-fir/15 p-3" aria-label={t('shop.title')}>
          {(['frames', 'skins', 'themes', 'wheel'] as const).map(value => <button key={value} disabled={locked} className={`${value === tab ? primary : secondary} shrink-0`} onClick={() => {
            setTab(value); select(value === 'skins' ? me.skinId : value === 'themes' ? me.theme : me.frameId);
            setConfirmation(false); setError(''); setSuccess('');
          }}>{t(`shop.${value}`)}</button>)}
        </nav>
        {error && <p role="alert" className="px-5 pt-3 text-berry">{error}</p>}
        {success && <p role="status" className="px-5 pt-3 text-fir">{success}</p>}
        {tab === 'wheel' ? <div className="p-4 sm:p-7"><WalletWheel busy={locked} onBusy={setBusy} onError={fail} /></div> :
          <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[1fr_280px]">
            <div className="grid content-start grid-cols-2 gap-3 min-[450px]:grid-cols-3 lg:grid-cols-4">
              {catalog.map(value => {
                const has = value.cost === 0 || me.owned.includes(`${kind}:${value.id}`);
                return <button key={value.id} disabled={locked} aria-pressed={item.id === value.id} className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-colors ${item.id === value.id ? 'border-fir bg-[#e2eee2]' : 'border-fir/10 bg-white/45 hover:border-fir/40'}`} onClick={() => { select(value.id); setConfirmation(false); setSuccess(''); }}>
                  {preview(value.id, kind === 'skin' ? 120 : 84)}
                  <strong className="text-sm">{title(value.id)}</strong>
                  <span className="text-xs text-fir">{equipped === value.id ? t('shop.equipped') : has ? t('shop.owned') : `${value.cost} 💵`}</span>
                </button>;
              })}
            </div>
            
            <aside className="flex flex-col items-center gap-4 self-start rounded-xl border border-fir/15 bg-[#f2ead7] p-5 md:sticky md:top-0">
              {preview(item.id, 180)}
              <h3 className="text-center font-note text-2xl font-bold">{title(item.id)}</h3>
              {/* Nút Buy/Equip gốc không còn chứa logic Confirm nội tuyến nữa */}
              <button className={`${primary} w-full`} disabled={locked || (owned && (inRoom || equipped === item.id)) || (!owned && me.tokens < item.cost)} onClick={() => void act()}>
                {owned ? t(equipped === item.id ? 'shop.equipped' : 'shop.equip') : t('shop.buy', { cost: item.cost })}
              </button>
              {inRoom && <p className="text-center text-xs">{t('account.leaveToEdit')}</p>}
            </aside>
          </div>}
      </section>
      {confirmation && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md transition-opacity">
          <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-fir/20 bg-paper p-8 shadow-2xl">
            <h3 className="text-center text-lg font-bold text-fir">{t('shop.confirm', { cost: item.cost })}</h3>
            <div className="rounded-xl bg-[#f2ead7] p-6 shadow-inner">
              {preview(item.id, 140)}
            </div>
            <div className="text-center">
              <h4 className="font-note text-3xl font-bold">{title(item.id)}</h4>
              <p className="mt-1 font-mono font-bold text-amber-600">Cost: {item.cost} 💵</p>
            </div>
            <div className="mt-2 flex w-full gap-3">
              <button className={`${secondary} flex-1`} disabled={locked} onClick={() => setConfirmation(false)}>
                {t('shop.cancel')}
              </button>
              <button className={`${primary} flex-1`} disabled={locked} onClick={() => void act()}>
                {t('shop.confirm', { cost: item.cost })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}