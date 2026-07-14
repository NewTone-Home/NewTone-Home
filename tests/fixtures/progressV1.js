const baseV1Progress = {
  _version: 1,
  currentView: 'landing',
  maxReadPhase: null,
  lastReadPhase: null,
  lastScrollY: 0,
  centerUnlocked: false,
  centerMode: 'home',
  language: 'zh',
  hasInitializedLanguage: false,
}

export const progressV1Fixtures = {
  neverStarted: {
    ...baseV1Progress,
  },
  midwayM2: {
    ...baseV1Progress,
    currentView: 'reader',
    maxReadPhase: 'M2',
    lastReadPhase: 'M2',
    lastScrollY: 954,
    hasInitializedLanguage: true,
  },
  enteredM4NotCompleted: {
    ...baseV1Progress,
    currentView: 'reader',
    maxReadPhase: 'M4',
    lastReadPhase: 'M4',
    lastScrollY: 2301,
    centerUnlocked: false,
    hasInitializedLanguage: true,
  },
  centerPermanentlyUnlocked: {
    ...baseV1Progress,
    currentView: 'center',
    maxReadPhase: 'M4',
    lastReadPhase: 'M4',
    lastScrollY: 3415,
    centerUnlocked: true,
    hasInitializedLanguage: true,
  },
}
