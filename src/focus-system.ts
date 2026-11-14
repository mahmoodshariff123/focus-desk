import {
  AudioUtils,
  Color,
  createSystem,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Pressed,
  Quaternion,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import type { Entity } from '@iwsdk/core';
import { FocusOrb } from './focus-components.js';
import {
  DURATIONS,
  doneCount,
  FocusState,
  formatTime,
  isDayComplete,
  loadState,
  markDayComplete,
  saveState,
  shuffleTasks,
  TASK_COUNT,
} from './focus-state.js';

type Element = ReturnType<UIKitMLAsset['requireElementById']>;

const COLOR = {
  rowIdle: '#232427',
  rowDone: '#173d2c',
  borderIdle: '#3a3b40',
  borderDone: '#3ecf8e',
  checkIdle: '#232427',
  checkDone: '#3ecf8e',
  textIdle: '#f1f1ee',
  textDone: '#8fd9b6',
  chipIdle: '#232427',
  chipActive: '#f5d90a',
  chipTextIdle: '#e6e7ea',
  chipTextActive: '#1c1d20',
  headerIdle: '#2b3a8f',
  headerProgress: '#7a4bd1',
  headerDone: '#c98a00',
};

const DESK_DISTANCE = 0.6;
const DESK_DROP = 0.18;
const BAR_WIDTH = 380;

/**
 * Focus Desk: a morning plan (three tasks), a focus timer and a daily streak.
 * Every control is a UIKit element that hands can pinch (ray) or poke.
 */
export class FocusDeskSystem extends createSystem({
  orbs: { required: [FocusOrb] },
  orbPressed: { required: [FocusOrb, Pressed] },
}) {
  private state!: FocusState;
  private remaining = 0;
  private running = false;
  private lastShownSecond = -1;
  private speed = 1;
  private celebrate = 0;
  private placeIn = -1;

  private taskRows: Element[] = [];
  private taskChecks: Element[] = [];
  private taskLabels: Element[] = [];
  private chips = new Map<number, Element>();
  private timerText!: Element;
  private timerStatus!: Element;
  private timerFill!: Element;
  private startBtn!: Element;
  private pauseBtn!: Element;
  private header!: Element;
  private headerTitle!: Element;
  private streakText!: Element;
  private minutesText!: Element;
  private progressText!: Element;

  private desk: Object3D | null = null;
  private deskHome = new Vector3(0, 1.2, -0.65);
  private orbEntity: Entity | null = null;
  private orbCore: Object3D | null = null;
  private orbRing: Object3D | null = null;
  private orbMaterials: MeshStandardMaterial[] = [];
  private colorCalm = new Color('#3a5cff');
  private colorGold = new Color('#ffb703');
  private colorTmp = new Color();
  private headPos = new Vector3();
  private forward = new Vector3();
  private headQuat = new Quaternion();

  init(): void {
    this.state = loadState();
    this.speed = new URLSearchParams(window.location.search).has('demo') ? 12 : 1;
    this.remaining = this.state.durationMin * 60;

    const tasks = this.world.requireSceneObject<UIKitMLAsset>('tasks-panel');
    const timer = this.world.requireSceneObject<UIKitMLAsset>('timer-panel');
    const today = this.world.requireSceneObject<UIKitMLAsset>('today-panel');

    for (let i = 0; i < TASK_COUNT; i += 1) {
      const row = tasks.requireElementById(`task-${i}`);
      this.taskRows.push(row);
      this.taskChecks.push(tasks.requireElementById(`task-${i}-check`));
      this.taskLabels.push(tasks.requireElementById<UIKit.Text>(`task-${i}-label`));
      this.listen(row, () => this.toggleTask(i));
    }
    this.listen(tasks.requireElementById('shuffle-btn'), () => {
      shuffleTasks(this.state);
      this.commit();
    });

    this.timerText = timer.requireElementById<UIKit.Text>('timer-text');
    this.timerStatus = timer.requireElementById<UIKit.Text>('timer-status');
    this.timerFill = timer.requireElementById('timer-fill');
    this.startBtn = timer.requireElementById('start-btn');
    this.pauseBtn = timer.requireElementById('pause-btn');
    this.listen(this.startBtn, () => this.setRunning(true));
    this.listen(this.pauseBtn, () => this.setRunning(false));
    this.listen(timer.requireElementById('reset-btn'), () => this.resetTimer());
    for (const minutes of DURATIONS) {
      const chip = timer.requireElementById(`dur-${minutes}`);
      this.chips.set(minutes, chip);
      this.listen(chip, () => this.setDuration(minutes));
    }

    this.header = today.requireElementById('today-header');
    this.headerTitle = today.requireElementById<UIKit.Text>('today-title');
    this.streakText = today.requireElementById<UIKit.Text>('streak-text');
    this.minutesText = today.requireElementById<UIKit.Text>('minutes-text');
    this.progressText = today.requireElementById<UIKit.Text>('progress-text');
    this.listen(today.requireElementById('recenter-btn'), () => this.placeDeskInFront());
    this.setupXRButtons(today);

    this.desk = this.world.requireSceneObject<Object3D>('desk');
    this.deskHome.copy(this.desk.position);
    this.setupOrb();

    this.queries.orbPressed.subscribe('qualify', () => this.setRunning(!this.running));

    this.refreshAll();
  }

  update(delta: number, time: number): void {
    if (this.placeIn >= 0) {
      this.placeIn -= delta;
      if (this.placeIn < 0) this.placeDeskInFront();
    }

    if (this.running) {
      this.remaining -= delta * this.speed;
      if (this.remaining <= 0) {
        this.remaining = 0;
        this.finishFocus();
      }
      const second = Math.ceil(this.remaining);
      if (second !== this.lastShownSecond) {
        this.lastShownSecond = second;
        this.refreshTimer();
      }
    }

    this.animateOrb(delta, time);
  }

  private listen(element: Element, handler: () => void): void {
    element.addEventListener('click', handler);
    this.cleanupFuncs.push(() => element.removeEventListener('click', handler));
  }

  private setupXRButtons(today: UIKitMLAsset): void {
    const xrButton = today.requireElementById('xr-button');
    const exitButton = today.requireElementById('exit-button');
    if (!this.world.xrEnabled) {
      xrButton.setProperties({ display: 'none' });
      exitButton.setProperties({ display: 'none' });
      return;
    }
    const xrLabel = today.requireElementById<UIKit.Text>('xr-label');
    let xrSupported = false;
    void (navigator.xr?.isSessionSupported('immersive-ar') ?? Promise.resolve(false))
      .catch(() => false)
      .then((supported) => {
        xrSupported = supported;
        if (!supported) xrLabel.setProperties({ text: 'Open on Meta Quest' });
      });
    this.listen(xrButton, () => {
      if (xrSupported) this.world.launchXR();
    });
    this.listen(exitButton, () => this.world.exitXR());
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((visibility) => {
        const is2D = visibility === VisibilityState.NonImmersive;
        xrButton.setProperties({ display: is2D ? 'flex' : 'none' });
        exitButton.setProperties({ display: is2D ? 'none' : 'flex' });
        if (is2D) {
          this.placeIn = -1;
          this.desk?.position.copy(this.deskHome);
          this.desk?.rotation.set(0, 0, 0);
        } else if (visibility === VisibilityState.Visible) {
          // Wait for the first tracked head pose before placing the desk.
          this.placeIn = 0.4;
        }
      }),
    );
  }

  private setupOrb(): void {
    this.orbEntity = this.world.requireSceneEntity('focus-orb');
    const orb = this.world.requireSceneObject<Object3D>('focus-orb');
    this.orbCore = orb.getObjectByName('orb-core') ?? null;
    this.orbRing = orb.getObjectByName('orb-ring') ?? null;
    for (const part of [this.orbCore, this.orbRing]) {
      if (!(part instanceof Mesh)) continue;
      const material = (part.material as MeshStandardMaterial).clone();
      part.material = material;
      this.orbMaterials.push(material);
    }
  }

  /** Puts the desk an arm's length in front of the viewer, just below eye level. */
  private placeDeskInFront(): void {
    const desk = this.desk;
    if (desk == null) return;
    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    this.headPos.setFromMatrixPosition(head.matrixWorld);
    head.getWorldQuaternion(this.headQuat);
    this.forward.set(0, 0, -1).applyQuaternion(this.headQuat);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-4) this.forward.set(0, 0, -1);
    this.forward.normalize();
    const target = this.headPos.addScaledVector(this.forward, DESK_DISTANCE);
    target.y -= DESK_DROP;
    desk.parent?.updateWorldMatrix(true, false);
    desk.parent?.worldToLocal(target);
    desk.position.copy(target);
    desk.rotation.set(0, Math.atan2(-this.forward.x, -this.forward.z), 0);
  }

  private toggleTask(index: number): void {
    const task = this.state.tasks[index];
    if (task == null) return;
    task.done = !task.done;
    if (task.done) this.chime();
    this.commit();
  }

  private setDuration(minutes: number): void {
    this.state.durationMin = minutes;
    this.running = false;
    this.remaining = minutes * 60;
    this.commit();
  }

  private setRunning(running: boolean): void {
    if (running && this.remaining <= 0) this.remaining = this.state.durationMin * 60;
    this.running = running;
    this.refreshTimer();
  }

  private resetTimer(): void {
    this.running = false;
    this.remaining = this.state.durationMin * 60;
    this.refreshTimer();
  }

  private finishFocus(): void {
    this.running = false;
    this.state.focusDone = true;
    this.state.focusMinutesToday += this.state.durationMin;
    this.chime();
    this.commit();
  }

  private chime(): void {
    if (this.orbEntity != null) AudioUtils.play(this.orbEntity);
  }

  /** Persists state, checks for a newly completed morning, and redraws. */
  private commit(): void {
    if (isDayComplete(this.state) && markDayComplete(this.state)) {
      this.celebrate = 3;
      this.chime();
    }
    saveState(this.state);
    this.refreshAll();
  }

  private refreshAll(): void {
    this.state.tasks.forEach((task, i) => {
      this.taskLabels[i]?.setProperties({
        text: task.label,
        color: task.done ? COLOR.textDone : COLOR.textIdle,
      });
      this.taskRows[i]?.setProperties({
        backgroundColor: task.done ? COLOR.rowDone : COLOR.rowIdle,
        borderColor: task.done ? COLOR.borderDone : COLOR.borderIdle,
      });
      this.taskChecks[i]?.setProperties({
        backgroundColor: task.done ? COLOR.checkDone : COLOR.checkIdle,
        borderColor: task.done ? COLOR.borderDone : '#8a8d96',
      });
    });
    for (const [minutes, chip] of this.chips) {
      const active = minutes === this.state.durationMin;
      chip.setProperties({
        backgroundColor: active ? COLOR.chipActive : COLOR.chipIdle,
        borderColor: active ? COLOR.chipActive : COLOR.borderIdle,
        color: active ? COLOR.chipTextActive : COLOR.chipTextIdle,
      });
    }
    this.refreshTimer();
    this.refreshToday();
  }

  private refreshTimer(): void {
    const total = this.state.durationMin * 60;
    const progress = total > 0 ? 1 - this.remaining / total : 0;
    this.timerText.setProperties({ text: formatTime(this.remaining) });
    this.timerFill.setProperties({ width: Math.round(BAR_WIDTH * progress) });
    let status = 'Ready when you are';
    if (this.running) status = 'Focusing... stay with it';
    else if (this.remaining <= 0) status = 'Focus done. Nice work!';
    else if (progress > 0) status = 'Paused';
    this.timerStatus.setProperties({ text: status });
    this.startBtn.setProperties({ display: this.running ? 'none' : 'flex' });
    this.pauseBtn.setProperties({ display: this.running ? 'flex' : 'none' });
  }

  private refreshToday(): void {
    const done = doneCount(this.state);
    const complete = isDayComplete(this.state);
    const started = done > 0 || this.state.focusDone;
    this.header.setProperties({
      backgroundColor: complete
        ? COLOR.headerDone
        : started
          ? COLOR.headerProgress
          : COLOR.headerIdle,
    });
    this.headerTitle.setProperties({
      text: complete ? 'Morning complete!' : started ? 'Keep going' : "Let's begin",
    });
    const streak = this.state.streak;
    this.streakText.setProperties({
      text: `${streak}-day streak`,
    });
    this.minutesText.setProperties({
      text: `Focus today: ${this.state.focusMinutesToday} min`,
    });
    this.progressText.setProperties({
      text: `${done} of ${this.state.tasks.length} tasks, focus ${this.state.focusDone ? 'done' : 'not done'}`,
    });
  }

  /** Orb brightens and turns gold with progress; it pulses while focusing. */
  private animateOrb(delta: number, time: number): void {
    const steps = this.state.tasks.length + 1;
    const progress = (doneCount(this.state) + (this.state.focusDone ? 1 : 0)) / steps;
    const pulse = this.running ? 0.5 + 0.5 * Math.sin(time * 2.4) : 0;
    if (this.celebrate > 0) this.celebrate = Math.max(0, this.celebrate - delta);
    const party = this.celebrate > 0 ? Math.sin(this.celebrate * Math.PI) : 0;

    this.colorTmp.copy(this.colorCalm).lerp(this.colorGold, progress);
    const intensity = 0.25 + progress * 1.6 + pulse * 0.6 + party * 1.5;
    for (const material of this.orbMaterials) {
      material.emissive.copy(this.colorTmp);
      material.emissiveIntensity = intensity;
    }
    if (this.orbCore != null) {
      this.orbCore.scale.setScalar(1 + progress * 0.3 + pulse * 0.06 + party * 0.25);
    }
    if (this.orbRing != null) {
      this.orbRing.rotation.z += delta * (0.3 + progress * 1.2 + party * 6);
    }
  }
}