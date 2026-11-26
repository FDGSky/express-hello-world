import React, { useEffect, useRef, useState } from 'react';
import type { OfficeEvent, Organization } from '../../shared/types.js';

interface PixelOfficeCanvasProps {
  activeOrg: Organization;
  eventQueue: OfficeEvent[];
  pendingBossCount: number;
  totalProcessed: number;
  totalBlocked: number;
}

interface AgentSprite {
  key: string;
  label: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  waypoints: Array<{ x: number; y: number }>;
  hair: string;
  hairHi: string;
  shirt: string;
  tie?: string;
  jacket?: string;
  skin: string;
  skinShade: string;
  glasses?: boolean;
  headset?: boolean;
  mustache?: boolean;
  carryColor: string | null;
  workingTimer: number;
  bubble: string;
  bubbleColor: string;
  bubbleTimer: number;
  bobOffset: number;
}

interface FloatingFx {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const LOGICAL_W = 480;
const LOGICAL_H = 290;

export const PixelOfficeCanvas: React.FC<PixelOfficeCanvasProps> = ({
  activeOrg,
  eventQueue,
  pendingBossCount,
  totalProcessed,
  totalBlocked,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentEvent, setCurrentEvent] = useState<OfficeEvent | null>(null);
  const playedIdsRef = useRef<Set<string>>(new Set());
  const pendingPlayRef = useRef<OfficeEvent[]>([]);
  const playingTimerRef = useRef<number | null>(null);

  const activeOrgRef = useRef<Organization>(activeOrg);
  const pendingBossRef = useRef<number>(pendingBossCount);
  const activeStationRef = useRef<{ zone: string; color: string; timer: number }>({
    zone: '',
    color: '#38bdf8',
    timer: 0,
  });
  const tableFolderRef = useRef<{ visible: boolean; color: string }>({
    visible: false,
    color: '#38bdf8',
  });
  const scanBeamRef = useRef<{ active: boolean; color: string; timer: number }>({
    active: false,
    color: '#22c55e',
    timer: 0,
  });
  const fxRef = useRef<FloatingFx[]>([]);

  // Delivery truck animation state (Dispatch Bay bottom-right)
  const truckRef = useRef<{
    x: number;
    state: 'parked' | 'loading' | 'driving_out' | 'returning';
    timer: number;
    hasPapers: boolean;
    paperColor: string;
  }>({
    x: 382,
    state: 'parked',
    timer: 0,
    hasPapers: false,
    paperColor: '#38bdf8',
  });

  // Office Mascot: "Bandit" the pixel office cat
  const mascotRef = useRef({
    x: 240,
    y: 128,
    targetX: 240,
    targetY: 128,
    pauseTimer: 90,
    bubble: '',
    bubbleTimer: 0,
  });

  // 9 Detailed Pixel-Art Characters inspired by The Office
  const agentsRef = useRef<Record<string, AgentSprite>>({
    dwight: {
      key: 'dwight',
      label: 'DWIGHT',
      x: 62,
      y: 92,
      homeX: 62,
      homeY: 92,
      waypoints: [],
      hair: '#5c3a1e',
      hairHi: '#7c532e',
      shirt: '#eab308',
      tie: '#78350f',
      skin: '#fbd38d',
      skinShade: '#eab676',
      glasses: true,
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#facc15',
      bubbleTimer: 0,
      bobOffset: 0,
    },
    pam: {
      key: 'pam',
      label: 'PAM',
      x: 64,
      y: 214,
      homeX: 64,
      homeY: 214,
      waypoints: [],
      hair: '#9a4714',
      hairHi: '#c26525',
      shirt: '#fce7f3',
      jacket: '#f472b6',
      skin: '#fde68a',
      skinShade: '#f3cf72',
      headset: true,
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#38bdf8',
      bubbleTimer: 0,
      bobOffset: 1.4,
    },
    brand_ver: {
      key: 'brand_ver',
      label: 'BRAND QA',
      x: 170,
      y: 98,
      homeX: 170,
      homeY: 98,
      waypoints: [],
      hair: '#1e293b',
      hairHi: '#475569',
      shirt: '#e0f2fe',
      jacket: '#0284c7',
      tie: '#0c4a6e',
      skin: '#fed7aa',
      skinShade: '#f3bc82',
      glasses: true,
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#38bdf8',
      bubbleTimer: 0,
      bobOffset: 2.3,
    },
    msg_ver: {
      key: 'msg_ver',
      label: 'MSG QA',
      x: 244,
      y: 98,
      homeX: 244,
      homeY: 98,
      waypoints: [],
      hair: '#78350f',
      hairHi: '#b45309',
      shirt: '#fef3c7',
      jacket: '#d97706',
      skin: '#fbd38d',
      skinShade: '#e5b86e',
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#f59e0b',
      bubbleTimer: 0,
      bobOffset: 3.1,
    },
    claude: {
      key: 'claude',
      label: 'CLAUDE',
      x: 184,
      y: 184,
      homeX: 184,
      homeY: 184,
      waypoints: [],
      hair: '#451a03',
      hairHi: '#6b2f0e',
      shirt: '#f8fafc',
      tie: '#2563eb',
      skin: '#fed7aa',
      skinShade: '#eabf91',
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#f59e0b',
      bubbleTimer: 0,
      bobOffset: 0.7,
    },
    gemini: {
      key: 'gemini',
      label: 'GEMINI',
      x: 242,
      y: 184,
      homeX: 242,
      homeY: 184,
      waypoints: [],
      hair: '#1e1b4b',
      hairHi: '#3730a3',
      shirt: '#e0f2fe',
      jacket: '#0369a1',
      skin: '#fcd34d',
      skinShade: '#eab308',
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#38bdf8',
      bubbleTimer: 0,
      bobOffset: 2.1,
    },
    gpt: {
      key: 'gpt',
      label: 'GPT',
      x: 184,
      y: 244,
      homeX: 184,
      homeY: 244,
      waypoints: [],
      hair: '#1f2937',
      hairHi: '#374151',
      shirt: '#d1fae5',
      jacket: '#065f46',
      skin: '#c27834',
      skinShade: '#9a5b22',
      glasses: true,
      mustache: true,
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#10b981',
      bubbleTimer: 0,
      bobOffset: 3.2,
    },
    deepseek: {
      key: 'deepseek',
      label: 'DEEPSEEK',
      x: 242,
      y: 244,
      homeX: 242,
      homeY: 244,
      waypoints: [],
      hair: '#52525b',
      hairHi: '#71717a',
      shirt: '#f3e8ff',
      jacket: '#6b21a8',
      tie: '#3b0764',
      skin: '#fed7aa',
      skinShade: '#e5b887',
      glasses: true,
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#a855f7',
      bubbleTimer: 0,
      bobOffset: 4.1,
    },
    michael: {
      key: 'michael',
      label: 'BOSS',
      x: 396,
      y: 94,
      homeX: 396,
      homeY: 94,
      waypoints: [],
      hair: '#111827',
      hairHi: '#334155',
      shirt: '#f8fafc',
      jacket: '#1e293b',
      tie: '#dc2626',
      skin: '#fbd38d',
      skinShade: '#e3b870',
      carryColor: null,
      workingTimer: 0,
      bubble: '',
      bubbleColor: '#fbbf24',
      bubbleTimer: 0,
      bobOffset: 0.4,
    },
  });

  useEffect(() => {
    activeOrgRef.current = activeOrg;
  }, [activeOrg]);

  useEffect(() => {
    pendingBossRef.current = pendingBossCount;
  }, [pendingBossCount]);

  // Enqueue any unseen events and play them sequentially with 1.15s pacing so every walk/action is clearly visible
  useEffect(() => {
    if (eventQueue.length === 0) {
      playedIdsRef.current.clear();
      pendingPlayRef.current = [];
      setCurrentEvent(null);
      return;
    }

    let added = false;
    for (const evt of eventQueue) {
      if (!playedIdsRef.current.has(evt.id)) {
        playedIdsRef.current.add(evt.id);
        pendingPlayRef.current.push(evt);
        added = true;
      }
    }

    const pump = () => {
      if (pendingPlayRef.current.length === 0) {
        playingTimerRef.current = null;
        return;
      }
      const next = pendingPlayRef.current.shift()!;
      setCurrentEvent(next);
      playingTimerRef.current = window.setTimeout(pump, 1150);
    };

    if (added && playingTimerRef.current === null) {
      pump();
    }
  }, [eventQueue]);

  useEffect(() => {
    return () => {
      if (playingTimerRef.current !== null) clearTimeout(playingTimerRef.current);
    };
  }, []);

  // Choreograph physical multi-waypoint agent actions for the active event
  useEffect(() => {
    if (!currentEvent) return;
    const ag = agentsRef.current;
    const folderColor = currentEvent.orgSlug === 'cleaning' ? '#38bdf8' : '#a78bfa';

    const setBubble = (key: string, text: string, color: string, duration = 140) => {
      if (!ag[key]) return;
      ag[key].bubble = text;
      ag[key].bubbleColor = color;
      ag[key].bubbleTimer = duration;
    };

    const walk = (key: string, pts: Array<{ x: number; y: number }>, carry: string | null) => {
      if (!ag[key]) return;
      ag[key].waypoints = pts.map((p) => ({ ...p }));
      ag[key].carryColor = carry;
    };

    const launchTruck = (color: string) => {
      truckRef.current = {
        x: 382,
        state: 'loading',
        timer: 42,
        hasPapers: true,
        paperColor: color,
      };
    };

    switch (currentEvent.stage) {
      case 'incoming_sms':
        activeStationRef.current = { zone: 'security', color: '#38bdf8', timer: 110 };
        fxRef.current.push({ x: 24, y: 74, text: `SMS ${currentEvent.ticketCode}!`, color: '#34d399', life: 95 });
        walk('dwight', [{ x: 26, y: 86 }, { x: 62, y: 92 }], folderColor);
        setBubble('dwight', 'HALT! GRABBING SMS', '#facc15', 140);
        break;

      case 'security_scanning':
        activeStationRef.current = { zone: 'security', color: '#38bdf8', timer: 120 };
        ag.dwight.carryColor = folderColor;
        ag.dwight.workingTimer = 90;
        scanBeamRef.current = { active: true, color: '#38bdf8', timer: 115 };
        setBubble('dwight', 'SCANNING VIRUS/URL', '#38bdf8', 145);
        break;

      case 'security_blocked':
        activeStationRef.current = { zone: 'security', color: '#ef4444', timer: 160 };
        scanBeamRef.current = { active: true, color: '#ef4444', timer: 165 };
        ag.dwight.carryColor = '#ef4444';
        setBubble('dwight', 'THREAT BLOCKED!', '#ef4444', 190);
        mascotRef.current.bubble = 'HISS! 😾';
        mascotRef.current.bubbleTimer = 110;
        fxRef.current.push({ x: 62, y: 54, text: 'QUARANTINED!', color: '#f43f5e', life: 120 });
        setTimeout(() => {
          walk('dwight', [{ x: ag.dwight.homeX, y: ag.dwight.homeY }], null);
        }, 1200);
        break;

      case 'security_passed':
        activeStationRef.current = { zone: 'reception', color: '#22c55e', timer: 110 };
        scanBeamRef.current = { active: true, color: '#22c55e', timer: 70 };
        setBubble('dwight', 'SAFE! TO PAM', '#22c55e', 110);
        walk(
          'dwight',
          [{ x: 62, y: 174 }, { x: ag.dwight.homeX, y: ag.dwight.homeY }],
          folderColor
        );
        fxRef.current.push({ x: 64, y: 66, text: 'SAFE ✓', color: '#4ade80', life: 80 });
        break;

      case 'agent_drafting':
        activeStationRef.current = { zone: 'qa', color: folderColor, timer: 130 };
        ag.dwight.carryColor = null;
        // Pam physically walks up to Cleaning/Realty DB Cabinet, checks EST Cal, then drops off at Brand/Msg QA!
        walk(
          'pam',
          [
            { x: 122, y: 180 },
            { x: currentEvent.orgSlug === 'cleaning' ? 162 : 212, y: 74 },
            { x: 262, y: 74 },
            { x: 205, y: 118 },
            { x: ag.pam.homeX, y: ag.pam.homeY },
          ],
          folderColor
        );
        ag.brand_ver.workingTimer = 110;
        ag.msg_ver.workingTimer = 110;
        ag.brand_ver.carryColor = folderColor;
        ag.msg_ver.carryColor = folderColor;
        setBubble('pam', 'DB + CAL → DRAFT!', '#38bdf8', 135);
        setBubble('brand_ver', 'BRAND CHECK...', '#38bdf8', 145);
        setBubble('msg_ver', 'MSG CHECK...', '#f59e0b', 145);
        fxRef.current.push({
          x: currentEvent.orgSlug === 'cleaning' ? 162 : 212,
          y: 52,
          text: currentEvent.orgSlug === 'cleaning' ? 'CLEANING DB!' : 'REALTY DB!',
          color: folderColor,
          life: 90,
        });
        break;

      case 'jury_deliberating':
        activeStationRef.current = { zone: 'jury', color: '#a855f7', timer: 140 };
        tableFolderRef.current = { visible: true, color: folderColor };
        // Brand QA physically walks down into the Conference Room to deliver the folder to the 4-AI Jury!
        walk(
          'brand_ver',
          [{ x: 124, y: 132 }, { x: 124, y: 206 }, { x: 158, y: 206 }, { x: 124, y: 132 }, { x: ag.brand_ver.homeX, y: ag.brand_ver.homeY }],
          folderColor
        );
        ag.msg_ver.carryColor = null;
        ag.claude.workingTimer = 120;
        ag.gemini.workingTimer = 120;
        ag.gpt.workingTimer = 120;
        ag.deepseek.workingTimer = 120;
        setBubble('brand_ver', 'DELIVERING TO JURY', '#4ade80', 110);
        setBubble('claude', 'BRAND AUDIT...', '#f59e0b', 140);
        setBubble('gemini', 'CONTEXT AUDIT...', '#38bdf8', 140);
        setBubble('gpt', 'TONE AUDIT...', '#10b981', 140);
        setBubble('deepseek', 'POLICY AUDIT...', '#a855f7', 140);
        break;

      case 'jury_rewrite':
        activeStationRef.current = { zone: 'boss', color: '#f43f5e', timer: 120 };
        walk('michael', [{ x: 324, y: 124 }, { x: ag.michael.homeX, y: ag.michael.homeY }], '#f43f5e');
        setBubble('michael', 'REWRITE THIS!', '#f43f5e', 145);
        setBubble('pam', 'REWRITING, BOSS!', '#f9a8d4', 135);
        break;

      case 'boss_pending':
        activeStationRef.current = { zone: 'boss', color: '#fbbf24', timer: 180 };
        tableFolderRef.current.visible = false;
        // Claude physically carries the audited folder from Conference Room to the Boss's Corner Office!
        walk(
          'claude',
          [{ x: 126, y: 206 }, { x: 126, y: 132 }, { x: 326, y: 120 }, { x: 126, y: 132 }, { x: ag.claude.homeX, y: ag.claude.homeY }],
          folderColor
        );
        ag.michael.carryColor = folderColor;
        ag.michael.workingTimer = 120;
        setBubble('michael', 'REVIEWING DRAFT', '#fbbf24', 220);
        if (currentEvent.jurorVotes) {
          for (const v of currentEvent.jurorVotes) {
            setBubble(
              v.jurorId,
              `${v.overallScore}% ${v.vote === 'approve' ? '✓' : '⚠'}`,
              v.vote === 'approve' ? '#4ade80' : '#fbbf24',
              175
            );
          }
        }
        fxRef.current.push({ x: 396, y: 50, text: 'BOSS APPROVAL!', color: '#fbbf24', life: 120 });
        break;

      case 'auto_sent':
        activeStationRef.current = { zone: 'dock', color: '#34d399', timer: 150 };
        tableFolderRef.current.visible = false;
        if (currentEvent.jurorVotes) {
          for (const v of currentEvent.jurorVotes) {
            setBubble(v.jurorId, `${v.overallScore}% ✓`, '#4ade80', 150);
          }
        }
        // Claude walks papers to the SMS Express Truck!
        walk(
          'claude',
          [{ x: 322, y: 224 }, { x: 368, y: 232 }, { x: ag.claude.homeX, y: ag.claude.homeY }],
          folderColor
        );
        launchTruck(folderColor);
        mascotRef.current.bubble = 'PURR ♥';
        mascotRef.current.bubbleTimer = 120;
        fxRef.current.push({ x: 400, y: 205, text: 'TRUCK DISPATCH!', color: '#34d399', life: 120 });
        break;

      case 'boss_approved':
        activeStationRef.current = { zone: 'dock', color: '#22c55e', timer: 160 };
        ag.michael.carryColor = '#22c55e';
        // Boss Michael walks down to load the approved papers into the SMS Express Truck!
        walk(
          'michael',
          [{ x: 326, y: 120 }, { x: 326, y: 228 }, { x: 368, y: 232 }, { x: 326, y: 120 }, { x: ag.michael.homeX, y: ag.michael.homeY }],
          '#22c55e'
        );
        setBubble('michael', 'APPROVED! SHIP IT!', '#22c55e', 165);
        launchTruck(folderColor);
        mascotRef.current.bubble = 'MEOW! ♥';
        mascotRef.current.bubbleTimer = 120;
        fxRef.current.push({ x: 396, y: 50, text: 'STAMPED ✓', color: '#4ade80', life: 110 });
        fxRef.current.push({ x: 400, y: 205, text: 'PAPERS LOADED!', color: '#38bdf8', life: 120 });
        break;

      case 'boss_rejected':
        activeStationRef.current = { zone: 'boss', color: '#ef4444', timer: 140 };
        ag.michael.carryColor = null;
        setBubble('michael', 'REJECTED & LOGGED', '#ef4444', 170);
        fxRef.current.push({ x: 396, y: 50, text: 'LOGGED REJECT ✕', color: '#f43f5e', life: 115 });
        break;

      default:
        break;
    }
  }, [currentEvent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const scale = Math.max(2, Math.floor(((rect.width || 680) * dpr) / LOGICAL_W));
      canvas.width = LOGICAL_W * scale;
      canvas.height = LOGICAL_H * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const drawText = (text: string, x: number, y: number, color: string, size = 5.5, align: CanvasTextAlign = 'left') => {
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px "JetBrains Mono", monospace`;
      ctx.textAlign = align;
      ctx.fillText(text, Math.round(x), Math.round(y));
    };

    const drawPlant = (x: number, y: number) => {
      px(x + 2, y + 10, 10, 10, '#7c2d12');
      px(x + 1, y + 8, 12, 3, '#9a3412');
      px(x, y + 1, 14, 8, '#15803d');
      px(x + 2, y - 3, 10, 6, '#16a34a');
      px(x + 4, y - 5, 6, 4, '#22c55e');
    };

    const drawMascotCat = () => {
      const m = mascotRef.current;
      const dx = m.targetX - m.x;
      const dy = m.targetY - m.y;
      const dist = Math.hypot(dx, dy);
      const walking = dist > 1;
      if (walking) {
        m.x += (dx / dist) * 0.55;
        m.y += (dy / dist) * 0.55;
      } else {
        m.pauseTimer--;
        if (m.pauseTimer <= 0) {
          // Wander around safe bullpen spots
          const spots = [
            { x: 114, y: 122 },
            { x: 298, y: 132 },
            { x: 118, y: 244 },
            { x: 300, y: 256 },
            { x: 205, y: 132 },
          ];
          const pick = spots[Math.floor(Math.random() * spots.length)];
          m.targetX = pick.x;
          m.targetY = pick.y;
          m.pauseTimer = 140 + Math.floor(Math.random() * 120);
        }
      }

      const cx = Math.round(m.x);
      const cy = Math.round(m.y + (walking ? Math.sin(frame * 0.35) * 0.8 : 0));
      const tailWag = Math.round(Math.sin(frame * 0.16) * 2);

      // Shadow
      px(cx - 5, cy + 5, 11, 2, 'rgba(15,23,42,0.28)');
      // Tail
      px(cx - 7, cy - 1 + tailWag, 3, 2, '#f97316');
      px(cx - 8, cy - 3 + tailWag, 2, 3, '#fb923c');
      // Body (ginger tabby "Bandit")
      px(cx - 5, cy, 9, 5, '#ea580c');
      px(cx - 4, cy + 1, 7, 3, '#fb923c');
      px(cx - 2, cy + 1, 2, 1, '#9a3412'); // tabby stripe
      px(cx + 1, cy + 1, 2, 1, '#9a3412');
      // Paws
      px(cx - 4, cy + 4, 2, 2, '#fff7ed');
      px(cx + 2, cy + 4, 2, 2, '#fff7ed');
      // Head + ears
      px(cx + 2, cy - 5, 7, 6, '#fb923c');
      px(cx + 2, cy - 7, 2, 2, '#ea580c');
      px(cx + 7, cy - 7, 2, 2, '#ea580c');
      px(cx + 3, cy - 6, 1, 1, '#fda4af');
      px(cx + 7, cy - 6, 1, 1, '#fda4af');
      // Eyes + pink nose
      px(cx + 3, cy - 3, 1, 1, '#0f172a');
      px(cx + 7, cy - 3, 1, 1, '#0f172a');
      px(cx + 5, cy - 2, 1, 1, '#fb7185');
      // Little tag
      drawText('BANDIT', cx + 1, cy + 11, '#7c2d12', 4.3, 'center');

      if (m.bubbleTimer > 0) {
        m.bubbleTimer--;
        px(cx - 12, cy - 17, 28, 8, '#0f172a');
        px(cx - 11, cy - 16, 26, 6, '#fffdf5');
        drawText(m.bubble, cx + 2, cy - 11.5, '#ea580c', 4.3, 'center');
      }
    };

    const drawDeliveryTruck = () => {
      const tr = truckRef.current;
      // Update truck animation
      if (tr.state === 'loading') {
        tr.timer--;
        if (tr.timer <= 0) tr.state = 'driving_out';
      } else if (tr.state === 'driving_out') {
        tr.x += 1.9;
        if (tr.x > LOGICAL_W + 20) {
          tr.state = 'returning';
          tr.hasPapers = false;
          tr.x = LOGICAL_W + 18;
        }
      } else if (tr.state === 'returning') {
        tr.x -= 1.3;
        if (tr.x <= 382) {
          tr.x = 382;
          tr.state = 'parked';
        }
      }

      const tx = Math.round(tr.x);
      const ty = 224;
      const bounce = tr.state === 'driving_out' || tr.state === 'returning' ? (frame % 6 < 3 ? 0 : 1) : 0;

      // Asphalt loading dock road
      px(340, 212, 136, 70, '#334155');
      px(340, 212, 136, 3, '#64748b');
      // Yellow loading bay hazard stripes
      for (let sx = 344; sx < 470; sx += 12) {
        px(sx, 216, 6, 3, '#facc15');
      }
      // Dashed white road centerline
      for (let rx = 346; rx < 472; rx += 14) {
        px(rx, 258, 8, 2, '#94a3b8');
      }
      drawText('5. DISPATCH DOCK (SMS TRUCK)', 344, 208, '#065f46', 5.2);

      // Exhaust puffs while driving
      if (tr.state === 'driving_out') {
        const puff = (frame % 16) / 2;
        px(tx - 8 - puff, ty + 20, 4, 4, 'rgba(226,232,240,0.65)');
        px(tx - 15 - puff, ty + 17, 5, 5, 'rgba(226,232,240,0.4)');
      }

      // Truck shadow
      px(tx + 2, ty + 28, 72, 4, 'rgba(15,23,42,0.45)');

      // Cargo box (openable rear with visible paper stacks!)
      px(tx, ty + bounce, 48, 25, '#0f172a'); // outline
      px(tx + 1, ty + 1 + bounce, 46, 23, '#f8fafc');
      px(tx + 1, ty + 18 + bounce, 46, 5, '#0ea5e9'); // blue delivery stripe
      drawText('SMS POST', tx + 24, ty + 12 + bounce, '#0f172a', 5.2, 'center');
      drawText('EXPRESS', tx + 24, ty + 17 + bounce, '#0369a1', 4.3, 'center');

      // Paper stacks inside/loading at the rear of the truck!
      if (tr.hasPapers) {
        px(tx - 6, ty + 10 + bounce, 9, 13, '#0f172a');
        px(tx - 5, ty + 11 + bounce, 7, 11, '#fffdf5');
        px(tx - 4, ty + 13 + bounce, 5, 2, tr.paperColor);
        px(tx - 4, ty + 16 + bounce, 5, 2, tr.paperColor);
        px(tx - 4, ty + 19 + bounce, 5, 2, '#22c55e');
      }

      // Cab (front of truck)
      px(tx + 48, ty + 6 + bounce, 24, 19, '#0f172a');
      px(tx + 49, ty + 7 + bounce, 22, 17, '#0284c7');
      // Windshield
      px(tx + 54, ty + 9 + bounce, 14, 7, '#bae6fd');
      px(tx + 56, ty + 10 + bounce, 4, 5, '#e0f2fe');
      // Headlight (glows when driving)
      px(tx + 70, ty + 18 + bounce, 3, 4, tr.state === 'driving_out' ? '#fef08a' : '#facc15');
      if (tr.state === 'driving_out') {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
        ctx.fillRect(tx + 73, ty + 15 + bounce, 22, 10);
      }

      // Wheels with hubcaps
      const drawWheel = (wx: number) => {
        px(wx, ty + 23, 10, 8, '#0f172a');
        px(wx + 2, ty + 25, 6, 4, '#64748b');
        px(wx + 4, ty + 26, 2, 2, '#e2e8f0');
      };
      drawWheel(tx + 8);
      drawWheel(tx + 54);
    };

    const drawCharacter = (a: AgentSprite) => {
      let walking = false;
      if (a.waypoints.length > 0) {
        const next = a.waypoints[0];
        const dx = next.x - a.x;
        const dy = next.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2.2) {
          walking = true;
          a.x += (dx / dist) * 2.25;
          a.y += (dy / dist) * 2.25;
        } else {
          a.x = next.x;
          a.y = next.y;
          a.waypoints.shift();
          if (a.waypoints.length === 0 && Math.hypot(a.x - a.homeX, a.y - a.homeY) < 4) {
            a.carryColor = null;
          }
        }
      }

      const working = a.workingTimer > 0;
      if (working) a.workingTimer--;

      const bob = walking
        ? Math.sin(frame * 0.42) * 1.6
        : working
          ? Math.sin(frame * 0.55 + a.bobOffset) * 1.1
          : Math.sin(frame * 0.08 + a.bobOffset) * 0.45;
      const cx = Math.round(a.x);
      const cy = Math.round(a.y + bob);

      // Typing / thinking sparks above active working agents
      if (working && !walking && frame % 12 < 6) {
        px(cx - 10, cy - 12, 2, 2, '#facc15');
        px(cx + 8, cy - 14, 2, 2, '#38bdf8');
      }

      // Soft ground shadow
      px(cx - 7, a.y + 10, 14, 3, 'rgba(15, 23, 42, 0.34)');

      // Trousers & shoes
      const legShift = walking ? Math.round(Math.sin(frame * 0.4) * 1.8) : 0;
      px(cx - 5, cy + 5 + legShift, 4, 5, '#1e293b');
      px(cx + 1, cy + 5 - legShift, 4, 5, '#1e293b');
      px(cx - 5, cy + 9 + legShift, 4, 2, '#0f172a');
      px(cx + 1, cy + 9 - legShift, 4, 2, '#0f172a');

      // Torso outline + shaded jacket/shirt + collar + tie
      px(cx - 7, cy - 4, 14, 10, '#0f172a');
      px(cx - 6, cy - 3, 12, 8, a.jacket || a.shirt);
      if (a.jacket) {
        px(cx - 2, cy - 3, 4, 8, a.shirt);
      }
      if (a.tie) {
        px(cx - 1, cy - 2, 2, 7, a.tie);
      }

      // Arms + hands
      px(cx - 9, cy - 2, 3, 7, '#0f172a');
      px(cx - 8, cy - 1, 2, 5, a.jacket || a.shirt);
      px(cx - 8, cy + 4, 2, 2, a.skin);
      px(cx + 6, cy - 2, 3, 7, '#0f172a');
      px(cx + 6, cy - 1, 2, 5, a.jacket || a.shirt);
      px(cx + 6, cy + 4, 2, 2, a.skin);

      // Head with outline + shading
      px(cx - 7, cy - 16, 14, 13, '#0f172a');
      px(cx - 6, cy - 15, 12, 11, a.skin);
      px(cx - 6, cy - 6, 12, 2, a.skinShade);

      // Hair with highlight
      px(cx - 7, cy - 18, 14, 5, a.hair);
      px(cx - 5, cy - 17, 10, 2, a.hairHi);
      px(cx - 7, cy - 14, 2, 4, a.hair);
      px(cx + 5, cy - 14, 2, 4, a.hair);

      // Eyes with white sclera glint
      px(cx - 4, cy - 10, 2, 2, '#0f172a');
      px(cx + 2, cy - 10, 2, 2, '#0f172a');
      px(cx - 4, cy - 10, 1, 1, '#ffffff');
      px(cx + 2, cy - 10, 1, 1, '#ffffff');

      // Glasses
      if (a.glasses) {
        px(cx - 5, cy - 11, 4, 1, '#334155');
        px(cx + 1, cy - 11, 4, 1, '#334155');
        px(cx - 5, cy - 8, 4, 1, '#334155');
        px(cx + 1, cy - 8, 4, 1, '#334155');
        px(cx - 1, cy - 10, 2, 1, '#334155');
      }

      if (a.mustache) {
        px(cx - 3, cy - 6, 6, 2, '#1f2937');
      }

      if (a.headset) {
        px(cx - 8, cy - 14, 2, 6, '#0f172a');
        px(cx - 7, cy - 8, 4, 1, '#0f172a');
      }

      // Colored company folder
      if (a.carryColor) {
        px(cx + 6, cy - 2, 8, 6, '#0f172a');
        px(cx + 7, cy - 1, 6, 4, a.carryColor);
        px(cx + 8, cy, 4, 1, '#ffffff');
      }

      // Crisp name badge
      const lw = Math.max(30, a.label.length * 4.4 + 8);
      px(cx - lw / 2, a.y + 13, lw, 8, 'rgba(15,23,42,0.88)');
      drawText(a.label, cx, a.y + 19, '#f8fafc', 5, 'center');

      // Speech bubble
      if (a.bubbleTimer > 0) {
        a.bubbleTimer--;
        const bw = Math.min(98, Math.max(42, a.bubble.length * 4 + 10));
        const bx = Math.max(4, Math.min(LOGICAL_W - bw - 4, cx - bw / 2));
        const by = cy - 33;
        px(bx - 1, by - 1, bw + 2, 12, '#0f172a');
        px(bx, by, bw, 10, '#fffdf5');
        px(bx, by, 3, 10, a.bubbleColor);
        drawText(a.bubble.slice(0, 20), bx + bw / 2 + 1, by + 7.2, '#0f172a', 5, 'center');
      }
    };

    const render = () => {
      frame++;
      const org = activeOrgRef.current;

      // 1. Detailed Office Carpet Floor with subtle checkered weave
      px(0, 0, LOGICAL_W, LOGICAL_H, '#cec4ae');
      for (let gx = 0; gx < LOGICAL_W; gx += 16) {
        for (let gy = 34; gy < LOGICAL_H; gy += 16) {
          if ((gx / 16 + gy / 16) % 2 === 0) {
            px(gx, gy, 16, 16, '#c6bba3');
          }
        }
      }

      // 2. Top Wall with depth molding, framed art, and Venetian blinds
      px(0, 0, LOGICAL_W, 34, '#e7e1d5');
      px(0, 31, LOGICAL_W, 3, '#a69b86');

      const drawWindow = (wx: number, ww: number) => {
        px(wx - 1, 4, ww + 2, 23, '#475569');
        px(wx, 5, ww, 21, '#7dd3fc');
        px(wx, 5, ww, 7, '#bae6fd');
        for (let by = 7; by < 24; by += 3) {
          px(wx + 1, by, ww - 2, 1, '#f1f5f9');
        }
      };
      drawWindow(16, 54);
      drawWindow(86, 46);
      drawWindow(354, 110); // Boss corner office panoramic blinds

      // Company Wall Signboard
      px(154, 5, 178, 22, '#0f172a');
      px(156, 7, 174, 18, '#1e293b');
      px(156, 7, 5, 18, org.accentColor);
      drawText(org.name.toUpperCase(), 245, 15.5, '#f8fafc', 6.2, 'center');
      drawText(
        org.approvalMode === 'baa' ? 'MODE: BOSS APPROVES ALL (BAA)' : 'MODE: AUTO-PILOT + ESCALATION',
        245,
        22,
        org.approvalMode === 'baa' ? '#fbbf24' : '#34d399',
        4.6,
        'center'
      );

      // 3. ZONE 1 (Top-Left): SECURITY DESK (DWIGHT)
      px(6, 40, 112, 86, 'rgba(30, 41, 59, 0.11)');
      px(6, 40, 112, 2, '#475569');
      drawText('1. SECURITY DESK', 10, 50, '#1e293b', 5.3);
      // Entrance Door
      px(6, 68, 9, 34, '#334155');
      px(8, 70, 5, 30, '#38bdf8');
      drawText('SMS', 18, 86, '#0f172a', 5);
      // Desk + Scanner Monitor
      px(42, 70, 44, 18, '#5c2d12');
      px(44, 72, 40, 14, '#854d0e');
      px(54, 66, 18, 10, '#0f172a');
      px(56, 68, 14, 6, scanBeamRef.current.timer > 0 ? scanBeamRef.current.color : '#22c55e');
      // Siren Beacon
      const beaconOn = scanBeamRef.current.timer > 0;
      if (beaconOn) scanBeamRef.current.timer--;
      px(100, 48, 9, 9, '#0f172a');
      px(101, 49, 7, 7, beaconOn ? (frame % 10 < 5 ? scanBeamRef.current.color : '#0f172a') : '#16a34a');
      if (beaconOn) {
        ctx.fillStyle = `${scanBeamRef.current.color}40`;
        ctx.fillRect(28, 68, 60, 34);
      }

      // 4. ZONE 2 (Bottom-Left): RECEPTION DESK (PAM)
      px(6, 152, 112, 130, 'rgba(56, 189, 248, 0.08)');
      drawText('2. RECEPTION AI', 10, 162, '#1e3a8a', 5.3);
      px(20, 192, 82, 16, '#78350f');
      px(22, 194, 78, 12, '#a16207');
      px(20, 208, 16, 36, '#78350f');
      px(52, 186, 18, 11, '#0f172a');
      px(54, 188, 14, 7, '#38bdf8');
      px(28, 196, 10, 6, '#1e293b'); // phone
      px(84, 194, 6, 8, '#f472b6'); // candy jar
      drawPlant(12, 258);

      // 5. ZONE 3 (Top-Center): VERIFICATION WING (BRAND QA + MSG QA)
      px(134, 40, 162, 84, 'rgba(99, 102, 241, 0.09)');
      px(134, 40, 162, 2, '#4338ca');
      drawText('3. VERIFICATION DESKS', 140, 50, '#312e81', 5.3);
      // Brand QA Desk
      px(148, 76, 46, 16, '#5c2d12');
      px(150, 78, 42, 12, '#92400e');
      px(162, 72, 16, 9, '#0f172a');
      px(164, 74, 12, 5, '#38bdf8');
      // Message QA Desk
      px(222, 76, 46, 16, '#5c2d12');
      px(224, 78, 42, 12, '#92400e');
      px(236, 72, 16, 9, '#0f172a');
      px(238, 74, 12, 5, '#f59e0b');
      // Isolated DB Cabinets
      px(142, 54, 42, 12, '#0284c7');
      drawText('CLEAN DB', 163, 62, '#ffffff', 4.6, 'center');
      px(192, 54, 42, 12, '#7c3aed');
      drawText('REALTY DB', 213, 62, '#ffffff', 4.6, 'center');
      px(242, 54, 46, 12, '#ef4444');
      drawText('EST CAL', 265, 62, '#ffffff', 4.6, 'center');

      // 6. ZONE 4 (Bottom-Center): CONFERENCE ROOM — 4-AI JURY
      px(134, 146, 172, 136, '#dad2c1');
      px(134, 146, 172, 3, '#64748b');
      px(134, 146, 3, 136, '#64748b');
      px(303, 146, 3, 136, '#64748b');
      px(134, 279, 172, 3, '#64748b');
      px(134, 198, 3, 28, '#cec4ae'); // doorway
      drawText('4. CONFERENCE ROOM (4-AI JURY)', 142, 158, '#334155', 5.2);
      // Mahogany Conference Table
      px(164, 200, 100, 30, '#5c2d12');
      px(166, 202, 96, 26, '#9a3412');
      px(176, 206, 12, 7, '#f1f5f9');
      px(238, 206, 12, 7, '#f1f5f9');
      px(176, 217, 12, 7, '#f1f5f9');
      px(238, 217, 12, 7, '#f1f5f9');
      drawText('BRAND + CONTEXT', 214, 217, '#fde68a', 4.8, 'center');
      if (tableFolderRef.current.visible) {
        const glow = frame % 16 < 8;
        px(206, 204, 16, 10, glow ? '#fef08a' : '#0f172a');
        px(208, 206, 12, 6, tableFolderRef.current.color);
        px(210, 208, 8, 2, '#ffffff');
      }

      // 7. ZONE 5 (Top-Right): BOSS CORNER OFFICE (MICHAEL)
      px(336, 40, 138, 114, '#e0d8c7');
      px(336, 40, 3, 114, '#475569');
      px(336, 151, 138, 3, '#475569');
      px(336, 108, 3, 28, '#e0d8c7'); // Boss door
      drawText('BOSS CORNER OFFICE', 344, 50, '#7c2d12', 5.3);
      // Executive Desk
      px(364, 102, 74, 22, '#451a03');
      px(366, 104, 70, 18, '#78350f');
      px(384, 106, 20, 11, '#0f172a');
      px(386, 108, 16, 7, pendingBossRef.current > 0 ? '#fbbf24' : '#38bdf8');
      // World's Best Boss Mug
      px(418, 110, 7, 7, '#ffffff');
      px(425, 111, 2, 5, '#cbd5e1');
      px(419, 112, 5, 2, '#f59e0b');
      drawPlant(452, 58);

      if (pendingBossRef.current > 0) {
        const pulse = frame % 24 < 12;
        px(450, 44, 16, 14, pulse ? '#f59e0b' : '#78350f');
        drawText(String(pendingBossRef.current), 458, 53.5, '#0f172a', 7, 'center');
      }

      // 8. ZONE 6 (Bottom-Right): DISPATCH DOCK + DELIVERY TRUCK CARRYING PAPERS
      drawDeliveryTruck();

      // 9. Draw Office Mascot ("Bandit" the Cat) & All 9 Characters sorted by Y
      drawMascotCat();
      const sortedAgents = Object.values(agentsRef.current).sort((a, b) => a.y - b.y);
      for (const sprite of sortedAgents) {
        drawCharacter(sprite);
      }

      // 10. Floating FX
      fxRef.current = fxRef.current.filter((fx) => {
        fx.life--;
        fx.y -= 0.25;
        const alpha = Math.min(1, fx.life / 25);
        ctx.save();
        ctx.globalAlpha = alpha;
        const w = fx.text.length * 4.4 + 10;
        px(fx.x - w / 2, fx.y - 8, w, 10, 'rgba(15, 23, 42, 0.92)');
        drawText(fx.text, fx.x, fx.y, fx.color, 5.2, 'center');
        ctx.restore();
        return fx.life > 0;
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const speaker = currentEvent?.speaker || 'MINI OFFICE HQ';
  const dialogText =
    currentEvent?.message ||
    'Send a customer SMS (text, photo, PDF, or link) to watch Security Dwight, Reception Pam, Brand & Message QA, the 4-AI Jury, Boss Michael, Bandit the Cat, and the SMS Delivery Truck!';
  const pill = currentEvent?.statusPill || 'IDLE • READY';

  return (
    <div className="flex flex-col justify-between rounded-xl overflow-hidden gba-frame bg-[#1e1b2e] h-full min-h-[480px]">
      <div className="bg-[#2b2640] px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] border-b-2 border-[#14111f] font-pixel shrink-0">
        <span className="font-extrabold text-amber-400 truncate">
          2. LIVE PIXEL OFFICE // THE OFFICE HQ (HD)
        </span>
        <span className="font-bold text-slate-300 shrink-0">
          Tickets: {totalProcessed} • Blocked: {totalBlocked}
        </span>
      </div>

      <div className="w-full flex-1 min-h-0 relative bg-[#181526] flex items-center justify-center overflow-hidden p-1.5">
        <canvas
          ref={canvasRef}
          style={{ aspectRatio: '480 / 290' }}
          className="w-full max-h-full h-auto block pixel-canvas rounded shadow-lg"
        />
      </div>

      <div className="gba-dialog text-[#1e1b2e] px-3.5 py-2 flex flex-col justify-between min-h-[104px] font-pixel shrink-0">
        <div className="flex items-center justify-between gap-2 border-b border-[#e2d6b5] pb-1">
          <span className="font-extrabold text-indigo-900 text-xs truncate">▶ {speaker}</span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-200 text-amber-950 shrink-0">
            {pill}
          </span>
        </div>
        <div className="text-xs font-bold leading-snug text-stone-900 my-1 line-clamp-2">
          {dialogText}
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold text-stone-600 flex-wrap gap-1">
          <span>🛡️ SECURITY • 🎧 RECEPTION • ✅ QA • ⚖️ 4-AI JURY • 🚚 TRUCK • 🐱 BANDIT</span>
          <span className="text-indigo-800">{activeOrg.name}</span>
        </div>
      </div>
    </div>
  );
};
