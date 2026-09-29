import ShopPanel from './shop/ShopPanel';
import { startSettingsSync } from './account/SettingsSync';
import AccountPanel from './account/AccountPanel';
import { account, accountLoading, refreshAccount } from './account/service';
import ProfileName from './account/ProfileName';
import LandscapeGate from './components/LandscapeGate';
import SpectatorControls, { type SpectatorOptions } from './components/SpectatorControls';
import SettingsPanel from './components/SettingsPanel';
import ModeHint from './components/ModeHint';
import { settings, updateSettings } from './config/settings';
import { renderFps } from './engine/RenderStats';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import { NetworkService, connection, snapshot, latency } from './network/NetworkService';
import { useStore } from './hooks/useStore';
import type { GameId, MatchFormat } from 'winterarc-core';
import { useI18n, t, type TranslationKey } from './i18n';
import ArcadeMenu from './components/ArcadeMenu';
import Lobby from './components/Lobby';
import GameHud from './components/GameHud';
import ResultPanel from './components/ResultPanel';
import MenuPreview from './components/MenuPreview';
import MobileControls from './components/MobileControls';
import { useTouchControls } from './hooks/useTouchControls';
import HelpPanel from './components/HelpPanel';
import InformationPanel from './components/InformationPanel';
import { primary, secondary, panel } from './components/ui';

interface Notice {
  id: number;
  text: string;
}
export default function App() {
  useI18n();
  useEffect(() => startSettingsSync(), []);
  useEffect(() => {
    const refresh = () => {
      if (account.get()) void refreshAccount().catch(() => {});
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const touchControls = useTouchControls();
  const meAccount = useStore(account);
  const loadingAccount = useStore(accountLoading);
  const [shopOpen, setShopOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [landscapeBlocked, setLandscapeBlocked] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null),
    engineRef = useRef<GameEngine | null>(null),
    networkRef = useRef<NetworkService | null>(null);
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>()),
    noticeId = useRef(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const preferences = useStore(settings);
  const fps = useStore(renderFps);
  const [privateRoom, setPrivateRoom] = useState(false);
  const [tournament, setTournament] = useState(false);
  const [tournamentTitle, setTournamentTitle] = useState('Winter Cup');
  const [tournamentRounds, setTournamentRounds] = useState(3);
  const [tournamentCapacity, setTournamentCapacity] = useState(16);
  const [createPassword, setCreatePassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [format, setFormat] = useState<MatchFormat>('solo');
  const [randomMode, setRandomMode] = useState(true);
  const [selected, setSelected] = useState<GameId>('hunt'),
    [name, setName] = useState(''),
    [code, setCode] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null),
    [fatal, setFatal] = useState<TranslationKey | null>(null);
  const [gameReady, setGameReady] = useState(false),
    [previewReady, setPreviewReady] = useState(false);
  const [paused, setPaused] = useState(true),
    [help, setHelp] = useState(false),
    [information, setInformation] = useState(false);
  const [candidate, setCandidate] = useState(false),
    [pointerLocked, setPointerLocked] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const volume = preferences.volume;
  const status = useStore(connection),
    snap = useStore(snapshot),
    ping = useStore(latency);
  // Keep the top bar minimal throughout countdown and play, on every device.
  const compactPlay = !!snap && ['countdown', 'playing'].includes(snap.phase);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const modalRef = useRef(false);
  modalRef.current =
    help || information || settingsOpen || accountOpen || shopOpen || landscapeBlocked;
  const ready = gameReady && previewReady,
    showPreview = !snap || snap.phase === 'lobby' || snap.phase === 'finished';
  const notice = useCallback((text: string) => {
    const id = ++noticeId.current;
    setNotices((previous) => [...previous.slice(-2), { id, text }]);
    const timer = setTimeout(() => {
      setNotices((previous) => previous.filter((n) => n.id !== id));
      timersRef.current.delete(timer);
    }, 4500);
    timersRef.current.add(timer);
  }, []);
  const pause = useCallback(() => {
    if (snapshot.get()?.phase === 'playing') {
      setPaused(true);
      engineRef.current?.setPaused(true);
    }
  }, []);
  const resume = useCallback(() => {
    if (connection.get() !== 'online' || landscapeBlocked) return;
    setPaused(false);
    engineRef.current?.setPaused(false, true);
  }, [landscapeBlocked]);
  const leave = useCallback(() => {
    setPaused(true);
    engineRef.current?.setPaused(true);
    void networkRef.current?.leave();
  }, []);
  const listRooms = useCallback((signal?: AbortSignal) => {
    const network = networkRef.current;
    return network ? network.listRooms(signal) : Promise.reject(new Error('Network not ready'));
  }, []);
  const connect = async (join: boolean, roomId?: string, observer = false) => {
    const targetCode = roomId ?? code;
    if (!ready || !networkRef.current || (status === 'connecting' || status === 'reconnecting')) return;
    if (!meAccount) {
      setAccountOpen(true);
      return;
    }
    if (join && !targetCode.trim()) {
      setError('error.code');
      return;
    }
    if (
      !join &&
      (privateRoom || (tournament && meAccount.admin)) &&
      (createPassword.length < 6 || createPassword.length > 64 || !createPassword.trim())
    ) {
      setError('error.passwordInvalid');
      return;
    }
    setError(null);
    try {
      localStorage.setItem('snowbound-name', name.trim());
    } catch {
      /* optional */
    }
    try {
      await networkRef.current.connect({
        format,
        mode: randomMode ? 'random' : selected,
        name: meAccount.name,
        observer: observer || (!join && tournament && meAccount.admin),
        tournament:
          !join && tournament && meAccount.admin
            ? {
                title: tournamentTitle.trim(),
                rounds: tournamentRounds,
                maxPlayers: tournamentCapacity,
              }
            : undefined,
        code: join ? targetCode.trim() : undefined,
        privateRoom: !join && (privateRoom || tournament),
        password: join ? joinPassword : privateRoom || tournament ? createPassword : undefined,
      });
      setCreatePassword('');
      setJoinPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/LOGIN_REQUIRED/.test(message)) {
        setAccountOpen(true);
        return;
      }
      if (/TOURNAMENT_INVALID/.test(message)) {
        notice(t('account.error.TOURNAMENT_INVALID'));
        return;
      }
      if (/ADMIN_REQUIRED/.test(message)) {
        notice(t('account.error.ADMIN_REQUIRED'));
        return;
      }
      if (/ALREADY_IN_ROOM/.test(message)) {
        notice(t('account.error.ALREADY_IN_ROOM'));
        return;
      }
      if (/REGISTRATION_REQUIRED/.test(message)) {
        notice(t('account.error.REGISTRATION_REQUIRED'));
        return;
      }
      setError(
        /PASSWORD_RATE_LIMIT/.test(message)
          ? 'error.passwordRate'
          : /PASSWORD_REQUIRED_OR_INVALID/.test(message)
            ? 'error.passwordWrong'
            : /PASSWORD_INVALID/.test(message)
              ? 'error.passwordInvalid'
              : /locked|403|begun|bắt đầu/i.test(message)
                ? 'error.locked'
                : /not found|4212|invalid room/i.test(message)
                  ? 'error.notFound'
                  : 'error.connect',
      );
    }
  };
  const copy = async () => {
    const s = snapRef.current;
    if (!s) return;
    const url = new URL(location.href);
    url.search = `?room=${encodeURIComponent(s.roomId)}`;
    try {
      await navigator.clipboard.writeText(url.href);
      notice(t('notice.copied'));
    } catch {
      notice(t('notice.room', { code: s.roomId }));
    }
  };
  useEffect(() => {
    try {
      setName(localStorage.getItem('snowbound-name') || '');
    } catch {
      /* optional */
    }
    setCode(new URLSearchParams(location.search).get('room') || '');
    const network = new NetworkService();
    networkRef.current = network;
    let lastPhase = '',
      lastSession = '';
    network.onSnapshot = (state) => {
      const engine = engineRef.current;
      engine?.sync(state);
      engine?.setVisible(!!state && state.phase !== 'lobby' && state.phase !== 'finished');
      if (state) {
        setSelected(state.mode);
        setFormat(state.format);
        if (lastPhase !== state.phase || lastSession !== state.selfId) {
          // Start immediately after the countdown. Pointer lock still requires a user gesture.
          const shouldPause = state.phase !== 'playing' || modalRef.current;
          setPaused(shouldPause);
          engine?.setPaused(shouldPause);
        }
        lastPhase = state.phase;
        lastSession = state.selfId;
      } else {
        lastPhase = '';
        lastSession = '';
        setPaused(true);
      }
    };
    network.onNotice = notice;
    network.onShot = (e) => engineRef.current?.shot(e);
    network.onSound = (e) => engineRef.current?.sound(e);
    network.onFound = () => engineRef.current?.found();
    if (canvasRef.current) {
      try {
        engineRef.current = new GameEngine(canvasRef.current, {
          input: (cmd) => network.send('input', cmd),
          attack: () => network.send('attack', { round: snapshot.get()?.round ?? 0 }),
          find: (id) => network.send('find', { round: snapshot.get()?.round ?? 0, target: id }),
          pause,
          candidate: setCandidate,
          ready: () => {
            setGameReady(true);
            const s = snapshot.get();
            engineRef.current?.setVisible(!!s && s.phase !== 'lobby' && s.phase !== 'finished');
          },
          notice,
        });
      } catch (error) {
        console.error(error);
        setFatal('error.webgl');
      }
    }
    const unsubscribe = connection.subscribe(() => {
      const state = connection.get();
      engineRef.current?.setOnline(state === 'online');
      if (state === 'reconnecting') {
        setPaused(true);
        engineRef.current?.setPaused(true);
      }
    });
    const pointer = () => setPointerLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', pointer);
    let wasHiddenInRoom = false;
    const visibility = () => {
      if (document.hidden && snapshot.get()) {
        wasHiddenInRoom = true;
        pause();
      } else if (!document.hidden && wasHiddenInRoom) {
        wasHiddenInRoom = false;
        notice(t('session.hidden'));
      }
    };
    document.addEventListener('visibilitychange', visibility);
    // Restore only after callbacks, engine and connection listeners are installed.
    void network.restore();
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerlockchange', pointer);
      network.onSnapshot = () => {};
      network.onNotice = () => {};
      network.onShot = () => {};
      network.onSound = () => {};
      network.onFound = () => {};
      network.dispose();
      networkRef.current = null;
      engineRef.current?.dispose();
      engineRef.current = null;
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, [notice, pause]);
  const joinFromAccount = async (
    roomId: string,
    observer = false,
    password?: string,
  ): Promise<void> => {
    if (!ready || !networkRef.current || snap || (status === 'connecting' || status === 'reconnecting'))
      throw new Error('GAME_NOT_READY');
    const profile = account.get();
    if (!profile) throw new Error('LOGIN_REQUIRED');
    await networkRef.current.connect({
      name: profile.name,
      format,
      mode: randomMode ? 'random' : selected,
      code: roomId,
      observer,
      password: password ?? joinPassword,
    });
  };
  const setSpectator = useCallback(
    (value: SpectatorOptions) => engineRef.current?.setSpectator(value),
    [],
  );
  useEffect(() => {
    if (meAccount) setName(meAccount.name);
  }, [meAccount?.name]);
  useEffect(() => {
    if (!meAccount?.admin) setTournament(false);
  }, [meAccount?.admin]);
  useEffect(() => {
    if (landscapeBlocked) {
      setPaused(true);
      engineRef.current?.setPaused(true);
    }
  }, [landscapeBlocked]);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openHelp = useCallback(() => {
    setSettingsOpen(false);
    setHelp(true);
  }, []);
  const openInformation = useCallback(() => {
    setSettingsOpen(false);
    setInformation(true);
  }, []);
  const closeHelp = useCallback(() => {
    setHelp(false);
    setSettingsOpen(true);
  }, []);
  const closeInformation = useCallback(() => {
    setInformation(false);
    setSettingsOpen(true);
  }, []);
  const changeVolume = (value: number) => {
    updateSettings({ volume: value });
    engineRef.current?.setAudioVolume(value);
  };
  return (
    <>
      <LandscapeGate
        active={touchControls && !!snap && ['playing', 'countdown'].includes(snap.phase)}
        onBlocked={setLandscapeBlocked}
      />
      {accountOpen && (
        <AccountPanel
          inRoom={!!snap}
          onClose={() => setAccountOpen(false)}
          onJoin={joinFromAccount}
          onShop={() => {
            setAccountOpen(false);
            setShopOpen(true);
          }}
        />
      )}
      {shopOpen && <ShopPanel inRoom={!!snap} onClose={() => setShopOpen(false)} />}
      <div
        ref={canvasRef}
        id="game-canvas"
        aria-label={t('app.world')}
        className={`fixed inset-0 h-dvh w-full [&_canvas]:h-full [&_canvas]:w-full ${showPreview ? 'invisible' : 'visible'}`}
      />
      <MenuPreview
        selected={selected}
        active={showPreview}
        onready={() => setPreviewReady(true)}
        onerror={(error) => {
          console.error(error);
          setFatal('error.preview');
        }}
      />
      {showPreview && (
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-r from-paper/90 via-paper/65 to-paper/15" />
      )}
      <header
        className={
          compactPlay
            ? 'pointer-events-none fixed right-[max(0.5rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] z-40'
            : 'pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 bg-gradient-to-b from-paper/90 to-transparent px-3 py-2 sm:px-10 sm:py-5 [@media(max-height:500px)]:py-1'
        }
      >
        <button
          className={`${compactPlay ? 'hidden' : 'flex'} pointer-events-auto paper-tab min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-xs sm:max-w-md sm:flex-none`}
          onClick={() => {
            pause();
            setAccountOpen(true);
          }}
          disabled={loadingAccount}
          title={meAccount?.name || t('account.login')}
          aria-label={`${t('account.title')}: ${meAccount?.name || t('account.login')}`}
        >
          {meAccount ? <ProfileName player={meAccount} showRoles={false} /> : t('account.login')}
        </button>
        <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {compactPlay && (
            <output
              className="pointer-events-none paper-tab px-2 py-1.5 font-mono text-[10px] tabular-nums sm:text-xs"
              aria-label="FPS / ping"
            >
              {fps} FPS · {status === 'online' ? `${ping} ms` : '— ms'}
            </output>
          )}
          <button
            className={`${compactPlay ? 'hidden' : ''} paper-tab grid size-11 shrink-0 place-items-center text-lg min-[480px]:w-auto min-[480px]:px-3`}
            aria-label={t('shop.title')}
            title={t('shop.title')}
            onClick={() => {
              pause();
              setShopOpen(true);
            }}
          >
            <span aria-hidden="true">
              💵 <span className="hidden text-xs min-[480px]:inline">{t('shop.title')}</span>
            </span>
          </button>
          <button
            className="paper-tab grid size-11 shrink-0 place-items-center text-lg"
            aria-label={t('settings.title')}
            title={t('settings.title')}
            onClick={() => {
              pause();
              setSettingsOpen(true);
            }}
          >
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>
      {status === 'reconnecting' && !snap && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-paper p-6" role="status">
          <section className="max-w-md space-y-4 text-center">
            <h2 className="font-note text-3xl font-bold">{t('notice.reconnecting')}</h2>
            <p className="text-sm leading-7">{t('session.restoring')}</p>
            <button className={secondary} onClick={leave}>{t('session.cancelRestore')}</button>
          </section>
        </div>
      )}
      {!snap && (
        <ArcadeMenu
          randomMode={randomMode}
          onRandomMode={setRandomMode}
          selected={selected}
          onSelect={setSelected}
          privateRoom={privateRoom}
          onPrivateRoom={setPrivateRoom}
          createPassword={createPassword}
          onCreatePassword={setCreatePassword}
          joinPassword={joinPassword}
          onJoinPassword={setJoinPassword}
          format={format}
          onFormat={setFormat}
          name={meAccount?.name || name}
          authenticated={!!meAccount}
          admin={!!meAccount?.admin}
          tournament={tournament}
          tournamentTitle={tournamentTitle}
          tournamentRounds={tournamentRounds}
          tournamentCapacity={tournamentCapacity}
          onTournament={(enabled) => {
            setTournament(enabled);
            if (enabled) {
              setPrivateRoom(true);
              setFormat('solo');
            }
          }}
          onTournamentTitle={setTournamentTitle}
          onTournamentRounds={setTournamentRounds}
          onTournamentCapacity={setTournamentCapacity}
          code={code}
          status={status}
          error={error ? t(error) : ''}
          ready={ready}
          listRooms={listRooms}
          onJoinRoom={(roomId) => void connect(true, roomId)}
          onconnect={(join) => void connect(join)}
          onNameChange={setName}
          onCodeChange={setCode}
        />
      )}
      {snap?.phase === 'lobby' && (
        <Lobby
          state={snap}
          onMode={(value) => networkRef.current?.send('mode', value)}
          onFormat={(value) => networkRef.current?.send('format', value)}
          onready={() => networkRef.current?.send('ready')}
          onstart={() => networkRef.current?.send('start')}
          onleave={leave}
          oncopy={() => void copy()}
        />
      )}
      {snap && snap.phase !== 'lobby' && (
        <>
          {snap.phase !== 'finished' && <GameHud state={snap} candidate={candidate} />}
          {!paused && !snap.players.find((p) => p.id === snap.selfId)?.observer && (
            <ModeHint state={snap} />
          )}
          {touchControls &&
            snap.phase === 'playing' &&
            status === 'online' &&
            !paused &&
            !help &&
            !information &&
            snap.players.some(
              (p) => p.id === snap.selfId && !p.out && !p.qualified && p.hp > 0,
            ) && (
              <MobileControls
                key={`${snap.roomId}:${snap.round}`}
                mode={snap.mode}
                candidate={candidate}
              />
            )}
          {snap.phase === 'playing' &&
            !paused &&
            !accountOpen &&
            !shopOpen &&
            snap.players.some(
              (p) => p.id === snap.selfId && (p.observer || p.out || p.qualified),
            ) && (
              <SpectatorControls
                key={`${snap.roomId}:${snap.round}`}
                state={snap}
                onChange={setSpectator}
              />
            )}
          {snap.phase === 'countdown' && (
            <div className="pointer-events-none fixed inset-0 z-30 grid place-content-center bg-fir/10 text-center">
              <p className="text-xs tracking-[0.2em] text-fir">{t('hud.countdown')}</p>
              <strong className="my-2 text-6xl sm:my-5 sm:text-9xl font-black tabular-nums text-ink drop-shadow-[2px_2px_0_#fff8e8]">
                {snap.countdown || t('hud.go')}
              </strong>
              <p className="text-lg font-semibold">{t(`games.${snap.mode}.title`)}</p>
            </div>
          )}
          {(snap.phase === 'finished' || snap.phase === 'intermission') && (
            <ResultPanel
              state={snap}
              onready={() => networkRef.current?.send('ready')}
              onMode={(value) => networkRef.current?.send('mode', value)}
              onFormat={(value) => networkRef.current?.send('format', value)}
              onstart={() => networkRef.current?.send('start')}
              onleave={leave}
            />
          )}
          {snap.phase === 'playing' &&
            !paused &&
            !pointerLocked &&
            !touchControls &&
            !help &&
            !information &&
            !snap.players.find((p) => p.id === snap.selfId)?.out &&
            !snap.players.find((p) => p.id === snap.selfId)?.qualified && (
              <button
                className={`${primary} fixed bottom-52 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap`}
                onClick={resume}
              >
                {t('hud.focus')}
              </button>
            )}
          {snap.phase === 'playing' &&
            paused &&
            !help &&
            !information &&
            !settingsOpen &&
            !accountOpen &&
            !shopOpen && (
              <div className="fixed inset-0 z-30 grid place-items-center bg-fir/25 p-4 ">
                <section
                  className={`${panel} w-full max-w-md max-h-[calc(100dvh-6rem)] overflow-y-auto max-sm:!p-4`}
                >
                  <h2 className="font-note text-2xl font-bold">
                    {status === 'reconnecting' ? t('notice.reconnecting') : t('pause.title')}
                  </h2>
                  <p className="my-4 text-sm leading-6 text-ink/80">{t('pause.hint')}</p>
                  <label className="my-5 flex items-center gap-3 text-sm">
                    {t('common.volume')}
                    <input
                      className="min-w-0 flex-1 accent-fir"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => changeVolume(Number(e.target.value))}
                    />
                    <span className="w-10 text-right font-mono text-xs">
                      {Math.round(volume * 100)}%
                    </span>
                  </label>
                  <button className={secondary} onClick={() => setSettingsOpen(true)}>
                    {t('settings.title')}
                  </button>
                  <div className="mt-3 flex flex-col gap-3">
                    <button className={primary} onClick={resume} disabled={status !== 'online'}>
                      {t('pause.resume')}
                    </button>
                    <button className={secondary} onClick={leave}>
                      {t('common.back')}
                    </button>
                  </div>
                </section>
              </div>
            )}
        </>
      )}
      {showPreview && (
        <footer className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 pb-6 text-xs text-ink/65 sm:px-10">
          <p>{t('app.copyright')}</p>
        </footer>
      )}
      {settingsOpen && (
        <SettingsPanel
          inMatch={compactPlay}
          onClose={closeSettings}
          onPreview={() => void engineRef.current?.previewAudio()}
          onHelp={openHelp}
          onCredits={openInformation}
        />
      )}
      {preferences.showStats && snap && !compactPlay && (
        <output className="pointer-events-none fixed left-2 top-20 z-30 rounded bg-black/60 px-2 py-1 text-[10px] text-white">
          {fps} FPS · {ping} ms
        </output>
      )}
      {help && <HelpPanel onClose={closeHelp} />}
      {information && <InformationPanel onClose={closeInformation} />}
      {(!ready || fatal) && (
        <div className="fixed inset-0 z-70 grid place-content-center bg-paper px-8 text-center">
          <span className="mb-6 text-6xl text-fir motion-safe:animate-pulse">❄</span>
          <h2 className="font-note text-2xl font-bold">
            {t(fatal ? 'common.errorTitle' : 'common.loading')}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink/65">
            {t(fatal || 'common.loadHint')}
          </p>
          {fatal && (
            <button className={`${secondary} mt-6`} onClick={() => location.reload()}>
              {t('common.retry')}
            </button>
          )}
        </div>
      )}
      <div
        className={
          touchControls
            ? 'pointer-events-none fixed left-1/2 top-[calc(max(0.5rem,env(safe-area-inset-top))+7rem)] z-[60] w-fit max-w-[65vw] -translate-x-1/2 [&>div:not(:last-child)]:hidden [&>div]:px-2 [&>div]:py-1 [&>div]:text-[10px]'
            : 'pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[min(90vw,400px)] flex-col gap-2'
        }
        role="status"
        aria-live="polite"
      >
        {notices.map((item) => (
          <div key={item.id} className="paper-tab px-5 py-3 text-sm text-fir">
            {item.text}
          </div>
        ))}
      </div>
    </>
  );
}
