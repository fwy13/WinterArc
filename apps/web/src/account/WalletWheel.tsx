import { useEffect, useState } from 'react';
import { ECONOMY, SPIN_REWARDS, type AccountProfile } from 'winterarc-profile';
import { primary, secondary } from '../components/ui';
import { useI18n } from '../i18n';
import { useStore } from '../hooks/useStore';
import {
  account,
  accountConfig,
  api,
  holdRewardPresentation,
  presentProfile,
  rewardPresentationBusy,
  serverClockOffset,
} from './service';

export default function WalletWheel({
  busy,
  onBusy,
  onError,
}: {
  busy: boolean;
  onBusy(value: boolean): void;
  onError(error: unknown): void;
}) {
  const me = useStore(account),
    config = useStore(accountConfig);
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  const [rotation, setRotation] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!me) return null;
  const economy = config?.economy || ECONOMY;
  const remaining = Math.max(0, Math.ceil((me.nextSpinAt - now - serverClockOffset) / 1000));
  const wait = `${Math.floor(remaining / 3600)}:${String(Math.floor((remaining % 3600) / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  const spin = async (source: 'free' | 'bonus') => {
    if (busy || spinning || rewardPresentationBusy.get()) return;
    const release = holdRewardPresentation();
    setSpinning(true);
    onBusy(true);
    setReward(null);
    try {
      const data = await api<{ tokens: number; index: number; profile: AccountProfile }>(
        '/economy/spin',
        { source },
      );
      // Queue the new profile globally. Do not expose the balance before reveal.
      presentProfile(data.profile);
      const target = (360 - (data.index * 72 + 36)) % 360;
      setRotation((old) => old + 1440 + ((target - (old % 360) + 360) % 360));
      await new Promise((resolve) =>
        setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 3400),
      );
      setReward(data.tokens);
    } catch (error) {
      onError(error);
    } finally {
      release();
      setSpinning(false);
      onBusy(false);
    }
  };
  const colors = ['#a83a54', '#2d6c59', '#c89b45', '#3d7d97', '#765c91'];
  const point = (angle: number, radius: number) => [
    150 + Math.cos((angle * Math.PI) / 180) * radius,
    150 + Math.sin((angle * Math.PI) / 180) * radius,
  ];
  return (
    <section className="grid items-center gap-7 md:grid-cols-2">
      <div className="relative rounded-2xl border border-fir/15 bg-linear-to-b from-[#e9ddc3] to-paper px-4 py-8 text-center">
        <p className="mb-5 text-[10px] uppercase tracking-[.3em] text-fir">
          Winter wishes · Lucky wheel
        </p>
        <div className="relative mx-auto w-full max-w-75" aria-hidden="true">
          <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-4xl text-berry drop-shadow">
            ▼
          </span>
          <svg
            viewBox="0 0 300 300"
            className="w-full rounded-full shadow-xl transition-transform duration-3200 ease-[cubic-bezier(.12,.7,.12,1)] motion-reduce:transition-none"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <circle cx="150" cy="150" r="148" fill="#c49a4c" />
            <circle cx="150" cy="150" r="138" fill="#fff4d6" />
            {SPIN_REWARDS.map((item, i) => {
              const start = point(i * 72 - 90, 131),
                end = point((i + 1) * 72 - 90, 131);
              const label = point(i * 72 + 36 - 90, 92);
              return (
                <g key={item.tokens}>
                  <path
                    d={`M150 150 L${start.join(' ')} A131 131 0 0 1 ${end.join(' ')} Z`}
                    fill={colors[i]}
                    stroke="#fff3d0"
                    strokeWidth="2"
                  />
                  <text
                    x={label[0]}
                    y={label[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff8e8"
                    fontSize="25"
                    fontWeight="800"
                  >
                    {item.tokens}
                  </text>
                </g>
              );
            })}
            {Array.from({ length: 25 }, (_, i) => {
              const p = point(i * 14.4, 143);
              return <circle key={i} cx={p[0]} cy={p[1]} r="2" fill="#fff4ca" />;
            })}
            <circle cx="150" cy="150" r="32" fill="#fff4d6" stroke="#c49a4c" strokeWidth="6" />
            <text x="150" y="161" fontSize="34" textAnchor="middle" fill="#ba8540">
              💵
            </text>
          </svg>
        </div>
        <div
          className="mx-auto mt-6 min-h-14 max-w-xs rounded-lg border border-dashed border-fir/25 bg-white/50 p-3 font-note text-xl font-bold text-fir"
          role="status"
        >
          {spinning
            ? t('social.spinning')
            : reward !== null
              ? t('account.spinWon', { tokens: reward })
              : t('shop.wheelWish')}
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <h3 className="font-note text-4xl font-bold text-fir">{t('account.wheel')}</h3>
          <p className="mt-2 text-sm text-ink/70">
            {t('account.wheelHint', { hours: economy.spinCooldownMs / 3600000 })}
          </p>
        </div>
        <div className="rounded-lg border border-fir/15 bg-white/50 p-4">
          <p className="text-xs text-ink/60">{t('shop.balance')}</p>
          <strong className="font-mono text-3xl text-fir">💵 {me.tokens}</strong>
        </div>
        <button
          className={`${primary} w-full py-4!`}
          disabled={busy || spinning || remaining > 0}
          onClick={() => void spin('free')}
        >
          {remaining ? t('account.spinWait', { time: wait }) : t('account.spin')}
        </button>
        {me.bonusSpins > 0 && (
          <button
            className={`${secondary} w-full`}
            disabled={busy || spinning}
            onClick={() => void spin('bonus')}
          >
            {t('social.useBonusSpin')} ({me.bonusSpins})
          </button>
        )}
      </div>
    </section>
  );
}
