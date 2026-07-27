/* ==========================================================================
   Dragon Ball Clash Action TCG - Interactive Guided Tutorial
   ========================================================================== */

import { soundEngine } from './audio.js';
import { getStarterDeckForLeader } from './card-database.js';

export const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "⚡ Welcome to Dragon Ball Clash TCG!",
    text: "Unlike slow turn-based card games, DBTCG is a real-time Active Clash MMO. Your Leader has 8 Life Shields. When your shields drop to 4, your Leader AWAKENS into Super Saiyan form!",
    targetId: "p1-leader-box"
  },
  {
    step: 2,
    title: "🔥 Ki Resource & Charging Rules",
    text: "Ki is required to play cards. Click the CHARGE KI button to gain +2 Ki! But beware:\n1. Charging passes Initiative to your opponent.\n2. Exposes Open Guard (Guarda Aberta) for 3.5s (+50% incoming damage penalty!).",
    targetId: "charge-ki-btn"
  },
  {
    step: 3,
    title: "🥊 Attack Cards & Reaction Window",
    text: "When you play a Red Attack card, a 2.5-second Reaction Window opens! Your opponent has 2.5s to defend with Blue Defense or counter with Green Z-Vanish Teleport!",
    targetId: "drop-zone"
  },
  {
    step: 4,
    title: "🌊 Beam Clash (Disputa de Ki)",
    text: "If both fighters throw Ki Beams simultaneously, a Beam Clash is triggered! Rapidly mash the PUSH BEAM button to overpower your opponent's beam!",
    targetId: "beam-clash-overlay"
  },
  {
    step: 5,
    title: "🏆 You are Ready for Battle!",
    text: "Build custom decks, craft cards, join Dojos, and duel real fighters online. Let's start your training match!",
    targetId: null
  }
];

export class TutorialManager {
  constructor(uiManager) {
    this.ui = uiManager;
    this.currentStepIndex = 0;
    this.overlay = document.getElementById('tutorial-modal');
    this.titleEl = document.getElementById('tutorial-title');
    this.textEl = document.getElementById('tutorial-text');
    this.nextBtn = document.getElementById('tutorial-next-btn');

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.nextStep());
    }
  }

  startTutorial() {
    this.currentStepIndex = 0;
    if (this.overlay) this.overlay.classList.add('active');
    this.renderStep();
    soundEngine.playClick();
  }

  renderStep() {
    const step = TUTORIAL_STEPS[this.currentStepIndex];
    if (!step) {
      this.endTutorial();
      return;
    }

    if (this.titleEl) this.titleEl.textContent = step.title;
    if (this.textEl) this.textEl.innerText = step.text;

    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    if (step.targetId) {
      const target = document.getElementById(step.targetId);
      if (target) target.classList.add('tutorial-highlight');
    }
  }

  nextStep() {
    soundEngine.playClick();
    this.currentStepIndex++;
    if (this.currentStepIndex >= TUTORIAL_STEPS.length) {
      this.endTutorial();
    } else {
      this.renderStep();
    }
  }

  endTutorial() {
    if (this.overlay) this.overlay.classList.remove('active');
    document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    const deck = getStarterDeckForLeader(this.ui.selectedLeader || 'goku');
    this.ui.multiplayer.startAiMatch(this.ui.selectedLeader || 'goku', 'vegeta', deck);
    this.ui.switchTab('arena');
  }
}
